import { describe, expect, it, vi } from 'vitest';
import type { GetParameterCommand } from '@aws-sdk/client-ssm';
import { CACHE_TTL_MS, ConfigLoader, PARSERS, isValidTimeZone, type ConfigName } from '../../src/shared/config/configLoader.js';

const GOOD: Record<ConfigName, string> = {
  'edge/origin-verify': 'test-only-not-a-real-value-0000',
  'controlled-data/markers': 'ITAR,EAR,EAR99,ECCN,CUI,NOFORN,Distribution Statement,export controlled',
  'controlled-data/cfr-ranges': '[{"title":22,"partFrom":120,"partTo":130},{"title":15,"partFrom":730,"partTo":774}]',
  'supplier-risk/weights': '{"placeholder":true,"weights":{"openScars":0.25,"onTimePct":0.25,"criticality":0.25,"certFreshness":0.25},"bands":[{"name":"At risk","min":0},{"name":"Watch","min":60},{"name":"Approved","min":80}]}',
  'due-soon-days': '{"status":"PLACEHOLDER","calibration":30,"training":30,"supplierReeval":30}',
  'capa-ncmr/default-due-days': '{"status":"PLACEHOLDER","days":30}',
  'workspace/timezone': 'America/New_York',
};

function setup(values: Partial<Record<ConfigName, string | Error | undefined>> = GOOD) {
  let t = 0;
  const store = { ...values };
  const calls: string[] = [];
  const ssm = {
    send: vi.fn(async (c: GetParameterCommand) => {
      const name = c.input.Name!.replace('/sentinelqa/dev/', '') as ConfigName;
      calls.push(c.input.Name!);
      const v = store[name];
      if (v instanceof Error) throw v;
      return { Parameter: v === undefined ? undefined : { Value: v } };
    }),
  };
  const log = vi.fn();
  const metric = vi.fn();
  const loader = new ConfigLoader({ ssm, env: 'dev', now: () => t, log, metric });
  return { loader, store, calls, log, metric, tick: (ms: number) => (t += ms) };
}
const status = async (p: Promise<unknown>) => p.then(() => 'ok', (e) => `${e.status} ${e.code}`);

