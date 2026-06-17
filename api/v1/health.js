'use strict';
const { cors, preflight, json } = require('../../lib/anvil');

// GET /v1/health  (no auth)
module.exports = async function handler(req, res) {
  if (preflight(req, res)) return;
  cors(req, res);
  return json(res, 200, {
    status: 'operational',
    environment: 'sandbox',
    api: 'kinetic-anvil',
    version: 'v1',
    time: new Date().toISOString(),
  });
};
