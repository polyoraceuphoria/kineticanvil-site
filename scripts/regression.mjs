#!/usr/bin/env node
// Regression tests for the freeze-protocol-portal PR.
// Run: node scripts/regression.mjs
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';

const ROOT = resolve(import.meta.dirname || '.', '..');
let failures = 0;
let passes = 0;

function check(name, cond, detail) {
  if (cond) {
    passes++;
    console.log('PASS ' + name);
  } else {
    failures++;
    console.log('FAIL ' + name + (detail ? ' :: ' + detail : ''));
  }
}

function read(rel) {
  return readFileSync(join(ROOT, rel), 'utf8');
}

// ──────────────────────────────────────────────────────
// 1. og.png exists
// ──────────────────────────────────────────────────────
check('og.png exists', existsSync(join(ROOT, 'og.png')));
check('og.png is non-trivial size', statSync(join(ROOT, 'og.png')).size > 1000);

// ──────────────────────────────────────────────────────
// 2. Hero terminal is static (no Run button, no fetch)
// ──────────────────────────────────────────────────────
const idx = read('index.html');
check('no termRun button id', !idx.includes('id="termRun"'));
check('no /api/sandbox-key fetch in hero', !idx.includes("fetch('/api/sandbox-key'"));
check('no /v1/matters fetch in hero', !idx.includes("fetch('/v1/matters'"));
check('hero shows EXAMPLE label', idx.includes('>EXAMPLE</span>'));
check('hero shows crypto.trace', idx.includes('crypto.trace'));

// ──────────────────────────────────────────────────────
// 3. Current facts: v3, 2026-07-05, 45 ops, 11 resources, 120 rpm
// ──────────────────────────────────────────────────────
check('specs show v3', idx.includes('>v3</div>'));
check('specs show 2026-07-05', idx.includes('2026-07-05'));
check('specs show 45 operations', idx.includes('>45</div>'));
check('specs show 11 resources', idx.includes('>11</div>'));
check('specs show 120 rpm sandbox', idx.includes('>120</div>'));

// ──────────────────────────────────────────────────────
// 4. Removed claims
// ──────────────────────────────────────────────────────
check('no 99.9% uptime claim', !idx.includes('99.9%'));
check('no <120ms latency claim', !idx.includes('120ms'));
check('no $2,500 pricing', !idx.includes('$2,500'));
check('no BAA claim', !idx.includes('BAA'));
check('no CJIS claim', !idx.includes('CJIS'));
check('no IL4 claim', !idx.includes('IL4'));
check('no on-premise claim', !idx.includes('On-premise') && !idx.includes('on-prem'));
check('no success-fee claim', !idx.includes('Success-fee') && !idx.includes('success-fee'));
check('no Operator $2,500 card', !idx.includes('Operator'));
check('no Standard SLA claim on index', !idx.includes('Standard SLA'));
check('no pricing section', !idx.includes('§ 06 · PRICING'));

// ──────────────────────────────────────────────────────
// 5. Mandate page: no storefront pricing
// ──────────────────────────────────────────────────────
const mandate = read('mandate/index.html');
check('mandate no $500 price', !mandate.includes('$500'));
check('mandate no per matter pricing text', !mandate.includes('per matter beyond'));
check('mandate pricing section replaced with access', mandate.includes('Pricing and access'));

// ──────────────────────────────────────────────────────
// 6. Planned vs live capabilities
// ──────────────────────────────────────────────────────
check('crypto.trace marked LIVE', idx.includes('>LIVE</div>'));
check('Case Protocol marked PLANNED', idx.includes('>PLANNED</div>'));

// ──────────────────────────────────────────────────────
// 7. Accessibility: <main>, skip link
// ──────────────────────────────────────────────────────
check('has <main> element', idx.includes('<main'));
check('has skip-link', idx.includes('skip-link'));
check('has id=main-content', idx.includes('id="main-content"'));

// ──────────────────────────────────────────────────────
// 8. API version updated in lib/anvil.js
// ──────────────────────────────────────────────────────
const anvil = read('lib/anvil.js');
check('API_VERSION is 2026-07-05', anvil.includes("API_VERSION = '2026-07-05'"));

// ──────────────────────────────────────────────────────
// 9. CSP includes PostHog
// ──────────────────────────────────────────────────────
const vercel = read('vercel.json');
check('CSP connect-src includes PostHog', vercel.includes('https://us.i.posthog.com'));
check('CSP script-src includes PostHog assets', vercel.includes('https://us-assets.i.posthog.com'));

// ──────────────────────────────────────────────────────
// 10. Mock routes deleted
// ──────────────────────────────────────────────────────
check('api/v1 directory removed', !existsSync(join(ROOT, 'api/v1')));
check('no /v1/ rewrite in vercel.json', !vercel.includes('/v1/:path'));

// ──────────────────────────────────────────────────────
// 11. Broken tools link fixed
// ──────────────────────────────────────────────────────
const sandbox = read('sandbox.html');
check('no #tools anchor in sandbox', !sandbox.includes('#tools'));

// ──────────────────────────────────────────────────────
// 12. No em dashes
// ──────────────────────────────────────────────────────
check('no em dash in index.html', !idx.includes('\u2014'));
check('no em dash in mandate/index.html', !mandate.includes('\u2014'));

// ──────────────────────────────────────────────────────
// 13. No pricing footer links
// ──────────────────────────────────────────────────────
check('no /#pricing link in index footer', !idx.includes('/#pricing'));
check('no mandate#pricing link in index footer', !idx.includes('mandate#pricing'));

// ──────────────────────────────────────────────────────
// Summary
// ──────────────────────────────────────────────────────
console.log('\n' + (failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED') + ` (${passes} pass, ${failures} fail)`);
process.exit(failures === 0 ? 0 : 1);
