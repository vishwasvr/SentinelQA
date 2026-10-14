import { describe, expect, it } from 'vitest';
import { handler as records } from '../../src/functions/records-api/index.js';
import { handler as reports } from '../../src/functions/reports-api/index.js';
import { problem, routeOf, type HttpResult } from '../../src/shared/http.js';

describe('stub handlers', () => {
  it.each([['records-api', records], ['reports-api', reports]])('%s returns a 404 problem envelope', async (fn, h) => {
    const r = (await h({ rawPath: '/api/x', requestContext: { http: { method: 'POST' } } })) as HttpResult;
    expect(r.statusCode).toBe(404);
    expect(r.headers['content-type']).toBe('application/problem+json');
    expect(JSON.parse(r.body)).toEqual({
      type: 'about:blank', title: 'Not Found', status: 404, code: 'not_found',
      detail: `POST /api/x is not implemented in ${fn} yet`, instance: '/api/x',
    });
  });
});

describe('http helpers', () => {
  it('routeOf falls back to requestContext path, then defaults', () => {
    expect(routeOf({ requestContext: { http: { path: '/p' } } })).toEqual({ method: 'GET', path: '/p' });
    expect(routeOf({})).toEqual({ method: 'GET', path: '/' });
  });
  it('problem omits optional fields and uses a generic title for unknown status', () => {
    expect(JSON.parse(problem(418, 'teapot').body)).toEqual({ type: 'about:blank', title: 'Error', status: 418, code: 'teapot' });
    expect(JSON.parse(problem(405, 'm').body).title).toBe('Method Not Allowed');
  });
});

describe('records-api §5b probe routing', async () => {
  const { setClient } = await import('../../src/functions/records-api/index.js');
  const { vi, afterEach } = await import('vitest');
  const saved = process.env.ENV_NAME;
  afterEach(() => { setClient(undefined); if (saved === undefined) delete process.env.ENV_NAME; else process.env.ENV_NAME = saved; });

  it('runs the probe for a direct invoke with exactly the marker', async () => {
    process.env.ENV_NAME = 'dev';
    const send = vi.fn(async (cmd: { constructor: { name: string } }) => {
      if (cmd.constructor.name === 'PutItemCommand') throw Object.assign(new Error('d'), { name: 'AccessDeniedException' });
      return {};
    });
    setClient({ send });
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const prevTable = process.env['AUDIT_' + 'TABLE'];
    process.env['AUDIT_' + 'TABLE'] = 'T';
    const r = await records({ probe: 'qa-5b' } as never) as { pass: boolean };
    process.env['AUDIT_' + 'TABLE'] = prevTable;
    expect(r.pass).toBe(true);
    expect(send).toHaveBeenCalledTimes(2);
    expect(log.mock.calls.flat().join(' ')).not.toMatch(/snapshot|isSample/);
    log.mockRestore();
  });

  it('refuses in prod without touching DynamoDB (default client path)', async () => {
    process.env.ENV_NAME = 'prod';
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const r = await records({ probe: 'qa-5b' } as never) as { pass: boolean; refused: string };
    log.mockRestore();
    expect(r.pass).toBe(false);
    expect(r.refused).toMatch(/ENV_NAME=prod/);
  });

  it('reports-api never reaches the probe: {"probe":"qa-5b"} is a 404', async () => {
    process.env.ENV_NAME = 'dev';
    const send = vi.fn();
    setClient({ send });
    const r = await reports({ probe: 'qa-5b' } as never) as HttpResult;
    expect(r.statusCode).toBe(404);
    expect(JSON.parse(r.body).code).toBe('not_found');
    expect(send).not.toHaveBeenCalled();
  });

  it('isDirectProbeInvoke rejects non-objects and arrays', async () => {
    const { isDirectProbeInvoke } = await import('../../src/functions/records-api/index.js');
    for (const e of [null, undefined, 'x', ['qa-5b'], {}, { probe: 'qa-5a' }]) expect(isDirectProbeInvoke(e)).toBe(false);
    expect(isDirectProbeInvoke({ probe: 'qa-5b' })).toBe(true);
  });

  it.each([
    { probe: 'qa-5b', requestContext: { http: { method: 'POST' } } },
    { probe: 'qa-5b', extra: true },
    { rawPath: '/api/x', requestContext: { http: { method: 'POST' } }, body: '{"probe":"qa-5b"}' },
  ])('anything else follows the normal 404 path: %j', async (e) => {
    process.env.ENV_NAME = 'dev';
    const send = vi.fn();
    setClient({ send });
    const r = await records(e as never) as { statusCode: number };
    expect(r.statusCode).toBe(404);
    expect(send).not.toHaveBeenCalled();
  });
});
