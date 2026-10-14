// First-deploy §5b probe (first-deploy.md §5b, QA-36). Non-prod only; reached by direct Lambda invoke only.
// Lives under src/shared/audit/ because it names the audit table (audit-lint rule) and must issue the bare PutItem.
import type { AttributeValue } from '@aws-sdk/client-dynamodb';
import { PutItemCommand, TransactWriteItemsCommand } from '@aws-sdk/client-dynamodb';
import { buildAuditPut, type AuditCtx } from './appendAudit.js';

export const PROBE_ENTITY = 'qa-5b-probe';
const ALLOWED_ENVS = new Set(['dev', 'stage']);

/** True only for a direct invoke whose payload is exactly {"probe":"qa-5b"} (no requestContext, no extra keys). */
export function isProbeEvent(event: unknown): boolean {
  if (typeof event !== 'object' || event === null || Array.isArray(event)) return false;
  const keys = Object.keys(event);
  return keys.length === 1 && keys[0] === 'probe' && (event as { probe: unknown }).probe === 'qa-5b';
}

export interface ProbeSender {
  send(cmd: TransactWriteItemsCommand | PutItemCommand): Promise<unknown>;
}

export interface StepResult { ok: boolean; outcome: string; error?: string }
export interface ProbeResult {
  probe: 'qa-5b';
  env: string;
  pass: boolean;
  refused?: string;
  eventKeys?: { PK: string; SK: string };
  auditTransact?: StepResult;
  barePutItem?: StepResult;
}

function errName(e: unknown): string {
  const n = (e as { name?: unknown } | null)?.name;
  return typeof n === 'string' ? n : 'UnknownError';
}

/** Runs the probe. Never logs or returns the event body; returns keys and outcomes only. */
export async function runProbe5b(event: unknown, client: ProbeSender, ctx: Partial<AuditCtx> = {}): Promise<ProbeResult> {
  // Fail closed: unset, empty, prod (any casing) or anything not dev/stage is refused before any AWS call.
  const raw = process.env.ENV_NAME;
  const env = raw === undefined ? '(unset)' : raw === '' ? '(empty)' : raw;
  const norm = (raw ?? '').trim().toLowerCase();
  if (norm === 'prod' || !ALLOWED_ENVS.has(norm)) {
    return { probe: 'qa-5b', env, pass: false, refused: `probe refused: ENV_NAME=${env} (allowed: dev, stage)` };
  }
  if (!isProbeEvent(event)) {
    return { probe: 'qa-5b', env, pass: false, refused: 'probe refused: not the exact {"probe":"qa-5b"} marker' };
  }
  const put = buildAuditPut(
    {
      entityType: PROBE_ENTITY, entityId: PROBE_ENTITY, eventType: 'CREATED', actorName: PROBE_ENTITY,
      snapshot: { isSample: true, probe: 'qa-5b' }, controlledDataAttested: false,
    },
    { workspaceId: PROBE_ENTITY, ...ctx },
  );
  const item = put.Put!.Item!;
  const eventKeys = { PK: item.PK.S!, SK: item.SK.S! };

  let auditTransact: StepResult;
  try {
    await client.send(new TransactWriteItemsCommand({ TransactItems: [put] }));
    auditTransact = { ok: true, outcome: 'written' };
  } catch (e) {
    auditTransact = { ok: false, outcome: 'failed', error: errName(e) };
  }

  // Bare PutItem (no transaction), same attribute_not_exists condition: must be denied by the EnclosingOperation
  // Deny. Distinct SK so it can never collide. Only AccessDenied passes (ConditionalCheckFailed etc. fail).
  const bareItem: Record<string, AttributeValue> = {
    PK: { S: eventKeys.PK }, SK: { S: `${eventKeys.SK}#bare-put` }, entityType: { S: PROBE_ENTITY }, isSample: { BOOL: true },
  };
  let barePutItem: StepResult;
  try {
    await client.send(new PutItemCommand({
      TableName: put.Put!.TableName, Item: bareItem, ConditionExpression: put.Put!.ConditionExpression,
    }));
    barePutItem = { ok: false, outcome: 'succeeded (FAIL: bare PutItem must be denied)' };
  } catch (e) {
    const name = errName(e);
    const denied = name === 'AccessDeniedException' || name === 'AccessDenied';
    barePutItem = { ok: denied, outcome: denied ? 'denied' : 'failed with unexpected error', error: name };
  }

  return { probe: 'qa-5b', env, pass: auditTransact.ok && barePutItem.ok, eventKeys, auditTransact, barePutItem };
}
