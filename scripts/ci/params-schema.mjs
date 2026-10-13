#!/usr/bin/env node
// params-schema: validate docs/architecture/iac/params/*.json against ci/params*.schema.json,
// plus cross-field rules a JSON Schema can't express. Usage: node params-schema.mjs [dir]
import { readFileSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import Ajv from 'ajv';

const ajv = new Ajv({ allErrors: true, strict: false });
const envSchema = ajv.compile(JSON.parse(readFileSync(new URL('../../ci/params.schema.json', import.meta.url), 'utf8')));
const acctSchema = ajv.compile(JSON.parse(readFileSync(new URL('../../ci/params-account.schema.json', import.meta.url), 'utf8')));
const PROFILE = { dev: 'lean', stage: 'lean', prod: 'strict' }; // ADR-0013
// Secrets never live in params (ADR-0015, delivery-strategy §2a): reject secret-looking keys.
const SECRET_KEY = /(secret|password|passwd|token|privatekey|accesskey)/i;
// Personal data never lives in params: AlarmEmail comes from the GitHub env var vars.ALARM_EMAIL at deploy time,
// and no key or value (notes included) may look like an email address.
const FORBIDDEN_KEY = /^alarmemail$/i;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

function values(v, path = '', out = []) {
  if (typeof v === 'string') out.push([path || '/', v]);
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) values(x, `${path}/${k}`, out);
  return out;
}

function keys(v, out = []) {
  if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { out.push(k); keys(x, out); }
  return out;
}

/** Validate one params file's parsed content. `name` is the file name, e.g. "dev.json". */
export function validateParams(name, data) {
  const errs = [];
  const fmt = (e) => `${name}: ${e.instancePath || '/'} ${e.message}${e.params?.allowedValue !== undefined ? ` (${JSON.stringify(e.params.allowedValue)})` : ''}`;
  for (const k of keys(data)) if (!k.startsWith('_') && SECRET_KEY.test(k)) errs.push(`${name}: key "${k}" looks like a secret; secrets must come from SSM/OIDC, not params`);
  for (const k of keys(data)) if (FORBIDDEN_KEY.test(k)) errs.push(`${name}: key "${k}" is forbidden; AlarmEmail comes from the GitHub environment variable vars.ALARM_EMAIL at deploy time`);
  for (const k of keys(data)) if (EMAIL.test(k)) errs.push(`${name}: key "${k}" looks like an email address; emails must not be committed to params (use vars.ALARM_EMAIL)`);
  for (const [p, v] of values(data)) if (EMAIL.test(v)) errs.push(`${name}: ${p} looks like an email address; emails must not be committed to params (use vars.ALARM_EMAIL)`);
  if (name === 'account.json') {
    if (!acctSchema(data)) errs.push(...acctSchema.errors.map(fmt));
    return errs;
  }
  const env = basename(name, '.json');
  if (!(env in PROFILE)) return [`${name}: unexpected params file (expected dev/stage/prod/account.json)`];
  if (!envSchema(data)) { errs.push(...envSchema.errors.map(fmt)); return errs; }
  if (data.all.EnvName !== env) errs.push(`${name}: all.EnvName "${data.all.EnvName}" != file env "${env}"`);
  if (data._meta.GitHubEnvironment !== env) errs.push(`${name}: _meta.GitHubEnvironment != "${env}"`);
  if (data.all.EnvProfile !== PROFILE[env]) errs.push(`${name}: EnvProfile must be "${PROFILE[env]}" for ${env} (ADR-0013)`);
  const arnAcct = data['00-bootstrap'].OidcProviderArn.split(':')[4];
  if (arnAcct !== data._meta.AwsAccountId) errs.push(`${name}: OidcProviderArn account ${arnAcct} != _meta.AwsAccountId`);
  if (env === 'prod' && !data['25-backup']) errs.push(`${name}: prod needs 25-backup (strict profile)`);
  if (env !== 'prod' && data['25-backup']) errs.push(`${name}: 25-backup is prod-only (template AllowedValues [prod])`);
  return errs;
}

/** Cross-file rule (delivery-strategy §2a): dev/stage must not carry the prod account once prod has its own (O-03). */
export function crossCheck(byEnv) {
  const errs = [];
  const prod = byEnv.prod?._meta?.AwsAccountId;
  for (const e of ['dev', 'stage']) {
    if (byEnv[e] && byEnv[e]._meta.AwsAccountId !== byEnv.dev?._meta.AwsAccountId) errs.push(`${e}.json: dev and stage must share one account`);
  }
  return { errs, prodSharesAccount: !!prod && prod === byEnv.dev?._meta?.AwsAccountId };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dir = process.argv[2] ?? 'docs/architecture/iac/params';
  const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  const byEnv = {};
  const errs = [];
  for (const f of files) {
    const data = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    byEnv[basename(f, '.json')] = data;
    errs.push(...validateParams(f, data));
  }
  for (const req of ['dev.json', 'stage.json', 'prod.json', 'account.json']) if (!files.includes(req)) errs.push(`missing ${req}`);
  const x = crossCheck(byEnv);
  errs.push(...x.errs);
  if (x.prodSharesAccount) console.log('note: prod.json still uses the shared account; update it at the O-03 prod account split.');
  if (errs.length) { console.error('FAIL:\n  ' + errs.join('\n  ')); process.exit(1); }
  console.log(`params-schema: ${files.length} file(s) valid (${files.join(', ')}).`);
}
