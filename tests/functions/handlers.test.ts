import { describe, expect, it } from 'vitest';
import { handler as records } from '../../src/functions/records-api/index.js';
import { handler as reports } from '../../src/functions/reports-api/index.js';
import { problem, routeOf } from '../../src/shared/http.js';

describe('stub handlers', () => {
  it.each([['records-api', records], ['reports-api', reports]])('%s returns a 404 problem envelope', async (fn, h) => {
    const r = await h({ rawPath: '/api/x', requestContext: { http: { method: 'POST' } } });
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
