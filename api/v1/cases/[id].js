'use strict';
const { cors, preflight, json, verifyKey, synthId } = require('../../../lib/anvil');

// GET /v1/cases/:id   retrieve a synthetic case (sandbox)
module.exports = async function handler(req, res) {
  if (preflight(req, res)) return;
  cors(req, res);

  const v = verifyKey(req.headers.authorization);
  if (!v.ok) {
    const code = v.reason === 'live_not_provisioned' ? 402 : 401;
    return json(res, code, { error: v.reason, docs: 'https://docs.kineticanvil.com' });
  }

  if (req.method !== 'GET') {
    return json(res, 405, { error: 'method_not_allowed', message: 'Use GET to retrieve a case.' });
  }

  const id = (req.query && req.query.id) || 'cs_unknown';
  const now = Date.now();
  return json(res, 200, {
    object: 'case',
    case_id: id,
    type: 'asset_trace',
    status: 'open',
    custody: 'sealed',
    ledger: 'append_only',
    environment: 'sandbox',
    created_at: new Date(now - 7200_000).toISOString(),
    ledger_entries: [
      { seq: 1, event: 'case.created', at: new Date(now - 7200_000).toISOString() },
      { seq: 2, event: 'evidence.sealed', at: new Date(now - 5400_000).toISOString(), ref: synthId('ev', id) },
      { seq: 3, event: 'trace.started', at: new Date(now - 3600_000).toISOString() },
    ],
  });
};
