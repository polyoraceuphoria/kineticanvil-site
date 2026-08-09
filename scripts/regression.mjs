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
  'company.html', 'contact.html', 'privacy.html', 'terms.html', 'trace.html',
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
const publicArtifactFiles = [
  ...indexedPages,
  ...hiddenPages,
  'analytics.js', 'lib/anvil.js', 'vercel.json', 'sitemap.xml', 'robots.txt',
];
const allPublicArtifacts = publicArtifactFiles.map(read).join('\n');

// 1. Required visual and social assets
check('og.png exists', existsSync(join(ROOT, 'og.png')));
check('og.png is non-trivial size', statSync(join(ROOT, 'og.png')).size > 1000);

// 2. Product-first hero and five-second comprehension
check('hero leads with the product outcome', hero.includes('The system of record for <em>crypto enforcement</em>.'));
check('hero explains the product loop', hero.includes('traces BTC and ETH fund flows and writes every result back to the matter record'));
check('hero avoids API-first category language', !hero.includes('PROTOCOL API') && !hero.includes('dated API contract'));
check('hero avoids terminal or curl as the main visual', !hero.includes('curl -X') && !hero.includes('term-body'));
check('hero shows the matter record', hero.includes('Recovery record') && hero.includes('matter_demo_04'));
check('hero shows the fund-flow map writeback', hero.includes('Fund-flow map') && hero.includes('RESULT ATTACHED'));
check('hero labels its visual as synthetic', hero.includes('SYNTHETIC EXAMPLE · PRODUCT FLOW'));
check('hero identifies the current capability', hero.includes('crypto.trace'));
check('hero primary CTA explores the sandbox', hero.includes('EXPLORE THE SANDBOX'));
check('hero secondary CTA explains the product', hero.includes('SEE WHAT ANVIL DOES'));

// 3. Product truth and current capability
check('homepage explains one durable matter record', idx.includes('One record for the matter and the trace'));
check('homepage connects matter context', idx.includes('Connect parties, judgment data, wallet inputs, jobs, trace maps, packets, ledger entries, and events'));
check('homepage states bounded multi-hop tracing', idx.includes('Trace BTC or ETH outflows across bounded hops'));
check('homepage states results written back', idx.includes('writes every result back to the matter record') && idx.includes('Write back the result'));
check('homepage describes conservative hypotheses', idx.includes('confidence-labeled hypotheses'));
check('homepage avoids unsupported direction input', !idx.includes('direction, and hop limit'));
check('public portal artifacts do not expose trace vendors', !/Blockscout|mempool\.space/i.test(allPublicArtifacts));
check('homepage omits real-as-qualifier', !/\breal\b/i.test(idx));
check('all public HTML omits real-as-qualifier', !/\breal\b/i.test(allPages));
check('homepage visible copy stays concise', idx.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' ').trim().split(/\s+/).length < 700);
check('homepage keeps the three product story cards', ['Keep the matter','Follow the fund flow','Write back the result'].every((name) => idx.includes(`<h3>${name}</h3>`)));
check('homepage keeps verb availability off the page', !idx.includes('return 422') && !idx.includes('are available'));

// 4. Technical proof section removed (dow 2026-08-06); boundary lives in contract terms and /trust
check('homepage omits the technical proof section', !idx.includes('TECHNICAL PROOF') && !idx.includes('id="proof"'));
check('homepage renumbers access to section 02', idx.includes('§ 02 · ACCESS') && idx.indexOf('§ 02 · ACCESS') > idx.indexOf('§ 01 · PRODUCT'));
check('trust page keeps the no-custody boundary', read('trust.html').includes('Kinetic Anvil never takes custody of funds'));
check('homepage avoids ambiguous v3 badge', !idx.includes('>v3</div>'));
check('homepage preserves institutional and academic paths', idx.includes('Institutional inquiry') && idx.includes('Academic inquiry'));

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
check('sandbox names all three live verbs as available', sandbox.includes('crypto.trace</span>,') && sandbox.includes('crypto.monitor</span>,') && sandbox.includes('impersonation.monitor</span> available'));
check('sandbox removes broad all-scopes claim', !sandbox.includes('All sandbox scopes'));
check('sandbox removes dead pricing anchor', !sandbox.includes('/#pricing'));
check('sandbox links exact Postman collection', sandbox.includes('kinetic-anvil.postman_collection.json'));
check('sandbox surfaces SDK source and Apache license', sandbox.includes('SDK source under Apache-2.0'));
check('sandbox frames production access as contact', sandbox.includes('contact Kinetic') && sandbox.includes('production access'));

// 7. Navigation and page-family boundaries
for (const page of indexedPages) {
  const html = read(page);
  check(`${page} has product nav`, html.includes('<a href="/">Product</a>'));
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
check('homepage product visual has descriptive label', idx.includes('aria-label="Synthetic example showing a matter record, a multi-hop fund-flow trace, and the result written back"'));
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

// 13. crypto.trace object page truth
const trace = read('trace.html');
check('trace page has a single h1', (trace.match(/<h1[ >]/g) || []).length === 1);
check('trace page leads with one object one address', trace.includes('One object. The complete answer to <em>one address</em>.'));
check('trace page labels the terminal synthetic', trace.includes('SYNTHETIC EXAMPLE · MCP SPECIFICATION PREVIEW'));
check('trace page states crypto.trace is live', trace.includes('crypto.trace</span> is live'));
check('trace page keeps MCP surface as specification', trace.includes('MCP surface in specification') && trace.includes('is specified against the same contract'));
check('trace page marks resolvers specified not live', trace.includes('address.resolve') && trace.includes('transaction.resolve') && trace.includes('>SPECIFIED</span>'));
check('trace page states specified capabilities are not callable', trace.includes('They are not yet callable.'));
check('trace page keeps dispatch governed', trace.includes('Dispatch is governed'));
check('trace page states bounded hops', trace.includes('bounded hops'));
check('trace page has no pricing residue', !trace.includes('PRICING') && !/\$\d/.test(trace.replace(/<script[\s\S]*?<\/script>/g, '')));
check('trace page keeps envelope provider-neutral framing', trace.includes('provider-neutral') && trace.includes('Sealed sources'));
check('homepage links the trace page', idx.includes('<a href="/trace">crypto.trace</a>'));
check('sitemap includes trace page', sitemap.includes('<loc>https://kineticanvil.com/trace</loc>'));

console.log('\n' + (failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED') + ` (${passes} pass, ${failures} fail)`);
process.exit(failures === 0 ? 0 : 1);
