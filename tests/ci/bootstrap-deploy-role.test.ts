import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const TPL = resolve(__dirname, '../../docs/architecture/iac/templates/00-bootstrap.yaml');
const EXPECTED =
  'arn:${AWS::Partition}:lambda:${AWS::Region}:${AWS::AccountId}:function:SentinelQA-${EnvName}-records-api';

/** Returns the InvokeRecordsApiProbe statement block text from the DeployRole section. */
export function probeStatement(tpl: string): string {
  const deploy = tpl.slice(tpl.indexOf('  DeployRole:'), tpl.indexOf('\nOutputs:'));
  const m = deploy.match(/- Sid: InvokeRecordsApiProbe[^\n]*\n((?:\s{16}\S[^\n]*\n?)+)/);
  if (!m) throw new Error('InvokeRecordsApiProbe missing from DeployRole');
  return m[1];
}

export function checkProbe(tpl: string): void {
  const body = probeStatement(tpl);
  if (!/Effect: Allow\n/.test(body)) throw new Error('not Allow');
  if (!/Action: lambda:InvokeFunction\n/.test(body)) throw new Error('action must be lambda:InvokeFunction only');
  const res = body.match(/Resource: !Sub (\S+)/)?.[1];
  if (res !== EXPECTED) throw new Error(`resource must be exactly records-api, got ${res}`);
}

describe('00-bootstrap DeployRole InvokeRecordsApiProbe', () => {
  const tpl = readFileSync(TPL, 'utf8');
  it('grants InvokeFunction on records-api only', () => expect(() => checkProbe(tpl)).not.toThrow());
  it('appears exactly once and only in DeployRole', () => {
    expect(tpl.match(/Sid: InvokeRecordsApiProbe/g)?.length).toBe(1);
    expect(tpl.indexOf('Sid: InvokeRecordsApiProbe')).toBeGreaterThan(tpl.indexOf('  DeployRole:'));
  });
  it('rejects a wildcard function ARN', () => {
    expect(() => checkProbe(tpl.replace('SentinelQA-${EnvName}-records-api', 'SentinelQA-${EnvName}-*'))).toThrow();
    expect(() => checkProbe(tpl.replace(EXPECTED, '*'))).toThrow();
  });
  it('rejects extra actions', () => {
    expect(() => checkProbe(tpl.replace('Action: lambda:InvokeFunction', 'Action: [lambda:InvokeFunction, lambda:InvokeAsync]'))).toThrow();
  });
});
