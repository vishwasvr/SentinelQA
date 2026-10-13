#!/usr/bin/env node
// Seed fixture lint (ci-and-data-guards.md §3.1 guard 3, QA-34).
// Every record in seed/*.json must have isSample: true and only synthetic-looking values.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const EMAIL = /[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
const ALLOWED_DOMAINS = new Set(['example.com', 'example.org']);
const PHONE = /(?:\+?1[\s.-]?)?\(?(\d{3})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})\b/g;
// Controlled markers (DP-03 style, tolerant of punctuation): ITAR, CUI, CFR citations.
const MARKERS = [/\bI\W?T\W?A\W?R\b/i, /\bC\W?U\W?I\b/, /\b\d+\s*C\.?\s*F\.?\s*R\.?\b/i];

function strings(v, path = '$', out = []) {
  if (typeof v === 'string') out.push([path, v]);
  else if (Array.isArray(v)) v.forEach((x, i) => strings(x, `${path}[${i}]`, out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) strings(x, `${path}.${k}`, out);
  return out;
}

/** Returns a list of problems for one parsed fixture (never echoes matched text). */
export function lintFixture(data, file = '<fixture>') {
  const problems = [];
  const records = Array.isArray(data) ? data : Array.isArray(data?.records) ? data.records : null;
  if (!records) return [`${file}: expected an array or { records: [...] }`];
  records.forEach((r, i) => {
    const id = r?.id ?? `#${i}`;
    if (r?.isSample !== true) problems.push(`${file} record ${id}: missing isSample: true`);
    for (const [p, s] of strings(r)) {
      for (const m of s.matchAll(EMAIL)) {
        if (!ALLOWED_DOMAINS.has(m[1].toLowerCase())) problems.push(`${file} record ${id} ${p}: email domain not example.com/example.org`);
      }
      for (const m of s.matchAll(PHONE)) {
        if (!(m[2] === '555' && /^01\d\d$/.test(m[3]))) problems.push(`${file} record ${id} ${p}: phone number outside 555-01xx`);
      }
      MARKERS.forEach((re, k) => { if (re.test(s)) problems.push(`${file} record ${id} ${p}: controlled marker M${k + 1}`); });
    }
  });
  return problems;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dir = process.argv[2] ?? 'seed';
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')) : [];
  if (files.length === 0) {
    console.log(`seed-fixture-lint: no fixtures in ${dir}/ yet; nothing to check (pass).`);
    process.exit(0);
  }
  const problems = files.flatMap((f) => lintFixture(JSON.parse(readFileSync(join(dir, f), 'utf8')), f));
  if (problems.length) { console.error('FAIL:\n  ' + problems.join('\n  ')); process.exit(1); }
  console.log(`seed-fixture-lint: ${files.length} fixture file(s) OK.`);
}
