'use strict';
const { cors, preflight, json, apiError, readBody, issueKey, rateLimited, clientIp } = require('../lib/anvil');

// POST /api/sandbox-key
// Self-serve a sandbox key. Stateless + signed: the key is returned once and
// never stored, so it cannot be recovered. Lost keys are replaced, not retrieved.
module.exports = async function handler(req, res) {
  if (preflight(req, res)) return;
  cors(req, res);

  if (req.method !== 'POST') {
    return apiError(res, 405, 'method_not_allowed', 'Use POST to generate a sandbox key.');
  }

  const ip = clientIp(req);
  if (rateLimited('key:' + ip, 10, 60000)) {
    res.setHeader('Retry-After', '60');
    return apiError(res, 429, 'rate_limited', 'Too many key requests from your network. Wait a minute and try again.');
  }

  const body = await readBody(req);
  // Honeypot: silently accept but issue nothing meaningful for bots.
  if (body && typeof body.company_website === 'string' && body.company_website.trim() !== '') {
    return json(res, 200, { ok: true });
  }

  const { key, key_id } = issueKey();
  return json(res, 201, {
    key,
    key_id,
    environment: 'sandbox',
    scope: 'sandbox:read sandbox:write',
    base_url: 'https://api.kineticanvil.com',
    rate_limit: '120 req/min',
    note: 'Shown once. This key is signed, not stored - it cannot be recovered. Lost it? Generate a new one.',
    docs: 'https://docs.kineticanvil.com',
  });
};
