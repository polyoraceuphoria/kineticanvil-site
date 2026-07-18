#!/usr/bin/env node
// SEO / social / copy-discipline regression for kineticanvil.com
// Run: node scripts/check_seo.mjs
import { readFileSync, readdirSync } from 'fs';
import { join, resolve } from 'path';

const ROOT = resolve(import.meta.dirname || '.', '..');
let failures = 0;
let passes = 0;

function check(name, cond, detail) {
  if (cond) { passes++; console.log('PASS ' + name); }
  else { failures++; console.log('FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}

function read(rel) { return readFileSync(join(ROOT, rel), 'utf8'); }

const indexedPages = [
  'index.html', 'about.html', 'company.html', 'contact.html',
  'privacy.html', 'terms.html', 'trust.html', 'status.html',
];
const noindexPages = [
  'sandbox.html',
  'mandate/index.html', 'mandate/demo.html',
  ...readdirSync(join(ROOT, 'use-cases'))
    .filter(n => n.endsWith('.html'))
    .map(n => `use-cases/${n}`),
];
const allPages = [...indexedPages, ...noindexPages];

// ── 1. Forbidden claims (exact-string sweep) ────────────────────────────────
const forbidden = [
  { pat: 'court will accept',       label: 'court-will-accept' },
  { pat: 'court will approve',      label: 'court-will-approve' },
  { pat: 'court-ready',             label: 'court-ready' },
  { pat: 'Court-ready',             label: 'Court-ready' },
  { pat: 'built to stand in court', label: 'stand-in-court' },
  { pat: 'stand in court',          label: 'stand-in-court' },
  { pat: 'immutable',               label: 'immutable' },
  { pat: 'certifies the',           label: 'certifies-the' },
  { pat: 'without carrying the risk', label: 'carrying-the-risk' },
  { pat: 'AI-assisted',             label: 'AI-assisted' },
  { pat: 'AI assisted',             label: 'AI-assisted' },
  { pat: 'rights-holder',           label: 'rights-holder' },
  { pat: 'UNDER REVIEW',            label: 'UNDER-REVIEW badge' },
  { pat: 'pending counsel confirmation', label: 'pending-counsel' },
];
for (const page of allPages) {
  const html = read(page);
  for (const { pat, label } of forbidden) {
    check(`${page} omits "${label}"`, !html.includes(pat), `found "${pat}"`);
  }
}

// ── 2. Em-dash discipline ────────────────────────────────────────────────────
for (const page of allPages) {
  check(`${page} no em dash`, !read(page).includes('\u2014'));
}

// ── 3. Unique metadata ──────────────────────────────────────────────────────
const titles = new Map();
const descs = new Map();
for (const page of allPages) {
  const html = read(page);
  const tm = html.match(/<title>([^<]+)<\/title>/);
  const dm = html.match(/<meta\s+name="description"\s+content="([^"]+)"/);
  if (tm) {
    const t = tm[1];
    check(`${page} has <title>`, true);
    if (titles.has(t)) check(`${page} title unique`, false, `dup with ${titles.get(t)}`);
    else { titles.set(t, page); check(`${page} title unique`, true); }
  } else {
    check(`${page} has <title>`, false);
  }
  if (dm) {
    const d = dm[1];
    check(`${page} has description`, true);
    if (descs.has(d)) check(`${page} description unique`, false, `dup with ${descs.get(d)}`);
    else { descs.set(d, page); check(`${page} description unique`, true); }
  } else {
    check(`${page} has description`, false);
  }
}

// ── 4. Canonical and OG/Twitter fields ──────────────────────────────────────
for (const page of allPages) {
  const html = read(page);
  const canon = html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/);
  check(`${page} has canonical`, !!canon);

  const ogUrl = html.match(/<meta\s+property="og:url"\s+content="([^"]+)"/);
  if (canon && ogUrl) {
    check(`${page} canonical === og:url`, canon[1] === ogUrl[1],
      `canonical=${canon[1]} og:url=${ogUrl[1]}`);
  }

  const required = [
    'og:title', 'og:description', 'og:type', 'og:url', 'og:site_name',
    'og:image', 'og:image:width', 'og:image:height', 'og:image:alt',
  ];
  for (const prop of required) {
    check(`${page} has ${prop}`,
      new RegExp(`property="${prop}"\\s+content="[^"]+"`).test(html));
  }

  const twitterFields = ['twitter:card', 'twitter:title', 'twitter:description',
    'twitter:image', 'twitter:image:alt'];
  for (const field of twitterFields) {
    check(`${page} has ${field}`,
      new RegExp(`name="${field}"\\s+content="[^"]+"`).test(html));
  }

  // twitter:card should be summary_large_image
  const tc = html.match(/name="twitter:card"\s+content="([^"]+)"/);
  if (tc) check(`${page} twitter:card = summary_large_image`, tc[1] === 'summary_large_image');

  // theme-color
  check(`${page} has theme-color`,
    /name="theme-color"\s+content="[^"]+"/.test(html));

  // robots
  check(`${page} has robots meta`,
    /name="robots"\s+content="[^"]+"/.test(html));
}

// ── 5. Indexed vs noindex alignment ─────────────────────────────────────────
for (const page of indexedPages) {
  const html = read(page);
  check(`${page} robots allows indexing`,
    /name="robots"\s+content="index/.test(html));
}
for (const page of noindexPages) {
  const html = read(page);
  check(`${page} robots blocks indexing`,
    /name="robots"\s+content="noindex/.test(html));
}

// ── 6. Sitemap coverage ────────────────────────────────────────────────────
const sitemap = read('sitemap.xml');
for (const page of indexedPages) {
  // sandbox is noindex, should not be in sitemap
  if (page === 'sandbox.html') continue;
  const slug = page.replace('/index.html', '').replace('index.html', '').replace('.html', '');
  const url = slug ? `https://kineticanvil.com/${slug}` : 'https://kineticanvil.com/';
  check(`sitemap includes ${url}`, sitemap.includes(`<loc>${url}</loc>`));
}
// noindex pages must NOT be in sitemap
for (const page of noindexPages) {
  const slug = page.replace('/index.html', '').replace('index.html', '').replace('.html', '');
  check(`sitemap excludes ${slug || page}`,
    !sitemap.includes(`/${slug}`) || slug === '');
}
// sandbox is noindex, should not be in sitemap
check('sitemap excludes sandbox', !sitemap.includes('/sandbox'));
// lastmod present
check('sitemap has 2026-07-17 lastmod', sitemap.includes('2026-07-17'));

// ── 7. robots.txt references sitemap ────────────────────────────────────────
const robots = read('robots.txt');
check('robots.txt references sitemap', robots.includes('Sitemap: https://kineticanvil.com/sitemap.xml'));

// ── 8. OG image consistency ─────────────────────────────────────────────────
for (const page of allPages) {
  const html = read(page);
  const img = html.match(/property="og:image"\s+content="([^"]+)"/);
  if (img) {
    check(`${page} og:image is kineticanvil.com/og.png`,
      img[1] === 'https://kineticanvil.com/og.png');
  }
  const alt = html.match(/property="og:image:alt"\s+content="([^"]+)"/);
  if (alt) {
    check(`${page} og:image:alt correct`,
      alt[1] === 'Kinetic Anvil case operations infrastructure.');
  }
}

// ── Summary ─────────────────────────────────────────────────────────────────
console.log('\n' + (failures === 0 ? 'ALL SEO CHECKS PASSED' : failures + ' CHECK(S) FAILED')
  + ` (${passes} pass, ${failures} fail)`);
process.exit(failures === 0 ? 0 : 1);
