import { describe, expect, it } from 'vitest';
import { check } from '../../scripts/ci/releases-path-check.mjs';

describe('releases-path-check', () => {
  it('passes PRs that do not touch releases/**', () => expect(check(['src/a.ts']).ok).toBe(true));
  it('passes sign-off-only PRs', () => expect(check(['releases/abc/dev-signoff.md']).ok).toBe(true));
  it('fails mixed PRs', () => expect(check(['releases/abc/dev-signoff.md', 'src/a.ts']).ok).toBe(false));
});
