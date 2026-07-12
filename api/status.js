'use strict';
const { cors, preflight, json } = require('../lib/anvil');

// GET /api/status
// Server-side health probes for the public status page. Each component is
// checked with a plain unauthenticated GET: no keys, no internal endpoints.
//
//   operational -> 2xx within the latency budget
//   degraded    -> responding but slow (> DEGRADED_MS) or non-2xx
//   outage      -> timeout, refused, or network failure
//
// Overall status is the worst component status.

const TIMEOUT_MS = 5000;
const DEGRADED_MS = 2500;

const COMPONENTS = [
  { name: 'API', url: 'https://api.kineticanvil.com/v1/health' },
  { name: 'Spec', url: 'https://api.kineticanvil.com/openapi.json' },
  { name: 'Docs', url: 'https://docs.kineticanvil.com' },
  { name: 'Site', url: 'https://www.kineticanvil.com' },
];

const RANK = { operational: 0, degraded: 1, outage: 2 };

async function probe(component, fetchImpl) {
  const doFetch = fetchImpl || fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const started = Date.now();
  try {
    const resp = await doFetch(component.url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'kinetic-anvil-statuspage/1.0' },
    });
    const latency = Date.now() - started;
    let status = 'operational';
    if (!resp.ok) status = 'degraded';
    else if (latency > DEGRADED_MS) status = 'degraded';
    return { name: component.name, status, latency_ms: latency };
  } catch (_err) {
    return { name: component.name, status: 'outage', latency_ms: null };
  } finally {
    clearTimeout(timer);
  }
}

async function runChecks(components, fetchImpl) {
  const list = components || COMPONENTS;
  const results = await Promise.all(list.map((c) => probe(c, fetchImpl)));
  const overall = results.reduce(
    (worst, r) => (RANK[r.status] > RANK[worst] ? r.status : worst),
    'operational'
  );
  return {
    overall,
    components: results,
    checked_at: new Date().toISOString(),
  };
}

module.exports = async function handler(req, res) {
  if (preflight(req, res)) return;
  cors(req, res);
  if (req.method !== 'GET') {
    return json(res, 405, { error: 'method_not_allowed' });
  }
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=30');
  const body = await runChecks();
  return json(res, 200, body);
};

module.exports.runChecks = runChecks;
module.exports.probe = probe;
module.exports.COMPONENTS = COMPONENTS;
module.exports.TIMEOUT_MS = TIMEOUT_MS;
module.exports.DEGRADED_MS = DEGRADED_MS;
