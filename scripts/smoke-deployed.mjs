#!/usr/bin/env node
// Post-deploy smoke test (deploy.yml "Dev smoke test"; delivery-strategy §3/§3b). No secrets in code.
// Env:
//   SMOKE_BASE_URL       required. Deployed base URL, e.g. https://<distribution>.cloudfront.net (no trailing /api).
//   SMOKE_ORIGIN_VERIFY  optional. X-Origin-Verify value (ADR-0015), only needed when hitting the API directly.
//   DEPLOY_ENV           optional, for log labels (deploy.yml sets it).
//   SMOKE_TIMEOUT_MS     optional, per-request timeout (default 10000).
// Checks: GET /api/config -> 200 JSON or a problem+json envelope (not 5xx); GET of an unknown /api route -> 404.
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function isProblem(body) {
  return !!body && typeof body === 'object' && typeof body.status === 'number' && typeof body.code === 'string'
    && typeof body.title === 'string';
}

async function get(fetchImpl, url, headers, timeoutMs) {
  const res = await fetchImpl(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = undefined; }
  return { status: res.status, contentType: res.headers.get('content-type') ?? '', json };
}

export async function runSmoke(env, fetchImpl = fetch, log = console.log) {
  const base = (env.SMOKE_BASE_URL ?? '').replace(/\/+$/, '');
  if (!/^https?:\/\//.test(base)) return { ok: false, failures: ['SMOKE_BASE_URL is not set (or not an http(s) URL)'] };
  const headers = { accept: 'application/json' };
  if (env.SMOKE_ORIGIN_VERIFY) headers['x-origin-verify'] = env.SMOKE_ORIGIN_VERIFY;
  const timeoutMs = Number(env.SMOKE_TIMEOUT_MS) || 10000;
  const failures = [];
  const check = async (name, path, ok) => {
    try {
      const r = await get(fetchImpl, base + path, headers, timeoutMs);
      const reason = ok(r);
      if (reason) failures.push(`${name}: ${reason} (HTTP ${r.status})`);
      else log(`ok   ${name} (HTTP ${r.status})`);
    } catch (err) {
      failures.push(`${name}: request failed: ${err.message}`);
    }
  };
  await check('GET /api/config', '/api/config', (r) => {
    if (r.status === 200) return r.json && typeof r.json === 'object' ? '' : 'expected a JSON body';
    if (r.status >= 500) return 'server error';
    return isProblem(r.json) ? '' : 'expected 200 or a problem+json envelope';
  });
  await check('GET unknown route', '/api/__smoke_unknown_route__', (r) => (r.status === 404 ? '' : 'expected 404'));
  return { ok: failures.length === 0, failures };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`smoke: env=${process.env.DEPLOY_ENV ?? '(unset)'}`);
  runSmoke(process.env).then(({ ok, failures }) => {
    failures.forEach((f) => console.error(`FAIL ${f}`));
    process.exit(ok ? 0 : 1);
  });
}
