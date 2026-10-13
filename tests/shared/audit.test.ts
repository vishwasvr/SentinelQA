import { describe, expect, it, afterEach } from 'vitest';
import { gunzipSync } from 'node:zlib';
import { randomBytes } from 'node:crypto';
import type { TransactWriteItem } from '@aws-sdk/client-dynamodb';
import { TransactionCanceledException } from '@aws-sdk/client-dynamodb';
import { appendAudit, buildAuditPut, ulid, type AuditEvent } from '../../src/shared/audit/appendAudit.js';
import { ProblemError } from '../../src/shared/problem.js';
import { FakeDynamo } from './fakeDynamo.js';

const event: AuditEvent = {
  entityType: 'CAPA', entityId: 'c1', eventType: 'CREATED', actorName: 'Pat',
  snapshot: { title: { after: 'x' }, version: 1 }, controlledDataAttested: true,
};
const fixed = { workspaceId: 'aerospace', tableName: 'AuditLog', now: () => new Date('2026-10-13T20:00:00.000Z'), ulid: () => '01J0000000000000000000000A' };
const domain = (over: Record<string, unknown> = {}): TransactWriteItem => ({
  Put: { TableName: 'Domain', Item: { PK: { S: 'WS#aerospace' }, SK: { S: 'CAPA#c1' }, title: { S: 'x' } }, ConditionExpression: 'version = :expected', ...over },
});
const kb = (n: number) => 'a'.repeat(n * 1024);

afterEach(() => { delete process.env.AUDIT_TABLE; });

describe('buildAuditPut (spec §1)', () => {
  it('builds a conditional Put with PK/SK and gzip snapshot', () => {
    const p = buildAuditPut({ ...event, fromStage: 'Open', toStage: 'Review', prevHash: 'h' }, fixed).Put!;
    expect(p.TableName).toBe('AuditLog');
    expect(p.ConditionExpression).toBe('attribute_not_exists(PK) AND attribute_not_exists(SK)');
    expect(p.Item!.PK.S).toBe('WS#aerospace#ENT#c1');
    expect(p.Item!.SK.S).toBe('2026-10-13T20:00:00.000Z#01J0000000000000000000000A');
    expect(p.Item!.snapshotEncoding.S).toBe('gzip+json');
    expect(JSON.parse(gunzipSync(p.Item!.snapshotGz.B!).toString())).toEqual(event.snapshot);
    expect(p.Item!.controlledDataAttested.BOOL).toBe(true);
    expect(p.Item!.actor.M!.userId.NULL).toBe(true);
    expect(p.Item!.toStage.S).toBe('Review');
  });
  it('callers cannot drop or override the condition', () => {
    const p = buildAuditPut(event, { ...fixed, ConditionExpression: 'attribute_exists(PK)', condition: '' }).Put!;
    expect(p.ConditionExpression).toBe('attribute_not_exists(PK) AND attribute_not_exists(SK)');
  });
  it('omits unset optional fields', () => {
    const p = buildAuditPut(event, fixed).Put!;
    expect(p.Item!.fromStage).toBeUndefined();
  });
  it('defaults table from AUDIT_TABLE, clock and ULID', () => {
    process.env.AUDIT_TABLE = 'EnvAudit';
    const p = buildAuditPut(event, { workspaceId: 'aerospace' }).Put!;
    expect(p.TableName).toBe('EnvAudit');
    expect(p.Item!.SK.S).toMatch(/^\d{4}-\d\d-\d\dT.*Z#[0-9A-HJKMNP-TV-Z]{26}$/);
  });
  it('throws without a table name', () => {
    expect(() => buildAuditPut(event, { workspaceId: 'a' })).toThrow(/AUDIT_TABLE/);
  });
  it('413 item_too_large over 350 KB compressed (random, incompressible text)', () => {
    const big = randomBytes(400 * 1024).toString('base64');
    try { buildAuditPut({ ...event, snapshot: { d: { after: big } } }, fixed); expect.unreachable(); }
    catch (e) { expect(e).toMatchObject({ status: 413, code: 'item_too_large', extra: { field: 'snapshotGz' } }); }
  });
});

describe('ulid', () => {
  it('encodes time first, 26 chars, sortable', () => {
    const a = ulid(1000, Buffer.alloc(10)), b = ulid(2000, Buffer.alloc(10, 255));
    expect(a).toHaveLength(26);
    expect(a < b).toBe(true);
    expect(ulid()).toHaveLength(26);
  });
});

describe('appendAudit with a mocked DynamoDB (spec §3 QA-28 / QA-26)', () => {
  it('writes Domain and audit in one transaction with the idempotency token', async () => {
    const db = new FakeDynamo();
    const sent: unknown[] = [];
    const spy = { send: async (c: Parameters<FakeDynamo['send']>[0]) => { sent.push(c.input); return db.send(c); } };
    await appendAudit(spy, [domain()], event, { ...fixed, idempotencyKey: 'k1' });
    expect(sent[0]).toMatchObject({ ClientRequestToken: 'k1' });
    expect(db.table('AuditLog').size).toBe(1);
    expect(db.table('Domain').size).toBe(1);
  });
  it('overwrite fails with ConditionalCheckFailed; original byte-identical; second Domain item not written', async () => {
    const db = new FakeDynamo();
    await appendAudit(db, [domain()], event, fixed);
    const before = structuredClone([...db.table('AuditLog').values()][0]);
    const d2 = domain({ Item: { PK: { S: 'WS#aerospace' }, SK: { S: 'CAPA#c2' } } });
    const err = await appendAudit(db, [d2], { ...event, actorName: 'Other' }, fixed).catch((e) => e);
    expect(err).toBeInstanceOf(TransactionCanceledException);
    expect(err.CancellationReasons.map((r: { Code: string }) => r.Code)).toContain('ConditionalCheckFailed');
    expect([...db.table('AuditLog').values()][0]).toEqual(before);
    expect(db.table('Domain').has('WS#aerospace|CAPA#c2')).toBe(false);
  });
  it('atomicity: a failing Domain condition writes no audit item', async () => {
    const db = new FakeDynamo();
    db.failDomain = true;
    await expect(appendAudit(db, [domain()], event, fixed)).rejects.toBeInstanceOf(TransactionCanceledException);
    expect(db.table('AuditLog').size).toBe(0);
  });
  it('349 KB Domain item passes; 351 KB gets 413 and nothing is sent', async () => {
    const db = new FakeDynamo();
    const sized = (n: number) => domain({ Item: { PK: { S: 'WS#aerospace' }, SK: { S: 'CAPA#c9' }, body: { S: kb(n) } } });
    await appendAudit(db, [sized(349)], event, fixed);
    const db2 = new FakeDynamo();
    const err = await appendAudit(db2, [sized(351)], event, fixed).catch((e) => e);
    expect(err).toBeInstanceOf(ProblemError);
    expect(err).toMatchObject({ status: 413, code: 'item_too_large', extra: { field: 'body' } });
    expect(db2.calls).toBe(0);
    expect(db2.table('AuditLog').size + db2.table('Domain').size).toBe(0);
  });
  it('accepts non-Put Domain writes (Update) and rejects an empty write list', async () => {
    const db = { send: async () => ({}) };
    await appendAudit(db, [{ Update: { TableName: 'Domain', Key: {}, UpdateExpression: 'SET a = :a' } }], event, fixed);
    await expect(appendAudit(db, [], event, fixed)).rejects.toThrow(/at least one/);
  });
});
