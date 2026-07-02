'use strict';
const { cors, preflight, json, apiError, readBody, rateLimited, clientIp } = require('../lib/anvil');

// POST /api/sandbox-key
// Self-serve a sandbox key. This endpoint passes through to the runtime's
// mint endpoint (api.kineticanvil.com/api/sandbox-key), which signs the key
// AND stamps its bounded sandbox scope grant. Minting locally is no longer
// valid: the runtime denies sandbox keys that carry no scope grant, so a
// locally signed key would be rejected on every call.
const RUNTIME_MINT = 'https://api.kineticanvil.com/api/sandbox-key';

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

  try {
    const upstream = await fetch(RUNTIME_MINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': ip,
      },
      body: JSON.stringify(body || {}),
    });
    const text = await upstream.text();
    res.statusCode = upstream.status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    const retryAfter = upstream.headers.get('retry-after');
    if (retryAfter) res.setHeader('Retry-After', retryAfter);
    return res.end(text);
  } catch (e) {
    return apiError(res, 502, 'upstream_unavailable', 'Key service is temporarily unavailable. Try again shortly.');
  }
};
