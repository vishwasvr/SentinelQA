// isSample checks (BR-31, BR-45, BR-49, US-43; ci-and-data-guards §3.1 guard 2; spec §4).
import { ProblemError } from '../problem.js';

export type EnvName = 'dev' | 'stage' | 'prod';

/**
 * Create: dev/stage require isSample === true (else 422 non_sample_data_forbidden, incl. false or missing);
 * prod rejects isSample === true (422 sample_flag_forbidden_in_prod). Returns the value to store.
 */
export function checkCreateSample(env: EnvName, body: { isSample?: unknown }): boolean {
  if (env === 'prod') {
    if (body.isSample === true) throw new ProblemError(422, 'sample_flag_forbidden_in_prod');
    return false;
  }
  if (body.isSample !== true) throw new ProblemError(422, 'non_sample_data_forbidden');
  return true;
}

/**
 * PATCH, every env: a different isSample -> 422 sample_flag_immutable; the same value is a no-op.
 * Returns the patch without isSample so it is never written.
 */
export function checkPatchSample<T extends Record<string, unknown>>(stored: boolean, patch: T): Omit<T, 'isSample'> {
  const { isSample, ...rest } = patch;
  if (isSample !== undefined && isSample !== stored) throw new ProblemError(422, 'sample_flag_immutable');
  return rest;
}
