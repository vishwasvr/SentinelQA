// records-api Lambda entry (ADR-0014 layout). STUB: routes not implemented yet; every API Gateway request returns a
// 404 problem+json envelope. Only this handler wires the §5b probe: a direct invoke (no requestContext) whose payload
// is exactly {"probe":"qa-5b"} runs the non-prod probe (refused unless ENV_NAME is dev/stage).
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { notImplementedRouter, type HttpEvent, type HttpResult } from '../../shared/http.js';
import { runProbe5b, type ProbeResult, type ProbeSender } from '../../shared/audit/probe5b.js';

const router = notImplementedRouter('records-api');
let client: ProbeSender | undefined;

/** Test hook: inject a DynamoDB client. */
export function setClient(c: ProbeSender | undefined): void { client = c; }

/** Direct invoke (no API Gateway requestContext) carrying exactly {"probe":"qa-5b"}, no other keys. */
export function isDirectProbeInvoke(event: unknown): boolean {
  if (typeof event !== 'object' || event === null || Array.isArray(event)) return false;
  if ('requestContext' in event) return false;
  const keys = Object.keys(event);
  return keys.length === 1 && keys[0] === 'probe' && (event as { probe: unknown }).probe === 'qa-5b';
}

export async function handler(event: HttpEvent): Promise<HttpResult | ProbeResult> {
  if (isDirectProbeInvoke(event)) {
    client ??= new DynamoDBClient({});
    const r = await runProbe5b(event, client);
    console.log(JSON.stringify({ probe: r.probe, env: r.env, pass: r.pass, refused: r.refused, readBack: r.readBack }));
    return r;
  }
  return router(event);
}
