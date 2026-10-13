// Runtime config loader (overview §4.2, QA-31; spec §3 QA-31 tests).
// One loader for every /sentinelqa/<env>/ parameter, 5-minute cache, last-good on refresh failure,
// fail closed with 503 config_unavailable (403 forbidden_origin for the origin secret). Never logs values.
import { GetParameterCommand } from '@aws-sdk/client-ssm';
import type { GetParameterCommandOutput } from '@aws-sdk/client-ssm';
import { ProblemError } from '../problem.js';
import type { CfrRange } from '../gate/controlledDataGate.js';

export const CACHE_TTL_MS = 5 * 60 * 1000;

export interface SupplierRisk { weights: Record<string, number>; bands: { name: string; min: number }[] }
export interface ConfigValues {
  'edge/origin-verify': string;
  'controlled-data/markers': string[];
  'controlled-data/cfr-ranges': CfrRange[];
  'supplier-risk/weights': SupplierRisk;
  'due-soon-days': Record<string, number>;
  'capa-ncmr/default-due-days': number;
  'workspace/timezone': string;
}
export type ConfigName = keyof ConfigValues;

class Malformed extends Error {}
const bad = (): never => { throw new Malformed(); };
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const posInt = (v: unknown): number => (Number.isInteger(v) && (v as number) > 0 ? (v as number) : bad());

export function isValidTimeZone(tz: string): boolean {
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return tz.length > 0; } catch { return false; }
}

/** Parsers: throw on malformed input (overview §4.2 schema checks). */
export const PARSERS: { [K in ConfigName]: (raw: string) => ConfigValues[K] } = {
  'edge/origin-verify': (raw) => (raw.trim().length >= 16 ? raw : bad()),
  'controlled-data/markers': (raw) => {
    const list = raw.split(',').map((s) => s.trim());
    return list.length > 0 && list.every((s) => s.length > 0) ? list : bad();
  },
  'controlled-data/cfr-ranges': (raw) => {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v) || v.length === 0) bad();
    return (v as unknown[]).map((r) => {
      if (!isObj(r)) bad();
      const o = r as Record<string, unknown>;
      const title = posInt(o.title), partFrom = posInt(o.partFrom), partTo = posInt(o.partTo);
      return partFrom <= partTo ? { title, partFrom, partTo } : bad();
    });
  },
  'supplier-risk/weights': (raw) => {
    const v: unknown = JSON.parse(raw);
    if (!isObj(v) || !isObj(v.weights) || !Array.isArray(v.bands) || v.bands.length === 0) bad();
    const o = v as Record<string, unknown>;
    const weights = o.weights as Record<string, unknown>;
    const ws = Object.values(weights);
    if (ws.length === 0 || !ws.every((w) => typeof w === 'number' && w >= 0)) bad();
    if (Math.abs((ws as number[]).reduce((a, b) => a + b, 0) - 1) > 0.001) bad();
    const bands = (o.bands as unknown[]).map((b) =>
      isObj(b) && typeof b.name === 'string' && typeof b.min === 'number' ? { name: b.name, min: b.min } : bad(),
    );
    for (let i = 1; i < bands.length; i++) if (bands[i].min <= bands[i - 1].min) bad();
    return { weights: weights as Record<string, number>, bands };
  },
  'due-soon-days': (raw) => {
    const v: unknown = JSON.parse(raw);
    if (!isObj(v)) bad();
    const out: Record<string, number> = {};
    for (const k of ['calibration', 'training', 'supplierReeval']) out[k] = posInt((v as Record<string, unknown>)[k]);
    return out;
  },
  'capa-ncmr/default-due-days': (raw) => {
    const v: unknown = JSON.parse(raw);
    return isObj(v) ? posInt(v.days) : bad();
  },
  'workspace/timezone': (raw) => (isValidTimeZone(raw) ? raw : bad()),
};

export interface SsmLike { send(cmd: GetParameterCommand): Promise<Pick<GetParameterCommandOutput, 'Parameter'>> }
export interface LoaderDeps {
  ssm: SsmLike;
  env: string;
  now?: () => number;
  log?: (entry: { level: 'ERROR'; errorCode: 'config_unavailable'; parameter: string; reason: 'missing' | 'malformed' }) => void;
  metric?: (name: 'ConfigErrors', dims: { Env: string }) => void;
}

export class ConfigLoader {
  private cache = new Map<ConfigName, { value: unknown; fetchedAt: number }>();
  constructor(private readonly deps: LoaderDeps) {}

  /** Returns the parameter or throws the §4.2 failure (503 config_unavailable / 403 forbidden_origin). */
  async get<K extends ConfigName>(name: K): Promise<ConfigValues[K]> {
    const now = (this.deps.now ?? Date.now)();
    const hit = this.cache.get(name);
    if (hit && now - hit.fetchedAt < CACHE_TTL_MS) return hit.value as ConfigValues[K];
    let reason: 'missing' | 'malformed' = 'missing';
    try {
      const out = await this.deps.ssm.send(
        new GetParameterCommand({ Name: `/sentinelqa/${this.deps.env}/${name}`, WithDecryption: true }),
      );
      const raw = out.Parameter?.Value;
      if (raw === undefined) throw new Error('missing');
      reason = 'malformed';
      const value = PARSERS[name](raw);
      this.cache.set(name, { value, fetchedAt: now });
      return value;
    } catch {
      this.deps.log?.({ level: 'ERROR', errorCode: 'config_unavailable', parameter: name, reason });
      this.deps.metric?.('ConfigErrors', { Env: this.deps.env });
      if (hit) return hit.value as ConfigValues[K]; // last good value
      if (name === 'edge/origin-verify') throw new ProblemError(403, 'forbidden_origin');
      throw new ProblemError(503, 'config_unavailable');
    }
  }

  /** Gate config for free-text writes; both lists or 503 (the gate never runs with an empty list). */
  async gateConfig(): Promise<{ markers: string[]; cfrRanges: CfrRange[] }> {
    const markers = await this.get('controlled-data/markers');
    const cfrRanges = await this.get('controlled-data/cfr-ranges');
    return { markers, cfrRanges };
  }
}
