import { describe, expect, it } from 'vitest';
import { findMarker, normalise, screenFreeText } from '../../src/shared/gate/controlledDataGate.js';

// Exactly the SSM values from templates/20-data.yaml.
const cfg = {
  markers: 'ITAR,EAR,EAR99,ECCN,CUI,NOFORN,Distribution Statement,export controlled'.split(','),
  cfrRanges: [{ title: 22, partFrom: 120, partTo: 130 }, { title: 15, partFrom: 730, partTo: 774 }],
};

describe('controlled-data gate matcher (BR-44, DP-03)', () => {
  it.each([
    ['ITAR', 'K1'], ['itar data', 'K1'], ['ear', 'K2'], ['EAR99 item', 'K3'], ['ECCN 3A001', 'K4'], ['cui', 'K5'],
    ['NoForn', 'K6'], ['distribution   statement A', 'K7'], ['Export\nControlled', 'K8'],
    // DP-03 normalisation cases carried forward (spec §3)
    ['I.T.A.R', 'K1'], ['C-U-I', 'K5'], ['c_u_i', 'K5'], ['export-controlled', 'K8'], ['ＩＴＡＲ', 'K1'],
  ])('keyword %s -> %s', (t, id) => expect(findMarker(t, cfg)).toBe(id));

  it.each(['circuit', 'year', 'nearby', 'ITARS', 'security', 'distribution', 'export only', ''])('no keyword hit: %s', (t) =>
    expect(findMarker(t, cfg)).toBeNull());

  // test_marker_patterns.py yes/no lists, plus 15 C.F.R. 734
  const yes22 = ['22 CFR 120', '22 CFR 121.1', 'see 22 CFR 130.2', '22 CFR Part 125', '22 CFR Part 126', '22 cfr 126.4(a)', '22 CFR 120-130', '22 C.F.R. 123'];
  const yes15 = ['15 CFR 730', '15 CFR 774.1', '15 CFR § 774.1', '15 CFR 730-774', '15 CFR Part 744', '15 C.F.R. 734'];
  it.each(yes22)('R1 hit: %s', (t) => expect(findMarker(t, cfg)).toBe('R1'));
  it.each(yes15)('R2 hit: %s', (t) => expect(findMarker(t, cfg)).toBe('R2'));
  it.each(['22 CFR 119', '22 CFR 131', '22 CFR 1200', '122 CFR 121', '15 CFR 729', '15 CFR 775', '15 CFR 7300', '14 CFR 121'])(
    'no CFR hit: %s', (t) => expect(findMarker(t, cfg)).toBeNull());
  it('exhaustive parts 100..999', () => {
    for (let n = 100; n < 1000; n++) {
      expect(findMarker(`22 CFR ${n}`, cfg) === 'R1').toBe(n >= 120 && n <= 130);
      expect(findMarker(`15 CFR ${n}`, cfg) === 'R2').toBe(n >= 730 && n <= 774);
    }
  });
  it('never runs with an empty list', () => {
    expect(() => findMarker('x', { ...cfg, markers: [] })).toThrow();
    expect(() => findMarker('x', { ...cfg, cfrRanges: [] })).toThrow();
  });
  it('normalise: NFKC, case-fold, collapse whitespace', () => expect(normalise('  ＡB\t\n c ')).toBe('ab c'));
});

describe('screenFreeText', () => {
  it('no free text: nothing to check', () => expect(() => screenFreeText({ a: undefined, b: '' }, undefined, cfg)).not.toThrow());
  it('400 gate:attestation_required without attestation', () =>
    expect(() => screenFreeText({ a: 'ok' }, 'true', cfg)).toThrow(expect.objectContaining({ status: 400, code: 'gate:attestation_required' })));
  it('422 gate:controlled_marker with markerId only (no matched text)', () => {
    try { screenFreeText({ a: 'fine', b: 'per 22 CFR 121.1' }, true, cfg); expect.unreachable(); }
    catch (e) {
      expect(e).toMatchObject({ status: 422, code: 'gate:controlled_marker', extra: { markerId: 'R1' } });
      expect(JSON.stringify(e)).not.toContain('121');
      expect((e as Error).message).not.toContain('CFR');
    }
  });
  it('clean text passes', () => expect(() => screenFreeText({ a: 'circuit board in year 2026' }, true, cfg)).not.toThrow());
});
