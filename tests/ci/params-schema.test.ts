import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { validateParams, crossCheck } from '../../scripts/ci/params-schema.mjs';

const load = (f: string) => JSON.parse(readFileSync(`docs/architecture/iac/params/${f}`, 'utf8'));
const clone = <T>(x: T): T => structuredClone(x);

describe('params-schema', () => {
  it.each(['dev.json', 'stage.json', 'prod.json', 'account.json'])('accepts the committed %s', (f) => {
    expect(validateParams(f, load(f))).toEqual([]);
  });
  it('rejects throttle other than 10/20', () => {
    const d = clone(load('dev.json')); d['30-api'].ThrottleRate = 50;
    expect(validateParams('dev.json', d).join()).toMatch(/ThrottleRate/);
    const e = clone(load('dev.json')); e['30-api'].ThrottleBurst = 5;
    expect(validateParams('dev.json', e).join()).toMatch(/ThrottleBurst/);
  });
  it('rejects a region other than us-east-1', () => {
    const d = clone(load('stage.json')); d._meta.AwsRegion = 'us-west-2';
    expect(validateParams('stage.json', d).join()).toMatch(/AwsRegion/);
  });
  it('rejects a non-12-digit account id', () => {
    const d = clone(load('dev.json')); d._meta.AwsAccountId = '1234';
    expect(validateParams('dev.json', d).join()).toMatch(/AwsAccountId/);
  });
  it('requires CreateOidcProvider = "true" (string)', () => {
    expect(validateParams('account.json', { '00-account-oidc': { CreateOidcProvider: true } }).length).toBeGreaterThan(0);
    expect(validateParams('account.json', { '00-account-oidc': { CreateOidcProvider: 'false' } }).length).toBeGreaterThan(0);
  });
  it('rejects secrets in params (ADR-0015)', () => {
    const d = clone(load('dev.json')); d['40-web'].OriginVerifySecret = 'x';
    expect(validateParams('dev.json', d).join()).toMatch(/secret/i);
  });
  it('rejects hard-coded Lambda keys', () => {
    const d = clone(load('dev.json')); d['30-api'].RecordsApiKey = 'abc123/records-api.zip';
    expect(validateParams('dev.json', d).join()).toMatch(/RecordsApiKey/);
  });
  it('rejects env mismatches and wrong profile', () => {
    const d = clone(load('dev.json')); d.all.EnvName = 'stage';
    expect(validateParams('dev.json', d).join()).toMatch(/EnvName/);
    const p = clone(load('prod.json')); p.all.EnvProfile = 'lean';
    expect(validateParams('prod.json', p).join()).toMatch(/EnvProfile/);
  });
  it('rejects OIDC ARN in a different account', () => {
    const d = clone(load('dev.json'));
    d['00-bootstrap'].OidcProviderArn = 'arn:aws:iam::111111111111:oidc-provider/token.actions.githubusercontent.com';
    expect(validateParams('dev.json', d).join()).toMatch(/OidcProviderArn/);
  });
  it('enforces 25-backup only in prod with 2557 days', () => {
    const p = clone(load('prod.json')); p['25-backup'].RetentionDays = 30;
    expect(validateParams('prod.json', p).join()).toMatch(/RetentionDays/);
    const q = clone(load('prod.json')); delete q['25-backup'];
    expect(validateParams('prod.json', q).join()).toMatch(/25-backup/);
    const d = clone(load('dev.json')); d['25-backup'] = clone(load('prod.json'))['25-backup'];
    expect(validateParams('dev.json', d).join()).toMatch(/prod-only/);
  });
  it('rejects unknown stacks and unknown files', () => {
    const d = clone(load('dev.json')); d['99-extra'] = {};
    expect(validateParams('dev.json', d).length).toBeGreaterThan(0);
    expect(validateParams('qa.json', {}).length).toBe(1);
  });
  it('rejects AlarmEmail in params (sourced from vars.ALARM_EMAIL)', () => {
    for (const env of ['dev', 'stage', 'prod']) {
      const d = clone(load(`${env}.json`)); d['10-security'] = { AlarmEmail: 'ops@example.com' };
      const out = validateParams(`${env}.json`, d).join();
      expect(out).toMatch(/AlarmEmail/);
      expect(out).toMatch(/ALARM_EMAIL/);
    }
  });
  it('rejects an AlarmEmail key even with a non-email value or different case', () => {
    const d = clone(load('dev.json')); d['10-security'] = { alarmemail: 'TODO' };
    expect(validateParams('dev.json', d).join()).toMatch(/forbidden/);
  });
  it('accepts an empty 10-security block', () => {
    const d = clone(load('stage.json')); d['10-security'] = {};
    expect(validateParams('stage.json', d)).toEqual([]);
  });
  it.each([
    ['a note', (d: ReturnType<typeof load>) => { d._contact_note = 'ping someone@example.org'; }],
    ['_meta note', (d: ReturnType<typeof load>) => { d._meta._note = 'owner: First.Last+tag@sub.example.co.uk'; }],
    ['a stack value', (d: ReturnType<typeof load>) => { d['40-web'].WebACLArn = 'x@y.io'; }],
  ])('rejects any email-looking value (%s)', (_l, mut) => {
    const d = clone(load('dev.json')); mut(d);
    expect(validateParams('dev.json', d).join()).toMatch(/looks like an email/);
  });
  it('rejects email-looking values in account.json too', () => {
    const a = clone(load('account.json')); a._owner = 'me@example.com';
    expect(validateParams('account.json', a).join()).toMatch(/looks like an email/);
  });
  it('committed params contain no email addresses', () => {
    for (const f of ['dev.json', 'stage.json', 'prod.json', 'account.json']) {
      expect(readFileSync(`docs/architecture/iac/params/${f}`, 'utf8')).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    }
  });
  it('cross-check: dev/stage share an account; flags prod sharing it', () => {
    const env = { dev: load('dev.json'), stage: load('stage.json'), prod: load('prod.json') };
    expect(crossCheck(env)).toEqual({ errs: [], prodSharesAccount: true });
    const s = clone(env.stage); s._meta.AwsAccountId = '222222222222';
    expect(crossCheck({ ...env, stage: s }).errs.length).toBe(1);
  });
});
