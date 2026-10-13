import { describe, expect, it, vi } from 'vitest';
import { isProblem, runSmoke } from '../../scripts/smoke-deployed.mjs';

type R = { status: number; body?: unknown; raw?: string };
const fake = (routes: Record<string, R | Error>, seen: { url: string; headers: Record<string, string> }[] = []) =>
  vi.fn(async (url: string, init: { headers: Record<string, string> }) => {
    seen.push({ url, headers: init.headers });
    const path = new URL(url).pathname;
    const r = routes[path];
    if (r instanceof Error) throw r;
    const text = r.raw ?? JSON.stringify(r.body ?? {});
    return { status: r.status, headers: new Headers({ 'content-type': 'application/json' }), text: async () => text };
  }) as unknown as typeof fetch;
const prob = { type: 'about:blank', title: 'Not Found', status: 404, code: 'not_found' };
const quiet = () => {};

describe('smoke-deployed', () => {
  it('fails fast without a base URL', async () => {
    const r = await runSmoke({}, fake({}), quiet);
    expect(r.ok).toBe(false);
    expect(r.failures[0]).toMatch(/SMOKE_BASE_URL/);
  });

  it('passes on 200 config + 404 unknown, sends origin header only from env', async () => {
    const seen: { url: string; headers: Record<string, string> }[] = [];
    const f = fake({ '/api/config': { status: 200, body: { a: 1 } }, '/api/__smoke_unknown_route__': { status: 404, body: { message: 'Not Found' } } }, seen);
    const r = await runSmoke({ SMOKE_BASE_URL: 'https://x.example/', SMOKE_ORIGIN_VERIFY: 'v' }, f, quiet);
    expect(r).toEqual({ ok: true, failures: [] });
    expect(seen[0].url).toBe('https://x.example/api/config');
    expect(seen[0].headers['x-origin-verify']).toBe('v');
  });

  it('accepts a problem envelope for /api/config (stub handler)', async () => {
    const f = fake({ '/api/config': { status: 404, body: prob }, '/api/__smoke_unknown_route__': { status: 404 } });
    expect((await runSmoke({ SMOKE_BASE_URL: 'https://x.example' }, f, quiet)).ok).toBe(true);
  });

  it.each([
    [{ status: 500, body: prob }, /server error/],
    [{ status: 403, raw: 'Forbidden' }, /problem\+json/],
    [{ status: 200, raw: 'not json' }, /JSON body/],
    [new Error('boom'), /request failed: boom/],
  ])('reports config failure %#', async (cfg, re) => {
    const f = fake({ '/api/config': cfg as R | Error, '/api/__smoke_unknown_route__': { status: 200 } });
    const r = await runSmoke({ SMOKE_BASE_URL: 'http://x.example' }, f, quiet);
    expect(r.ok).toBe(false);
    expect(r.failures[0]).toMatch(re);
    expect(r.failures[1]).toMatch(/expected 404/);
  });

  it('isProblem', () => {
    expect(isProblem(prob)).toBe(true);
    expect(isProblem(null)).toBe(false);
    expect(isProblem({ status: 1 })).toBe(false);
  });
});
