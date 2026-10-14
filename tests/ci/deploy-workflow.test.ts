import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const yml = readFileSync(new URL('../../.github/workflows/deploy.yml', import.meta.url), 'utf8');
const STEP = '§5b audit-write probe (records-api direct invoke, non-prod only)';
const GUARD = "if: env.DEPLOY_ENV == 'dev' || env.DEPLOY_ENV == 'stage'";

/** Split the active (uncommented) `jobs:` block into top-level job bodies keyed by name. */
function jobs(): Record<string, string> {
  const lines = yml.split('\n').filter((l) => !/^\s*#/.test(l));
  const start = lines.indexOf('jobs:');
  const out: Record<string, string> = {};
  let cur: string | undefined;
  for (const l of lines.slice(start + 1)) {
    const m = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(l);
    if (m) { cur = m[1]; out[cur] = ''; continue; }
    if (cur) out[cur] += l + '\n';
  }
  return out;
}

function stepBlock(body: string, name: string): string | undefined {
  const parts = body.split(/\n(?= {6}- )/);
  return parts.find((p) => p.includes(`name: ${name}`));
}

describe('deploy.yml §5b probe step', () => {
  const j = jobs();

  it('is ONLY in deploy-dev', () => {
    const withStep = Object.entries(j).filter(([, b]) => b.includes('qa-5b')).map(([n]) => n);
    expect(withStep).toEqual(['deploy-dev']);
    expect(j['deploy-stage']).toBeDefined();
    expect(j['deploy-stage']).not.toContain(STEP);
    expect(j['deploy-stage']).toMatch(/\n {4}env:\n {6}DEPLOY_ENV: stage\n/);
  });

  it.each([['deploy-dev', 'dev']])('%s has the step with the non-prod guard', (job, env) => {
    const body = j[job];
    expect(body).toBeDefined();
    expect(body).toMatch(new RegExp(`\\n {4}env:\\n {6}DEPLOY_ENV: ${env}\\n`));
    const s = stepBlock(body, STEP);
    expect(s).toBeDefined();
    expect(s).toContain(GUARD);
    expect(s).toContain('SentinelQA-${DEPLOY_ENV}-records-api');
    expect(s).toContain(`'{"probe":"qa-5b"}'`);
    expect(s).toContain("jq -e '.pass == true' out-5b.json");
    expect(s).not.toContain('continue-on-error');
  });

  it('runs right after the dev smoke step', () => {
    const body = j['deploy-dev'];
    const smoke = body.indexOf('name: Dev smoke test + QA-36');
    const probe = body.indexOf(`name: ${STEP}`);
    expect(smoke).toBeGreaterThan(-1);
    expect(probe).toBeGreaterThan(smoke);
    expect(body.slice(smoke, probe).match(/\n {6}- /g)).toHaveLength(1);
  });

  it('does not exist in any prod job', () => {
    for (const [name, body] of Object.entries(j)) {
      if (/prod/i.test(name) || /environment:\s*prod/.test(body) || /DEPLOY_ENV:\s*prod/.test(body)) {
        expect(body).not.toContain('qa-5b');
      }
    }
    expect(yml.split('\n').filter((l) => l.includes('qa-5b') && /^\s*#/.test(l))).toHaveLength(0);
  });
});
