'use strict';
const {
  cors, preflight, json, apiError, readBody, verifyKey, rateLimited, clientIp, synthId, CASE_TYPES,
} = require('../../lib/anvil');

function authError(res, v) {
  const map = {
    missing_bearer: [401, 'Provide a sandbox key as Authorization: Bearer <key>.'],
    invalid_prefix: [401, 'Key must be a sandbox key (kx_test_). Generate one at https://kineticanvil.com/sandbox.'],
    malformed: [401, 'Malformed sandbox key.'],
    bad_signature: [401, 'Invalid sandbox key.'],
    live_not_provisioned: [402, 'Live (kx_live_) access is provisioned per organization. Contact us via https://kineticanvil.com/#contact.'],
  };
  const [code, message] = map[v.reason] || [401, 'Unauthorized.'];
  return apiError(res, code, v.reason, message);
}

// POST /v1/matters   open a matter (sandbox, synthetic)
// GET  /v1/matters   list recent synthetic matters
module.exports = async function handler(req, res) {
  if (preflight(req, res)) return;
  cors(req, res);

  const v = verifyKey(req.headers.authorization);
  if (!v.ok) return authError(res, v);

  const ip = clientIp(req);
  if (rateLimited('v1:' + v.keyId + ':' + ip, 120, 60000)) {
    res.setHeader('Retry-After', '60');
    return apiError(res, 429, 'rate_limited', 'Sandbox rate limit is 120 req/min.');
  }

  if (req.method === 'GET') {
    const now = Date.now();
    const items = CASE_TYPES.slice(0, 3).map((t, i) => ({
      matter_id: synthId('mt', v.keyId, t),
      type: t,
      status: ['open', 'in_review', 'open'][i],
      custody: 'sealed',
      created_at: new Date(now - (i + 1) * 3600_000).toISOString(),
    }));
    return json(res, 200, { object: 'list', environment: 'sandbox', data: items, has_more: false });
  }

  if (req.method !== 'POST') {
    return apiError(res, 405, 'method_not_allowed', 'Use POST to open a matter or GET to list.');
  }

  const body = await readBody(req);
  const type = (body && typeof body.type === 'string') ? body.type : 'asset_trace';
  if (!CASE_TYPES.includes(type)) {
    return apiError(res, 422, 'invalid_type', 'Unknown matter type.', { param: 'type', allowed: CASE_TYPES });
  }

  const matterId = synthId('mt', v.keyId, type);
  return json(res, 201, {
    object: 'matter',
    matter_id: matterId,
    type,
    status: 'open',
    custody: 'sealed',
    ledger: 'append_only',
    environment: 'sandbox',
    created_at: new Date().toISOString(),
    links: {
      self: 'https://api.kineticanvil.com/v1/matters/' + matterId,
      docs: 'https://docs.kineticanvil.com',
    },
  });
};
