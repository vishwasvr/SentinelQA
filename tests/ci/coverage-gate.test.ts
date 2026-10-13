import { describe, expect, it } from 'vitest';
import { evaluate } from '../../scripts/ci/coverage-gate.mjs';
import policy from '../../ci/coverage-policy.json' with { type: 'json' };

const m = (covered: number, total = 100) => ({ total, covered, skipped: 0, pct: 0 });
const file = (l: number, b: number) => ({ lines: m(l), branches: m(b), statements: m(l), functions: m(l) });
const summary = (files: Record<string, ReturnType<typeof file>>, l: number, b: number) => ({
  total: { lines: m(l), branches: m(b) },
  ...files,
});
const none = { lines: null, branches: null };

describe('coverage gate', () => {
  it('passes vacuously with no app code', () => {
    const r = evaluate({ total: { lines: m(0, 0), branches: m(0, 0) } }, policy, none);
    expect(r.ok).toBe(true);
    expect(r.messages.join()).toMatch(/No app code/);
  });
  it('passes at 90/90 overall', () => {
    expect(evaluate(summary({ 'src/a.ts': file(90, 90) }, 90, 90), policy, none).ok).toBe(true);
  });
  it('fails below 90% lines', () => {
    expect(evaluate(summary({ 'src/a.ts': file(89, 95) }, 89, 95), policy, none).ok).toBe(false);
  });
  it('fails below 90% branches', () => {
    expect(evaluate(summary({ 'src/a.ts': file(95, 89) }, 95, 89), policy, none).ok).toBe(false);
  });
  it.each(['src/shared/gate/match.ts', 'src/shared/audit/appendAudit.ts', 'src/shared/sample/isSample.ts', 'src/shared/config/load.ts'])(
    'requires 100%% line and branch on safety-critical %s',
    (f) => {
      expect(evaluate(summary({ [f]: file(100, 99) }, 95, 95), policy, none).ok).toBe(false);
      expect(evaluate(summary({ [f]: file(99, 100) }, 95, 95), policy, none).ok).toBe(false);
      expect(evaluate(summary({ [f]: file(100, 100) }, 95, 95), policy, none).ok).toBe(true);
    },
  );
  it('fails when overall drops by more than 1 point vs baseline', () => {
    const s = summary({ 'src/a.ts': file(93, 93) }, 93, 93);
    expect(evaluate(s, policy, { lines: 94, branches: 94 }).ok).toBe(true); // drop 1.0
    expect(evaluate(s, policy, { lines: 94.5, branches: 93 }).ok).toBe(false); // drop 1.5
  });
  it('resolves absolute paths from the v8 summary', () => {
    const abs = `${process.cwd()}/src/shared/audit/appendAudit.ts`;
    expect(evaluate(summary({ [abs]: file(100, 50) }, 95, 95), policy, none).ok).toBe(false);
  });
});
