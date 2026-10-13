// In-memory TransactWriteItems fake (no AWS). Enforces attribute_not_exists(PK) AND attribute_not_exists(SK)
// and "version = :expected"-style failures via a hook, all-or-nothing like DynamoDB.
import type { AttributeValue, TransactWriteItemsCommand } from '@aws-sdk/client-dynamodb';
import { TransactionCanceledException } from '@aws-sdk/client-dynamodb';

export class FakeDynamo {
  tables = new Map<string, Map<string, Record<string, AttributeValue>>>();
  failDomain = false;
  calls = 0;
  table(n: string) {
    if (!this.tables.has(n)) this.tables.set(n, new Map());
    return this.tables.get(n)!;
  }
  async send(cmd: TransactWriteItemsCommand): Promise<unknown> {
    this.calls++;
    const items = cmd.input.TransactItems ?? [];
    const reasons = items.map((t) => {
      const p = t.Put!;
      const key = `${p.Item!.PK.S}|${p.Item!.SK.S}`;
      if (p.ConditionExpression === 'attribute_not_exists(PK) AND attribute_not_exists(SK)' && this.table(p.TableName!).has(key))
        return { Code: 'ConditionalCheckFailed' };
      if (p.ConditionExpression === 'version = :expected' && this.failDomain) return { Code: 'ConditionalCheckFailed' };
      return { Code: 'None' };
    });
    if (reasons.some((r) => r.Code !== 'None'))
      throw new TransactionCanceledException({ message: 'cancelled', $metadata: {}, CancellationReasons: reasons });
    for (const t of items) this.table(t.Put!.TableName!).set(`${t.Put!.Item!.PK.S}|${t.Put!.Item!.SK.S}`, structuredClone(t.Put!.Item!));
    return {};
  }
}
