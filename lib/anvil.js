'use strict';
// Kinetic Anvil sandbox - shared helpers.
// Stateless, signed, synthetic-data sandbox. No database, no stored secrets
// beyond the HMAC signing key. Sandbox keys are signed tokens we can verify
// but never store, so they cannot be recovered after issuance.

const crypto = require('crypto');

const API_VERSION = '2026-06-11';
const DEV_FALLBACK_SECRET = 'dev-only-insecure-secret-set-ANVIL_SANDBOX_SECRET';
const SECRET = process.env.ANVIL_SANDBOX_SECRET || DEV_FALLBACK_SECRET;

// Hard-fail in production rather than sign keys with a forgeable default.
const IS_PROD = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
if (IS_PROD && (!process.env.ANVIL_SANDBOX_SECRET || SECRET === DEV_FALLBACK_SECRET)) {
  throw new Error('ANVIL_SANDBOX_SECRET must be set in production. Refusing to start with the insecure default.');
}

const ALLOWED_ORIGINS = [
  'https://kineticpartners.org',
  'https://www.kineticpartners.org',
  'https://kineticanvil.com',
  'https://www.kineticanvil.com',
  'https://docs.kineticanvil.com',
  'http://localhost:3000',
  'http://localhost:8080',
];

function cors(req, res) {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://kineticanvil.com');
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type,Idempotency-Key');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function preflight(req, res) {
  if (req.method === 'OPTIONS') {
    cors(req, res);
    res.statusCode = 204;
    res.end();
    return true;
  }
  return false;
}

function hmac(input) {
  return crypto.createHmac('sha256', SECRET).update(input).digest('hex');
}

// Issue a stateless sandbox key: kx_test_<keyId(12)><sig(24)>
function issueKey() {
  const keyId = crypto.randomBytes(6).toString('hex'); // 12 hex
  const sig = hmac('sandbox:' + keyId).slice(0, 24);
  return { key: 'kx_test_' + keyId + sig, key_id: 'key_' + keyId };
}

// Returns { ok, env, keyId } | { ok:false, reason }
function verifyKey(authHeader) {
  if (!authHeader || !/^Bearer\s+/i.test(authHeader)) {
    return { ok: false, reason: 'missing_bearer' };
  }
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (token.startsWith('kx_live_')) {
    return { ok: false, reason: 'live_not_provisioned' };
  }
  if (!token.startsWith('kx_test_')) {
    return { ok: false, reason: 'invalid_prefix' };
  }
  const body = token.slice('kx_test_'.length);
  if (body.length !== 36) return { ok: false, reason: 'malformed' };
  const keyId = body.slice(0, 12);
  const sig = body.slice(12);
  const expected = hmac('sandbox:' + keyId).slice(0, 24);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: 'bad_signature' };
  }
  return { ok: true, env: 'sandbox', keyId };
}

// Best-effort per-instance rate limiter (sandbox soft cap).
const _hits = new Map();
function rateLimited(ip, limit = 120, windowMs = 60000) {
  const now = Date.now();
  const rec = _hits.get(ip);
  if (!rec || now - rec.start > windowMs) {
    _hits.set(ip, { start: now, count: 1 });
    return false;
  }
  rec.count += 1;
  return rec.count > limit;
}

function clientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  return (xf ? String(xf).split(',')[0] : req.socket && req.socket.remoteAddress) || 'unknown';
}

// Deterministic-ish synthetic id from inputs.
function synthId(prefix, ...parts) {
  const h = hmac(parts.join('|') + ':' + crypto.randomBytes(4).toString('hex'));
  // base36-ish from hex
  const n = BigInt('0x' + h.slice(0, 16)).toString(36);
  return prefix + '_' + n.slice(0, 10);
}

function newRequestId() {
  return 'req_' + crypto.randomBytes(12).toString('hex').slice(0, 20);
}

function json(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Anvil-Environment', 'sandbox');
  res.setHeader('Anvil-Version', API_VERSION);
  let rid = res.getHeader('Anvil-Request-Id');
  if (!rid) { rid = newRequestId(); res.setHeader('Anvil-Request-Id', rid); }
  res.end(JSON.stringify(obj, null, 2));
}

// Typed, Stripe-shaped errors: { error: { type, code, message, doc_url, request_id } }
const ERROR_TYPES = {
  method_not_allowed: 'invalid_request_error',
  invalid_type: 'invalid_request_error',
  not_found: 'invalid_request_error',
  rate_limited: 'rate_limit_error',
  missing_bearer: 'authentication_error',
  invalid_prefix: 'authentication_error',
  malformed: 'authentication_error',
  bad_signature: 'authentication_error',
  live_not_provisioned: 'authentication_error',
};

function apiError(res, status, code, message, extra) {
  const rid = newRequestId();
  res.setHeader('Anvil-Request-Id', rid);
  const error = {
    type: ERROR_TYPES[code] || 'api_error',
    code,
    message,
    doc_url: 'https://docs.kineticanvil.com/errors#' + code,
    request_id: rid,
  };
  if (extra && typeof extra === 'object') Object.assign(error, extra);
  return json(res, status, { error });
}

async function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch { resolve({ _raw: data }); }
    });
    req.on('error', () => resolve({}));
  });
}

const CASE_TYPES = ['asset_trace', 'enforcement', 'sanctions_screen', 'recovery', 'audit'];

module.exports = {
  cors, preflight, json, apiError, readBody, issueKey, verifyKey,
  rateLimited, clientIp, synthId, hmac, CASE_TYPES, API_VERSION,
};
