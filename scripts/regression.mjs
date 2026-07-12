#!/usr/bin/env node
// Regression tests for the restrained Kinetic Anvil protocol portal.
// Run: node scripts/regression.mjs
import { readFileSync, existsSync, statSync, readdirSync } from 'fs';
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

function section(html, marker) {
  const start = html.indexOf(marker);
  const end = html.indexOf('</section>', start);
  return start >= 0 && end >= 0 ? html.slice(start, end) : '';
}

const indexedPages = [
  'index.html', 'sandbox.html', 'status.html', 'trust.html', 'about.html',
  'company.html', 'contact.html', 'privacy.html', 'terms.html',
];
const hiddenPages = [
  'mandate/index.html',
  'mandate/demo.html',
  ...readdirSync(join(ROOT, 'use-cases'))
    .filter((name) => name.endsWith('.html'))
    .map((name) => `use-cases/${name}`),
];
const idx = read('index.html');
const hero = section(idx, '<section class="hero">');
const sandbox = read('sandbox.html');
const mandate = read('mandate/index.html');
const statusPage = read('status.html');
const about = read('about.html');
const allIndexed = indexedPages.map(read).join('\n');
const allPages = [...indexedPages, ...hiddenPages].map(read).join('\n');

// 1. Required visual and social assets
check('og.png exists', existsSync(join(ROOT, 'og.png')));
check('og.png is non-trivial size', statSync(join(ROOT, 'og.png')).size > 1000);

