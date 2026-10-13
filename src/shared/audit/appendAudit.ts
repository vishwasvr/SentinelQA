// Single audit write path (docs/specs/audit-write-path.md §1, QA-28; overview §4.3, QA-26).
// The only module allowed to refer to AUDIT_TABLE (enforced by the audit-lint rule).
import { gzipSync } from 'node:zlib';
import { randomBytes } from 'node:crypto';
import type { AttributeValue, TransactWriteItem, TransactWriteItemsCommandInput } from '@aws-sdk/client-dynamodb';
import { TransactWriteItemsCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { ProblemError } from '../problem.js';
import { ITEM_CAP_BYTES, itemSize, largestField } from '../itemSize.js';

/** Constant condition; callers cannot override it (§1). */
const AUDIT_CONDITION = 'attribute_not_exists(PK) AND attribute_not_exists(SK)';

export type AuditEventType = 'CREATED' | 'UPDATED' | 'TRANSITIONED' | 'DELETED' | 'REVERSED';

export interface AuditEvent {
  entityType: string;
  entityId: string;
  eventType: AuditEventType;
  actorName: string;
  /** Changed fields only: { field: { before, after } } (create: after only), plus version. */
  snapshot: Record<string, unknown>;
  controlledDataAttested: boolean;
  fromStage?: string;
  toStage?: string;
  prevHash?: string;
}

export interface AuditCtx {
  workspaceId: string;
  /** Defaults to process.env.AUDIT_TABLE. */
  tableName?: string;
  /** Injectable clock and id source (tests). */
  now?: () => Date;
  ulid?: () => string;
  /** Anything else a caller passes (e.g. a ConditionExpression) is ignored. */
  [k: string]: unknown;
}

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** ULID: 48-bit ms timestamp + 80 random bits, Crockford base32 (26 chars). */
export function ulid(now: number = Date.now(), rand: Buffer = randomBytes(10)): string {
  let t = '';
  let ms = now;
  for (let i = 0; i < 10; i++) { t = CROCKFORD[ms % 32] + t; ms = Math.floor(ms / 32); }
  let r = '';
  let bits = 0;
  let acc = 0;
  for (const byte of rand) {
    acc = (acc << 8) | byte; bits += 8;
    while (bits >= 5) { bits -= 5; r += CROCKFORD[(acc >> bits) & 31]; }
  }
  return t + r;
}

/** Builds the AuditLog Put entry for a TransactWriteItems call. Throws 413 item_too_large over 350 KB. */
export function buildAuditPut(event: AuditEvent, ctx: AuditCtx): TransactWriteItem {
  const tableName = ctx.tableName ?? process.env.AUDIT_TABLE;
  if (!tableName) throw new Error('AUDIT_TABLE is not set');
  const now = (ctx.now ?? (() => new Date()))();
  const id = (ctx.ulid ?? (() => ulid(now.getTime())))();
  const isoTs = now.toISOString();
  const item: Record<string, AttributeValue> = {
    ...marshall(
      {
        PK: `WS#${ctx.workspaceId}#ENT#${event.entityId}`,
        SK: `${isoTs}#${id}`,
        entityType: event.entityType,
        entityId: event.entityId,
        eventType: event.eventType,
        actor: { name: event.actorName, userId: null },
        at: isoTs,
        controlledDataAttested: event.controlledDataAttested,
        snapshotEncoding: 'gzip+json',
        fromStage: event.fromStage,
        toStage: event.toStage,
        prevHash: event.prevHash,
      },
      { removeUndefinedValues: true },
    ),
    snapshotGz: { B: gzipSync(Buffer.from(JSON.stringify(event.snapshot), 'utf8')) },
  };
  const size = itemSize(item);
  if (size > ITEM_CAP_BYTES) {
    throw new ProblemError(413, 'item_too_large', { field: largestField(item), bytes: size, entityType: event.entityType });
  }
  return { Put: { TableName: tableName, Item: item, ConditionExpression: AUDIT_CONDITION } };
}

/** Minimal client shape (DynamoDBClient satisfies it); mocked in tests. */
export interface TransactSender {
  send(cmd: TransactWriteItemsCommand): Promise<unknown>;
}

/**
 * Sends one TransactWriteItems with the Domain write(s) and the audit Put (§1: all or nothing).
 * The Domain item is size-checked too (413 item_too_large, nothing sent).
 */
export async function appendAudit(
  client: TransactSender,
  domainWrites: TransactWriteItem[],
  event: AuditEvent,
  ctx: AuditCtx & { idempotencyKey?: string },
): Promise<void> {
  if (domainWrites.length === 0) throw new Error('appendAudit needs at least one Domain write');
  for (const w of domainWrites) {
    const item = w.Put?.Item;
    if (item && itemSize(item) > ITEM_CAP_BYTES) {
      throw new ProblemError(413, 'item_too_large', { field: largestField(item), bytes: itemSize(item), entityType: event.entityType });
    }
  }
  const input: TransactWriteItemsCommandInput = {
    TransactItems: [...domainWrites, buildAuditPut(event, ctx)],
    ClientRequestToken: ctx.idempotencyKey,
  };
  await client.send(new TransactWriteItemsCommand(input));
}
