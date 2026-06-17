'use strict';
const {
  cors, preflight, json, readBody, verifyKey, rateLimited, clientIp, synthId, CASE_TYPES,
} = require('../../lib/anvil');

function authError(res, v) {
  const map = {
    missing_bearer: [401, 'Provide a sandbox key as Authorization: Bearer <key>.'],
    invalid_prefix: [401, 'Key must be a sandbox key (kx_test_…). Generate one at https://kineticanvil.com/sandbox.'],
    malformed: [401, 'Malformed sandbox key.'],
    bad_signature: [401, 'Invalid sandbox key.'],
    live_not_provisioned: [402, 'Live (kx_live_) access is provisioned per organization. Contact us via https://kineticanvil.com/#contact.'],
  };
  const [code, message] = map[v.reason] || [401, 'Unauthorized.'];
  return json(res, code, { error: v.reason, message, docs: 'https://docs.kineticanvil.com' });
}

// POST /v1/cases   create a case (sandbox, synthetic)
// GET  /v1/cases   list recent synthetic cases
module.exports = async function handler(req, res) {
  if (preflight(req, res)) return;
  cors(req, res);

  const v = verifyKey(req.headers.authorization);
  if (!v.ok) return authError(res, v);

  const ip = clientIp(req);
  if (rateLimited('v1:' + v.keyId + ':' + ip, 120, 60000)) {
    res.setHeader('Retry-After', '60');
    return json(res, 429, { error: 'rate_limited', message: 'Sandbox rate limit is 120 req/min.' });
  }

  if (req.method === 'GET') {
    const now = Date.now();
    const items = CASE_TYPES.slice(0, 3).map((t, i) => ({
      case_id: synthId('cs', v.keyId, t),
      type: t,
      status: ['open', 'in_review', 'open'][i],
      custody: 'sealed',
      created_at: new Date(now - (i + 1) * 3600_000).toISOString(),
    }));
    return json(res, 200, { object: 'list', environment: 'sandbox', data: items, has_more: false });
  }

  if (req.method !== 'POST') {
    return json(res, 405, { error: 'method_not_allowed', message: 'Use POST to create a case or GET to list.' });
  }

  const body = await readBody(req);
  const type = (body && typeof body.type === 'string') ? body.type : 'asset_trace';
  if (!CASE_TYPES.includes(type)) {
    return json(res, 422, {
      error: 'invalid_type',
      message: 'Unknown case type.',
      allowed: CASE_TYPES,
    });
  }

  const caseId = synthId('cs', v.keyId, type);
  return json(res, 201, {
    object: 'case',
    case_id: caseId,
    type,
    status: 'open',
    custody: 'sealed',
    ledger: 'append_only',
    environment: 'sandbox',
    created_at: new Date().toISOString(),
    links: {
      self: 'https://api.kineticanvil.com/v1/cases/' + caseId,
      docs: 'https://docs.kineticanvil.com',
    },
  });
};
