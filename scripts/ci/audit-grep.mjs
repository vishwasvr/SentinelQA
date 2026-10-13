#!/usr/bin/env node
// Backup grep for the audit lint rule (audit-write-path.md §1): no file under src/
// outside src/shared/audit/ may mention AUDIT_TABLE.
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export function findViolations(root = 'src') {
  const out = [];
  if (!existsSync(root)) return out;
  const walk = (d) => {
    for (const e of readdirSync(d)) {
      const p = join(d, e);
      if (statSync(p).isDirectory()) { walk(p); continue; }
      if (!/\.(ts|js|mjs|cjs|tsx)$/.test(p)) continue;
      const rel = p.split('\\').join('/');
      if (rel.startsWith('src/shared/audit/')) continue;
      if (readFileSync(p, 'utf8').includes('AUDIT_TABLE')) out.push(rel);
    }
  };
  walk(root);
  return out;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const v = findViolations();
  if (v.length) {
    console.error('FAIL: AUDIT_TABLE referenced outside src/shared/audit/ (use buildAuditPut):\n  ' + v.join('\n  '));
    process.exit(1);
  }
  console.log('audit-grep: no AUDIT_TABLE references outside src/shared/audit/.');
}
