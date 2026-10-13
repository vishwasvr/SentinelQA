import { describe, expect, it } from 'vitest';
import { ESLint } from 'eslint';

describe('audit lint rule (audit-write-path.md §1)', () => {
  it('fails a file that refers to AUDIT_TABLE outside src/shared/audit/', async () => {
    const eslint = new ESLint();
    const [r] = await eslint.lintFiles(['tests/fixtures/audit-lint/bad-writer.ts']);
    const hits = r.messages.filter((m) => m.ruleId === 'no-restricted-syntax');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].message).toMatch(/buildAuditPut/);
  });

  it('allows AUDIT_TABLE inside src/shared/audit/', async () => {
    const eslint = new ESLint();
    const r = await eslint.lintText('export const t = process.env.AUDIT_TABLE;\n', {
      filePath: 'src/shared/audit/appendAudit.ts',
    });
    expect(r[0].messages.filter((m) => m.ruleId === 'no-restricted-syntax')).toEqual([]);
  });
});
