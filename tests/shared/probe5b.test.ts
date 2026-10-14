import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PutItemCommand, TransactWriteItemsCommand } from '@aws-sdk/client-dynamodb';
import { isProbeEvent, runProbe5b, type ProbeSender } from '../../src/shared/audit/probe5b.js';

const fixed = { now: () => new Date('2026-10-14T14:00:00.000Z'), ulid: () => '01TESTULID0000000000000000', tableName: 'AuditLogT' };
const err = (name: string) => Object.assign(new Error('x'), { name });

function mockClient(put: () => Promise<unknown>, tx: () => Promise<unknown> = async () => ({})) {
  const calls: unknown[] = [];
  const c: ProbeSender = {
    send: vi.fn(async (cmd) => { calls.push(cmd); return cmd instanceof TransactWriteItemsCommand ? tx() : put(); }),
  };
  return { c, calls };
}

describe('isProbeEvent', () => {
  it('accepts only exactly {"probe":"qa-5b"}', () => {
    expect(isProbeEvent({ probe: 'qa-5b' })).toBe(true);
    for (const e of [null, undefined, 'qa-5b', 5, [], ['qa-5b'], {}, { probe: 'qa-5a' }, { probe: 'qa-5b', x: 1 },
      { probe: 'qa-5b', requestContext: {} }, { requestContext: { http: {} }, rawPath: '/' }, { Probe: 'qa-5b' }]) {
      expect(isProbeEvent(e)).toBe(false);
    }
  });
});

describe('runProbe5b', () => {
  const saved = process.env.DEPLOY_ENV;
  afterEach(() => { if (saved === undefined) delete process.env.DEPLOY_ENV; else process.env.DEPLOY_ENV = saved; });

  it.each([['prod'], ['production'], ['DEV'], [undefined]])('refuses DEPLOY_ENV=%s and sends nothing', async (env) => {
    if (env === undefined) delete process.env.DEPLOY_ENV; else process.env.DEPLOY_ENV = env;
    const { c } = mockClient(async () => ({}));
    const r = await runProbe5b(c, fixed);
    expect(r.pass).toBe(false);
    expect(r.refused).toMatch(/probe refused/);
    expect(r.eventKeys).toBeUndefined();
    expect(c.send).not.toHaveBeenCalled();
  });

  describe('in dev/stage', () => {
    beforeEach(() => { process.env.DEPLOY_ENV = 'dev'; });

    it('passes: audit transact written + bare PutItem AccessDeniedException', async () => {
      const { c, calls } = mockClient(async () => { throw err('AccessDeniedException'); });
      const r = await runProbe5b(c, fixed);
      expect(r).toMatchObject({
        probe: 'qa-5b', env: 'dev', pass: true,
        eventKeys: { PK: 'WS#qa-5b-probe#ENT#qa-5b-probe', SK: '2026-10-14T14:00:00.000Z#01TESTULID0000000000000000' },
        auditTransact: { ok: true, outcome: 'written' },
        barePutItem: { ok: true, outcome: 'denied', error: 'AccessDeniedException' },
      });
      const tx = calls[0] as TransactWriteItemsCommand;
      expect(tx.input.TransactItems).toHaveLength(1);
      const p = tx.input.TransactItems![0].Put!;
      expect(p.TableName).toBe('AuditLogT');
      expect(p.ConditionExpression).toBe('attribute_not_exists(PK) AND attribute_not_exists(SK)');
      expect(p.Item!.entityType.S).toBe('qa-5b-probe');
      const bare = calls[1] as PutItemCommand;
      expect(bare).toBeInstanceOf(PutItemCommand);
      expect(bare.input.TableName).toBe('AuditLogT');
      expect(bare.input.Item!.SK.S).toBe(`${p.Item!.SK.S}#bare-put`);
      expect(bare.input.ConditionExpression).toBeUndefined();
      expect(JSON.stringify(r)).not.toContain('snapshot');
    });

    it('accepts AccessDenied (stage) too', async () => {
      process.env.DEPLOY_ENV = 'stage';
      const { c } = mockClient(async () => { throw err('AccessDenied'); });
      expect((await runProbe5b(c, fixed)).pass).toBe(true);
    });

    it('fails when the bare PutItem succeeds', async () => {
      const { c } = mockClient(async () => ({}));
      const r = await runProbe5b(c, fixed);
      expect(r.pass).toBe(false);
      expect(r.barePutItem).toMatchObject({ ok: false });
      expect(r.barePutItem!.outcome).toMatch(/succeeded/);
    });

    it.each([[err('ResourceNotFoundException'), 'ResourceNotFoundException'], [{}, 'UnknownError'], [null, 'UnknownError']])(
      'fails when the bare PutItem errors with something other than AccessDenied', async (e, name) => {
        const { c } = mockClient(async () => { throw e; });
        const r = await runProbe5b(c, fixed);
        expect(r.pass).toBe(false);
        expect(r.barePutItem).toEqual({ ok: false, outcome: 'failed with unexpected error', error: name });
      });

    it('fails when the audit transaction fails, still reports the PutItem step', async () => {
      const { c } = mockClient(async () => { throw err('AccessDeniedException'); }, async () => { throw err('TransactionCanceledException'); });
      const r = await runProbe5b(c, fixed);
      expect(r.pass).toBe(false);
      expect(r.auditTransact).toEqual({ ok: false, outcome: 'failed', error: 'TransactionCanceledException' });
      expect(r.barePutItem!.ok).toBe(true);
    });

    it('writes a new event key on each run (append-only)', async () => {
      const { c, calls } = mockClient(async () => { throw err('AccessDeniedException'); });
      const a = await runProbe5b(c, { tableName: 'T' });
      const b = await runProbe5b(c, { tableName: 'T' });
      expect(a.eventKeys!.SK).not.toBe(b.eventKeys!.SK);
      expect(calls).toHaveLength(4);
    });
  });
});
