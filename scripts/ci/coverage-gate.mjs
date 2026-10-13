#!/usr/bin/env node
// Coverage gate (QA-32, delivery-strategy.md §3b).
// Usage: node scripts/ci/coverage-gate.mjs [--summary coverage/coverage-summary.json]
//        [--policy ci/coverage-policy.json] [--baseline ci/coverage-baseline.json]
import { readFileSync, existsSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const METRICS = ['lines', 'branches'];

function pct(m) {
  return m.total === 0 ? 100 : (m.covered / m.total) * 100;
}

/** Pure evaluation so the rules are unit-testable. Returns { ok, messages }. */
export function evaluate(summary, policy, baseline, root = process.cwd()) {
  const messages = [];
  let ok = true;
  const fail = (m) => { ok = false; messages.push(`FAIL: ${m}`); };
  const pass = (m) => messages.push(`ok:   ${m}`);

  const files = Object.entries(summary)
    .filter(([k]) => k !== 'total')
    .map(([k, v]) => [relative(root, resolve(root, k)).split('\\').join('/'), v]);
  const total = summary.total ?? { lines: { total: 0, covered: 0 }, branches: { total: 0, covered: 0 } };

  if (files.length === 0 || total.lines.total === 0) {
    messages.push('No app code under src/ yet: coverage gate passes vacuously (nothing to measure).');
    return { ok: true, messages };
  }

  // 1. Overall floor.
  for (const m of METRICS) {
    const p = pct(total[m]);
    const min = policy.overall[m];
    (p + 1e-9 >= min ? pass : fail)(`overall ${m} ${p.toFixed(2)}% (min ${min}%)`);
  }

  // 2. Safety-critical modules: 100% line and branch.
  for (const sc of policy.safetyCritical) {
    const matched = files.filter(([f]) => sc.paths.some((p) => f.startsWith(p)));
    if (matched.length === 0) {
      messages.push(`note: ${sc.name} (${sc.paths.join(', ')}) not present yet; nothing to check.`);
      continue;
    }
    for (const [f, v] of matched) {
      for (const m of METRICS) {
        const p = pct(v[m]);
        const min = policy.safetyCriticalMin[m];
        (p + 1e-9 >= min ? pass : fail)(`${sc.name}: ${f} ${m} ${p.toFixed(2)}% (min ${min}%)`);
      }
    }
  }

  // 3. No regression > maxDropPoints vs main's baseline.
  for (const m of METRICS) {
    const base = baseline?.[m];
    if (base === null || base === undefined) {
      messages.push(`note: no ${m} baseline on main yet; regression check skipped for ${m}.`);
      continue;
    }
    const p = pct(total[m]);
    const drop = base - p;
    (drop <= policy.maxDropPoints + 1e-9 ? pass : fail)(
      `${m} ${p.toFixed(2)}% vs main baseline ${base}% (drop ${drop.toFixed(2)} pts, max ${policy.maxDropPoints})`,
    );
  }
  return { ok, messages };
}

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : def;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const summaryPath = arg('summary', 'coverage/coverage-summary.json');
  const policy = JSON.parse(readFileSync(arg('policy', 'ci/coverage-policy.json'), 'utf8'));
  const baselinePath = arg('baseline', 'ci/coverage-baseline.json');
  const baseline = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, 'utf8')) : null;
  if (!existsSync(summaryPath)) {
    console.error(`FAIL: ${summaryPath} not found. Run "npm run coverage" first.`);
    process.exit(1);
  }
  const summary = JSON.parse(readFileSync(summaryPath, 'utf8'));
  const { ok, messages } = evaluate(summary, policy, baseline);
  console.log(messages.join('\n'));
  console.log(ok ? 'Coverage gate PASSED.' : 'Coverage gate FAILED.');
  process.exit(ok ? 0 : 1);
}
