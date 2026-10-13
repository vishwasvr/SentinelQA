import { describe, expect, it } from 'vitest';
import { checkCreateSample, checkPatchSample, type EnvName } from '../../src/shared/sample/isSample.js';

const code = (f: () => unknown) => { try { f(); return 'ok'; } catch (e) { return (e as { status: number; code: string }).status + ' ' + (e as { code: string }).code; } };

describe('isSample create (BR-49, US-43, spec §4)', () => {
  it.each<[EnvName, unknown, string]>([
    ['dev', true, 'ok'], ['dev', false, '422 non_sample_data_forbidden'], ['dev', undefined, '422 non_sample_data_forbidden'], ['dev', 'true', '422 non_sample_data_forbidden'],
    ['stage', true, 'ok'], ['stage', false, '422 non_sample_data_forbidden'], ['stage', undefined, '422 non_sample_data_forbidden'],
    ['prod', true, '422 sample_flag_forbidden_in_prod'], ['prod', false, 'ok'], ['prod', undefined, 'ok'],
  ])('%s isSample=%s -> %s', (env, v, want) => {
    const body = v === undefined ? {} : { isSample: v };
    expect(code(() => checkCreateSample(env, body))).toBe(want);
  });
  it('returns the stored value', () => {
    expect(checkCreateSample('dev', { isSample: true })).toBe(true);
    expect(checkCreateSample('prod', {})).toBe(false);
  });
});

describe('isSample PATCH, every env (sample_flag_immutable)', () => {
  // The check is env-independent by construction; run it per env to cover all three as required.
  for (const env of ['dev', 'stage', 'prod'] as const) {
    const stored = env !== 'prod';
    it(`${env}: changing the flag -> 422 sample_flag_immutable`, () => {
      expect(code(() => checkPatchSample(stored, { isSample: !stored }))).toBe('422 sample_flag_immutable');
      expect(code(() => checkPatchSample(stored, { isSample: 'x' }))).toBe('422 sample_flag_immutable');
    });
    it(`${env}: same value is a no-op and is stripped`, () => {
      expect(checkPatchSample(stored, { isSample: stored, title: 't' })).toEqual({ title: 't' });
    });
    it(`${env}: no isSample in the patch`, () => expect(checkPatchSample(stored, { title: 't' })).toEqual({ title: 't' }));
  }
});
