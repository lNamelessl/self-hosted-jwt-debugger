#!/usr/bin/env node
/**
 * Build gate for the privacy claim: scan everything in dist/ for external http(s)
 * URLs. Only identifiers that are NEVER fetched by the browser may pass (documented
 * in ALLOW below). Any real external resource (fonts, scripts, images, beacons,
 * prefetch/preconnect, API calls) fails the build.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../dist', import.meta.url).pathname.replace(/^\/([A-Za-z]):/, '$1:');

/** url pattern -> why it is safe (must never be fetched automatically). */
const ALLOW = [
  /https?:\/\/(www\.)?w3\.org[^"'\s<>`]*/g, // SVG/XML namespace identifiers, not resources
  /https?:\/\/react\.dev[^"'\s<>`]*/g, // React error-decoder strings — shown only if an error is thrown
  /https?:\/\/reactjs\.org[^"'\s<>`]*/g, // legacy React license/error URLs
  /https?:\/\/(www\.)?openjsf\.org[^"'\s<>`]*/g, // license comments
  /https?:\/\/js\.foundation[^"'\s<>`]*/g, // license comments
];

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) yield* walk(p);
    else yield p;
  }
}

const offenders = [];
let files = 0;
for (const file of walk(ROOT)) {
  if (!/\.(js|css|html|svg|json|txt)$/.test(file)) continue;
  files += 1;
  const text = readFileSync(file, 'utf8');

  // 1. Hard fail: any external resource tag in the shipped HTML.
  if (file.endsWith('.html')) {
    for (const m of text.matchAll(/<(?:script|link|img|iframe|source|embed|object|track)\b[^>]*?\b(?:src|href)=["']https?:\/\//gi)) {
      offenders.push({ file: relative(file), match: m[0].slice(0, 120), reason: 'external resource tag in HTML' });
    }
  }

  // 2. Any http(s) URL not covered by the documented allowlist.
  const remaining = text.replace(new RegExp(ALLOW.map((r) => r.source).join('|'), 'g'), '');
  for (const m of remaining.matchAll(/https?:\/\/[^\s"'<>`\\)\]}]+/g)) {
    offenders.push({ file: relative(file), match: m[0].slice(0, 120), reason: 'undocumented external URL' });
  }
}

function relative(file) {
  return file.slice(ROOT.length + 1);
}

if (offenders.length > 0) {
  console.error('\n✗ External reference check FAILED — the offline/no-external-requests claim is at risk:\n');
  for (const o of offenders) console.error(`  ${o.file}\n    ${o.reason}\n    ${o.match}\n`);
  console.error('Fix the source or extend scripts/check-external-refs.mjs ALLOW with a documented reason.\n');
  process.exit(1);
}
console.log(`✓ External reference check passed (${files} files, no fetchable external URLs).`);
