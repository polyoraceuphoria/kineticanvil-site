#!/usr/bin/env node
// Regression tests for the freeze-protocol-portal PR.
// Run: node scripts/regression.mjs
import { readFileSync, existsSync, statSync } from 'fs';
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
const heroStart = idx.indexOf('<section class="hero">');
const heroEnd = idx.indexOf('</section>', heroStart);
const hero = idx.slice(heroStart, heroEnd);
check('no termRun button id', !idx.includes('id="termRun"'));
check('no /api/sandbox-key fetch in hero', !hero.includes("fetch('/api/sandbox-key'"));
check('no /v1/matters fetch in hero', !hero.includes("fetch('/v1/matters'"));
check('hero shows EXAMPLE label', hero.includes('>EXAMPLE</span>'));
check('hero posts to canonical /v1/jobs route', hero.includes('POST /v1/jobs') && hero.includes('https://api.kineticanvil.com/v1/jobs'));
check('hero forbids nonexistent /v3/crypto.trace route', !hero.includes('/v3/crypto.trace'));
check('hero sends crypto.trace job type', /-d<\/span>\s*<span class="c-str">'\{ "type": "crypto\.trace"/.test(hero));
check('hero nests address and chain under input', /-d<\/span>\s*<span class="c-str">'\{[^']*"input": \{ "address": "0xabc", "chain": "eth" \}/.test(hero));
check('hero returns Job object', hero.includes('>"object"</span>: <span class="c-str">"job"</span>'));
check('hero returns queued status', hero.includes('>"status"</span>: <span class="c-str">"queued"</span>'));
check('hero retains dated Anvil-Version header', hero.includes('"Anvil-Version: 2026-07-05"'));

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
// 6. Restrained portal boundaries
// ──────────────────────────────────────────────────────
check('crypto.trace is the sole available verb shown', idx.includes('AVAILABLE VERB') && idx.includes('crypto.trace'));
check('home does not label verbs live', !idx.includes('LIVE VERB'));
check('home has no planned capability cards', !idx.includes('PLANNED'));
check('home has no Use Cases navigation or section', !idx.includes('Use Cases') && !idx.includes('id="use-cases"') && !idx.includes('href="/use-cases'));
check('home has no Mandate navigation or section', !idx.includes('Mandate') && !idx.includes('href="/mandate'));
check('home has no immutable claim', !idx.toLowerCase().includes('immutable'));
check('home has no production availability claim', !idx.toLowerCase().includes('available now in sandbox and production'));
check('home copy centers protocol contract', idx.includes('CURRENT CONTRACT') && idx.includes('PROTOCOL POSTURE'));
check('home states release-header semantics plainly', idx.includes('VERSION HEADER') && idx.includes('Current release') && idx.includes('Responses report release <span class="mono">2026-07-05</span> through the Anvil-Version header. Clients should send the header on every request.'));
check('home makes no version-pin claim', !idx.includes('VERSION PIN') && !idx.includes('Requests identify contract version'));
check('restrained footer omits Meridian and CipherBlade', !idx.includes('meridianoffice.org') && !idx.includes('Meridian Recovery') && !idx.includes('cipherblade.com') && !idx.includes('CipherBlade'));

const hiddenPages = [
  'mandate/index.html',
  'mandate/demo.html',
  'use-cases/index.html',
  'use-cases/judgment-recovery.html',
  'use-cases/crypto-fraud-tracing.html',
  'use-cases/receiver-operations.html',
  'use-cases/sar-support.html',
  'use-cases/stablecoin-recovery.html',
  'use-cases/exchange-enforcement.html',
  'use-cases/multi-claimant-waterfall.html',
  'use-cases/ofac-sanctions-clearance.html',
];
for (const page of hiddenPages) {
  check(`${page} is noindex`, read(page).includes('<meta name="robots" content="noindex, nofollow">'));
}
const sitemap = read('sitemap.xml');
check('sitemap omits retained noindex page families', !sitemap.includes('/mandate') && !sitemap.includes('/use-cases'));

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
