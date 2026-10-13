/** Minimal API Gateway HTTP API (payload v2) types and problem+json response helper. */
export interface HttpEvent {
  rawPath?: string;
  requestContext?: { http?: { method?: string; path?: string } };
}
export interface HttpResult {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

const TITLES: Record<number, string> = { 404: 'Not Found', 405: 'Method Not Allowed' };

/** RFC 9457 problem+json response (openapi.yaml `Problem`). */
export function problem(status: number, code: string, instance?: string, detail?: string): HttpResult {
  const body: Record<string, unknown> = { type: 'about:blank', title: TITLES[status] ?? 'Error', status, code };
  if (detail) body.detail = detail;
  if (instance) body.instance = instance;
  return { statusCode: status, headers: { 'content-type': 'application/problem+json' }, body: JSON.stringify(body) };
}

export function routeOf(event: HttpEvent): { method: string; path: string } {
  return {
    method: event.requestContext?.http?.method ?? 'GET',
    path: event.rawPath ?? event.requestContext?.http?.path ?? '/',
  };
}

/** Stub router used until real routes land: every request is a 404 `not_found` problem. */
export function notImplementedRouter(fn: string) {
  return async (event: HttpEvent): Promise<HttpResult> => {
    const { method, path } = routeOf(event);
    return problem(404, 'not_found', path, `${method} ${path} is not implemented in ${fn} yet`);
  };
}
