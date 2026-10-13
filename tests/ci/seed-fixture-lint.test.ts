import { describe, expect, it } from 'vitest';
import { lintFixture } from '../../scripts/ci/seed-fixture-lint.mjs';

describe('seed fixture lint', () => {
  it('accepts synthetic sample records', () => {
    expect(lintFixture([{ id: 'r1', isSample: true, owner: 'a@example.com', phone: '555-0123' }])).toEqual([]);
  });
  it('rejects a record without isSample: true', () => {
    expect(lintFixture([{ id: 'r1' }]).join()).toMatch(/isSample/);
  });
  it('rejects real-looking emails, phones and markers', () => {
    const p = lintFixture({ records: [{ id: 'r1', isSample: true, a: 'x@gmail.com', b: '312-555-9876', c: 'I.T.A.R data', d: '15 C.F.R. 734' }] });
    expect(p.join()).toMatch(/email/);
    expect(p.join()).toMatch(/phone/);
    expect(p.filter((x: string) => /marker/.test(x)).length).toBe(2);
  });
});
