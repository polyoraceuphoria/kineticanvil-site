// Smoke test for api/status.js probe logic.
// Run: node scripts/smoke_status.mjs
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const status = require('../api/status.js');

const { runChecks, DEGRADED_MS, TIMEOUT_MS } = status;

let failures = 0;
function check(name, cond, detail) {
  if (cond) {
    console.log('PASS ' + name);
  } else {
    failures++;
    console.log('FAIL ' + name + (detail ? ' :: ' + detail : ''));
  }
}

function okResponse() {
  return { ok: true, status: 200 };
}

function makeFetch(behaviors) {
  // behaviors: url substring -> 'ok' | 'slow' | 'timeout' | 'http500'
  return function mockFetch(url, opts) {
    const mode = Object.keys(behaviors).find((k) => url.includes(k));
    const behavior = mode ? behaviors[mode] : 'ok';
    if (behavior === 'ok') return Promise.resolve(okResponse());
    if (behavior === 'http500') return Promise.resolve({ ok: false, status: 500 });
    if (behavior === 'slow') {
      return new Promise((resolve) => setTimeout(() => resolve(okResponse()), DEGRADED_MS + 200));
    }
    if (behavior === 'timeout') {
      // Never resolves on its own; rejects when the probe aborts.
      return new Promise((resolve, reject) => {
        if (opts && opts.signal) {
          opts.signal.addEventListener('abort', () => reject(new Error('aborted')));
        }
      });
    }
    return Promise.resolve(okResponse());
  };
}

const COMPONENTS = [
  { name: 'API', url: 'https://example.test/health' },
  { name: 'Docs', url: 'https://example.test/docs' },
  { name: 'Site', url: 'https://example.test/site' },
];

async function main() {
  // Case 1: all healthy
  let r = await runChecks(COMPONENTS, makeFetch({}));
  check('all-healthy overall operational', r.overall === 'operational', r.overall);
  check('all-healthy every component operational', r.components.every((c) => c.status === 'operational'));
  check('all-healthy latency present', r.components.every((c) => Number.isInteger(c.latency_ms)));
  check('checked_at is ISO timestamp', !Number.isNaN(Date.parse(r.checked_at)));

  // Case 2: one timeout -> outage
  r = await runChecks(COMPONENTS, makeFetch({ '/docs': 'timeout' }));
  const docs = r.components.find((c) => c.name === 'Docs');
  check('one-timeout component outage', docs.status === 'outage', docs.status);
  check('one-timeout latency null', docs.latency_ms === null);
  check('one-timeout overall outage', r.overall === 'outage', r.overall);
  check('one-timeout others operational', r.components.filter((c) => c.name !== 'Docs').every((c) => c.status === 'operational'));

  // Case 3: one slow -> degraded
  r = await runChecks(COMPONENTS, makeFetch({ '/site': 'slow' }));
  const site = r.components.find((c) => c.name === 'Site');
  check('one-slow component degraded', site.status === 'degraded', site.status);
  check('one-slow latency over budget', site.latency_ms > DEGRADED_MS, String(site.latency_ms));
  check('one-slow overall degraded', r.overall === 'degraded', r.overall);

  // Case 4: non-2xx -> degraded
  r = await runChecks(COMPONENTS, makeFetch({ '/health': 'http500' }));
  const api = r.components.find((c) => c.name === 'API');
  check('http500 component degraded', api.status === 'degraded', api.status);
  check('http500 overall degraded', r.overall === 'degraded', r.overall);

  // Sanity: default component list carries no secrets or private endpoints
  const urls = status.COMPONENTS.map((c) => c.url).join(' ');
  check('no brain endpoints probed', !/_brain|_deploy/.test(urls));
  check('timeout budget sane', TIMEOUT_MS === 5000);

  console.log(failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED');
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