// 2. Static, canonical developer proof
check('hero is static with no run button', !idx.includes('id="termRun"'));
check('hero performs no API fetch', !/fetch\s*\(/.test(hero));
check('hero labels the terminal example', hero.includes('>EXAMPLE</span>'));
check('hero posts to canonical /v1/jobs', hero.includes('POST /v1/jobs') && hero.includes('https://api.kineticanvil.com/v1/jobs'));
check('hero sends crypto.trace job type', /-d<\/span>\s*<span class="c-str">'\{ "type": "crypto\.trace"/.test(hero));
check('hero nests address and chain under input', /"input": \{ "address": "0xabc", "chain": "eth" \}/.test(hero));
check('hero response echoes submitted input', hero.includes('>"address"</span>: <span class="c-str">"0xabc"</span>') && hero.includes('>"chain"</span>: <span class="c-str">"eth"</span>'));
check('hero returns Job object', hero.includes('>"object"</span>: <span class="c-str">"job"</span>'));
check('hero returns queued status', hero.includes('>"status"</span>: <span class="c-str">"queued"</span>'));
check('hero uses dated Anvil-Version header', hero.includes('"Anvil-Version: 2026-07-05"'));
check('hero links to live sandbox instead of calling it', hero.includes('Static example.') && hero.includes('href="/sandbox"'));

// 3. Two readers, one clear hierarchy
check('hero states protocol infrastructure outcome', idx.includes('Protocol infrastructure for <em>financial fraud recovery</em>'));
check('hero names contract primitives', idx.includes('recovery records, asynchronous Jobs, signed events, and audit output'));
check('homepage exposes explicit build path', idx.includes('>BUILD</span>API, SDKs, and quickstart'));
check('homepage exposes explicit evaluation path', idx.includes('>EVALUATE</span>Contract, controls, and access'));
check('homepage offers sandbox and docs primary paths', hero.includes('START IN THE SANDBOX') && hero.includes('READ THE DOCS'));
check('homepage offers institutional diligence path', idx.includes('INSTITUTIONAL ACCESS') && idx.includes('security diligence'));
check('homepage includes technical and academic reference', idx.includes('Technical and academic materials') && idx.includes('Academic inquiry'));

// 4. Current contract facts
check('homepage shows dated version', idx.includes('VERSION 2026-07-05'));
check('homepage avoids ambiguous v3 badge', !idx.includes('>v3</div>'));
check('homepage shows 45 operations', idx.includes('>45</div><div class="l">OPERATIONS</div>'));
check('homepage shows 11 resources', idx.includes('>11</div><div class="l">RESOURCES</div>'));
check('homepage shows 23 enforced scopes', idx.includes('>23</div><div class="l">ENFORCED SCOPES</div>'));
check('homepage shows 21 webhook events', idx.includes('>21</div><div class="l">WEBHOOK EVENTS</div>'));
check('homepage shows all 11 resource labels', ['Matters','Parties','Judgments','Jobs','Trace','Packets','Ledger','Events','Webhooks','Organization','Health'].every((name) => idx.includes(`<span>${name}</span>`)));
check('homepage names crypto.trace as the current verb', idx.includes('AVAILABLE NOW') && idx.includes('crypto.trace'));
check('homepage states unavailable verb behavior', idx.includes('verb_not_available'));
check('homepage shows job retrieval path', idx.includes('GET /v1/jobs/{job_id}'));
check('homepage surfaces SDK languages and license', idx.includes('PYTHON + TYPESCRIPT SDKs · APACHE-2.0'));
check('homepage surfaces OpenAPI 3.1', idx.includes('OPENAPI 3.1'));
check('homepage surfaces signed webhooks', idx.includes('Twenty-one event types use signed webhooks'));
check('homepage states no client funds', idx.includes('Kinetic Anvil holds no client funds'));

// 5. Removed or unsupported claims and storefront residue
const forbiddenClaims = [
  '99.9%', '120ms', '$2,500', 'BAA', 'CJIS', 'IL4', 'On-premise',
  'on-prem', 'Success-fee', 'success-fee', 'Standard SLA',
];
for (const claim of forbiddenClaims) {
  check(`homepage omits unsupported claim: ${claim}`, !idx.includes(claim));
}
check('homepage has no pricing section', !idx.includes('PRICING') && !idx.includes('id="pricing"'));
check('homepage has no Mandate promotion', !idx.includes('Mandate') && !idx.includes('href="/mandate'));
check('homepage has no Use Cases promotion', !idx.includes('Use Cases') && !idx.includes('href="/use-cases'));
check('homepage has no live production availability claim', !idx.toLowerCase().includes('available now in sandbox and production'));
check('homepage has no immutable claim', !idx.toLowerCase().includes('immutable'));
check('homepage has no one-business-day promise', !/within one business day/i.test(idx));
check('homepage has no Book a demo language', !/book a demo/i.test(idx));

// 6. Sandbox correctness and access path
check('sandbox shows 45 contract operations', sandbox.includes('<b>45</b> contract operations'));
check('sandbox removes stale 114 operations claim', !sandbox.includes('<b>114</b> operations') && !sandbox.includes('114 operations'));
check('sandbox names crypto.trace as available', sandbox.includes('<span class="mono">crypto.trace</span> available'));
check('sandbox removes broad all-scopes claim', !sandbox.includes('All sandbox scopes'));
check('sandbox removes dead pricing anchor', !sandbox.includes('/#pricing'));
check('sandbox links exact Postman collection', sandbox.includes('kinetic-anvil.postman_collection.json'));
check('sandbox surfaces SDK source and Apache license', sandbox.includes('SDK source under Apache-2.0'));
check('sandbox frames production access as contact', sandbox.includes('contact Kinetic') && sandbox.includes('production access'));

// 7. Navigation and page-family boundaries
for (const page of indexedPages) {
  const html = read(page);
  check(`${page} has protocol nav`, html.includes('<a href="/">Protocol</a>'));
  check(`${page} nav omits Mandate and Use Cases`, !html.includes('href="/mandate') && !html.includes('href="/use-cases'));
  check(`${page} footer omits Meridian and CipherBlade`, !html.includes('meridianoffice.org') && !html.includes('cipherblade.com'));
  check(`${page} has no one-business-day promise`, !/within one business day/i.test(html));
}
for (const page of hiddenPages) {
  check(`${page} is noindex`, read(page).includes('<meta name="robots" content="noindex, nofollow">'));
}
const sitemap = read('sitemap.xml');
check('sitemap omits retained hidden families', !sitemap.includes('/mandate') && !sitemap.includes('/use-cases'));
check('mandate has no $500 storefront price', !mandate.includes('$500'));
check('mandate has no per-matter pricing text', !mandate.includes('per matter beyond'));
check('mandate pricing area is access-only', mandate.includes('Pricing and access'));

// 8. About, contact, status, and trust posture
check('about page uses protocol framing', about.includes('A defined protocol for <em>recovery systems</em>'));
check('about page removes intake-to-remittance framing', !/intake to remittance/i.test(about));
check('about page removes tiered access claim', !/tiered access model/i.test(about));
check('status page has no unverified public response-time table', !/business hour|business hours|business day|business days/i.test(statusPage));
check('status page frames support terms per engagement', statusPage.includes('Contractual support terms are set per engagement'));
check('all indexed contact copy avoids Book a demo', !/book a demo/i.test(allIndexed));
check('all portal pages avoid unsupported response deadline', !/within one business day/i.test(allPages));

// 9. Claim-risk contradictions

check('portal footers avoid unconfirmed rights-holder assertion', !allPages.includes('&copy; 2026 Kinetic Digital Partners Inc.') && !allPages.includes('© 2026 Kinetic Digital Partners Inc.'));
check('trust avoids every-operation event overclaim', !/Every operation writes an event/i.test(read('trust.html')));
check('trust avoids unsupported history export claim', !/full history is exportable at any time/i.test(read('trust.html')));
check('trust makes no SOC 2 claim', !/SOC 2/i.test(read('trust.html')));
check('sandbox avoids full-surface overclaim', !/full(?: Kinetic Anvil| API)? surface/i.test(sandbox));
check('sandbox metadata uses approved current-contract language', sandbox.includes('Generate a Kinetic Anvil sandbox API key for the current contract and synthetic data.'));
check('sandbox avoids self-serve revoke or rotate claim', !/self-serve revoke|self-serve rotate|revoke and rotate/i.test(sandbox));
check('privacy has no fixed retention or response deadline', !/up to 12 months|within 30 days/i.test(read('privacy.html')));
check('terms states SDK and server license boundary', read('terms.html').includes('Source SDK code is separately available under Apache-2.0') && read('terms.html').includes('API server and execution runners are proprietary'));

// 10. Accessibility and semantic minimums
check('homepage has main element', idx.includes('<main id="main-content">'));
check('homepage has skip link', idx.includes('class="skip-link" href="#main-content"'));
check('homepage primary nav is labelled', idx.includes('<nav class="nav-links" aria-label="Primary">'));
check('homepage mobile nav is labelled', idx.includes('<nav class="mobile-menu-links" aria-label="Mobile">'));
check('homepage terminal has descriptive label', idx.includes('aria-label="Static API request and response example"'));
check('homepage has a single h1', (idx.match(/<h1[ >]/g) || []).length === 1);

// 11. Runtime and integration safety
const anvil = read('lib/anvil.js');
const statusApi = read('api/status.js');
const statusSmoke = read('scripts/smoke_status.mjs');
check('API_VERSION is 2026-07-05', anvil.includes("API_VERSION = '2026-07-05'"));
check('dead CASE_TYPES export removed', !anvil.includes('CASE_TYPES'));
check('status endpoint omits private Console probe', !statusApi.includes("name: 'Console'") && !statusApi.includes('/dashboard'));
check('status smoke guards against Console probe', statusSmoke.includes('no private console endpoint probed'));
const vercel = read('vercel.json');
check('CSP connect-src includes PostHog', vercel.includes('https://us.i.posthog.com'));
check('CSP script-src includes PostHog assets', vercel.includes('https://us-assets.i.posthog.com'));
check('mock api/v1 directory remains removed', !existsSync(join(ROOT, 'api/v1')));
check('no /v1 rewrite in vercel.json', !vercel.includes('/v1/:path'));

// 12. Copy discipline
check('no em dash in indexed pages', !allIndexed.includes('\u2014'));
check('no em dash in mandate page', !mandate.includes('\u2014'));
check('indexed pages omit m1k3d0w stamp', !/m1k3d0w/i.test(allIndexed));

console.log('\n' + (failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED') + ` (${passes} pass, ${failures} fail)`);
process.exit(failures === 0 ? 0 : 1);
