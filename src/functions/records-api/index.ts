// records-api Lambda entry (ADR-0014 layout). STUB: routes not implemented yet; every API Gateway request returns a
// 404 problem+json envelope. A direct invoke with exactly {"probe":"qa-5b"} runs the non-prod §5b probe.
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { notImplementedRouter, type HttpEvent, type HttpResult } from '../../shared/http.js';
import { isProbeEvent, runProbe5b, type ProbeResult, type ProbeSender } from '../../shared/audit/probe5b.js';

const router = notImplementedRouter('records-api');
let client: ProbeSender | undefined;

/** Test hook: inject a DynamoDB client. */
export function setClient(c: ProbeSender | undefined): void { client = c; }

export async function handler(event: HttpEvent): Promise<HttpResult | ProbeResult> {
  // isProbeEvent accepts only the single-key marker, so any API Gateway event (has requestContext) is excluded.
  if (isProbeEvent(event)) {
    client ??= new DynamoDBClient({});
    const r = await runProbe5b(client);
    console.log(JSON.stringify({ probe: r.probe, env: r.env, pass: r.pass, refused: r.refused }));
    return r;
  }
  return router(event);
}