describe('config loader (overview §4.2, QA-31)', () => {
  it('parses every good value', async () => {
    const { loader, calls } = setup();
    for (const n of Object.keys(GOOD) as ConfigName[]) await loader.get(n);
    expect(await loader.get('capa-ncmr/default-due-days')).toBe(30);
    expect(calls[0]).toBe('/sentinelqa/dev/edge/origin-verify');
    expect(await loader.gateConfig()).toEqual({ markers: GOOD['controlled-data/markers'].split(','), cfrRanges: JSON.parse(GOOD['controlled-data/cfr-ranges']) });
  });
  it('caches a good value for 5 minutes, then refreshes', async () => {
    const { loader, calls, tick, store } = setup();
    await loader.get('workspace/timezone');
    tick(CACHE_TTL_MS - 1);
    await loader.get('workspace/timezone');
    expect(calls).toHaveLength(1);
    store['workspace/timezone'] = 'Europe/London';
    tick(1);
    expect(await loader.get('workspace/timezone')).toBe('Europe/London');
    expect(calls).toHaveLength(2);
  });
  it('a failed refresh keeps the last good value', async () => {
    const { loader, store, tick, metric } = setup();
    await loader.get('controlled-data/markers');
    store['controlled-data/markers'] = new Error('throttled');
    tick(CACHE_TTL_MS);
    expect(await loader.get('controlled-data/markers')).toContain('ITAR');
    store['controlled-data/markers'] = '';
    tick(CACHE_TTL_MS);
    expect(await loader.get('controlled-data/markers')).toContain('ITAR');
    expect(metric).toHaveBeenCalledTimes(2);
  });
  it.each([undefined, new Error('AccessDenied'), 'short'])('origin secret missing/unreadable/malformed (%s) -> 403', async (v) => {
    const { loader } = setup({ ...GOOD, 'edge/origin-verify': v });
    expect(await status(loader.get('edge/origin-verify'))).toBe('403 forbidden_origin');
  });
  it.each<[ConfigName, string | undefined]>([
    ['controlled-data/markers', undefined], ['controlled-data/markers', ''], ['controlled-data/markers', 'ITAR,,EAR'],
    ['controlled-data/cfr-ranges', undefined], ['controlled-data/cfr-ranges', '[]'], ['controlled-data/cfr-ranges', '{}'],
    ['controlled-data/cfr-ranges', '[{"title":22,"partFrom":130,"partTo":120}]'], ['controlled-data/cfr-ranges', '[{"title":22.5,"partFrom":1,"partTo":2}]'],
    ['controlled-data/cfr-ranges', '[5]'], ['controlled-data/cfr-ranges', 'not json'],
  ])('gate config %s=%s -> 503 for free-text writes; reads still work', async (n, v) => {
    const { loader } = setup({ ...GOOD, [n]: v });
    expect(await status(loader.gateConfig())).toBe('503 config_unavailable');
    expect(await status(loader.get('workspace/timezone'))).toBe('ok');
  });
  it.each<[ConfigName, string]>([
    ['supplier-risk/weights', '{"weights":{"a":0.5,"b":0.4},"bands":[{"name":"x","min":0}]}'],
    ['supplier-risk/weights', '{"weights":{"a":0.5,"b":0.5},"bands":[{"name":"x","min":60},{"name":"y","min":0}]}'],
    ['supplier-risk/weights', '{"weights":{},"bands":[{"name":"x","min":0}]}'],
    ['supplier-risk/weights', '{"weights":{"a":"1"},"bands":[{"name":"x","min":0}]}'],
    ['supplier-risk/weights', '{"weights":{"a":1},"bands":[]}'],
    ['supplier-risk/weights', '{"weights":{"a":1},"bands":[{"name":1,"min":0}]}'],
    ['supplier-risk/weights', '[]'],
    ['due-soon-days', '{"calibration":0,"training":30,"supplierReeval":30}'],
    ['due-soon-days', '{"calibration":1.5,"training":30,"supplierReeval":30}'],
    ['due-soon-days', '"30"'],
    ['capa-ncmr/default-due-days', '{"days":-1}'], ['capa-ncmr/default-due-days', '30'],
    ['workspace/timezone', 'Mars/Olympus'], ['workspace/timezone', ''],
  ])('%s malformed -> 503 only on that parameter', async (n, v) => {
    const { loader, log, metric } = setup({ ...GOOD, [n]: v });
    expect(await status(loader.get(n))).toBe('503 config_unavailable');
    expect(await status(loader.get('controlled-data/markers'))).toBe('ok');
    expect(log).toHaveBeenCalledWith({ level: 'ERROR', errorCode: 'config_unavailable', parameter: n, reason: 'malformed' });
    if (v) expect(JSON.stringify(log.mock.calls)).not.toContain(v);
    expect(metric).toHaveBeenCalledWith('ConfigErrors', { Env: 'dev' });
  });
  it('weights within ±0.001 pass', () => {
    expect(PARSERS['supplier-risk/weights']('{"weights":{"a":0.3334,"b":0.3333,"c":0.3333},"bands":[{"name":"x","min":0}]}').weights.a).toBe(0.3334);
  });
  it('missing logs reason missing; works without log/metric hooks', async () => {
    const { loader, log } = setup({ ...GOOD, 'workspace/timezone': undefined });
    await status(loader.get('workspace/timezone'));
    expect(log.mock.calls[0][0].reason).toBe('missing');
    const bare = new ConfigLoader({ ssm: { send: async () => ({ Parameter: undefined }) }, env: 'dev' });
    expect(await status(bare.get('due-soon-days'))).toBe('503 config_unavailable');
  });
  it('isValidTimeZone', () => {
    expect(isValidTimeZone('America/Chicago')).toBe(true);
    expect(isValidTimeZone('Nope/Nope')).toBe(false);
  });
});
