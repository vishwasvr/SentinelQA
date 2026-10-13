#!/usr/bin/env node
// releases-path-check (delivery-strategy.md §3): a PR that touches releases/** must
// change nothing outside releases/**. Usage: node releases-path-check.mjs <base-sha> <head-sha>
// or pipe a newline-separated file list on stdin with --stdin.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function check(files) {
  const rel = files.filter((f) => f.startsWith('releases/'));
  if (rel.length === 0) return { ok: true, message: 'PR does not touch releases/**; nothing to check (pass).' };
  const other = files.filter((f) => !f.startsWith('releases/'));
  if (other.length) return { ok: false, message: 'FAIL: a PR touching releases/** must not change other files:\n  ' + other.join('\n  ') };
  return { ok: true, message: `Sign-off-only PR: ${rel.length} file(s), all under releases/**.` };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  let files;
  if (process.argv[2] === '--stdin') files = readFileSync(0, 'utf8').split('\n');
  else {
    const [base, head] = process.argv.slice(2);
    if (!base || !head) { console.log('releases-path-check: no PR base/head given (not a PR); pass.'); process.exit(0); }
    files = execFileSync('git', ['diff', '--name-only', `${base}...${head}`], { encoding: 'utf8' }).split('\n');
  }
  const r = check(files.map((f) => f.trim()).filter(Boolean));
  (r.ok ? console.log : console.error)(r.message);
  process.exit(r.ok ? 0 : 1);
}
