'use strict';
const { cors, preflight, json, apiError, verifyKey, synthId } = require('../../../lib/anvil');

// GET /v1/matters/:id   retrieve a synthetic matter (sandbox)
module.exports = async function handler(req, res) {
  if (preflight(req, res)) return;
  cors(req, res);

  const v = verifyKey(req.headers.authorization);
  if (!v.ok) {
    const code = v.reason === 'live_not_provisioned' ? 402 : 401;
    return apiError(res, code, v.reason, 'Unauthorized. Provide a valid sandbox key as Authorization: Bearer <key>.');
  }

  if (req.method !== 'GET') {
    return apiError(res, 405, 'method_not_allowed', 'Use GET to retrieve a matter.');
  }

  const id = (req.query && req.query.id) || 'mt_unknown';
  const now = Date.now();
  return json(res, 200, {
    object: 'matter',
    matter_id: id,
    type: 'asset_trace',
    status: 'open',
    custody: 'sealed',
    ledger: 'append_only',
    environment: 'sandbox',
    created_at: new Date(now - 7200_000).toISOString(),
    ledger_entries: [
      { seq: 1, event: 'matter.created', at: new Date(now - 7200_000).toISOString() },
      { seq: 2, event: 'evidence.sealed', at: new Date(now - 5400_000).toISOString(), ref: synthId('ev', id) },
      { seq: 3, event: 'trace.started', at: new Date(now - 3600_000).toISOString() },
    ],
  });
};
