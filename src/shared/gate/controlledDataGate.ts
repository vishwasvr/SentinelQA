// Controlled-data gate matcher (BR-44, DP-03, ADR-0005; overview §4 step 2).
import { ProblemError } from '../problem.js';

export interface CfrRange { title: number; partFrom: number; partTo: number }
export interface GateConfig { markers: string[]; cfrRanges: CfrRange[] }
/** Marker id: K<n> for keyword n, R<n> for CFR range n (1-based list position). */
export type MarkerId = `K${number}` | `R${number}`;

const BOUND_L = '(?<![\\p{L}\\p{N}])';
const BOUND_R = '(?![\\p{L}\\p{N}])';
// Same citation shape as iac/tools/test_marker_patterns.py.
const CITE = /(?<!\d)(\d{1,2})\s*C\.?F\.?R\.?\s*(?:Parts?\s*|§+\s*)?(\d{1,4})(?:\.\d+)*(?!\d)/giu;

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** NFKC, case-fold, collapse whitespace (DP-03). */
export function normalise(text: string): string {
  return text.normalize('NFKC').toLowerCase().replace(/\s+/gu, ' ').trim();
}

/**
 * DP-03: `.`, `-`, `_` between letters are separators. Two readings are screened:
 * joined ("I.T.A.R" -> "itar") and spaced ("export-controlled" -> "export controlled").
 */
function variants(n: string): string[] {
  const between = /(?<=\p{L})[._-]+(?=\p{L})/gu;
  return [n, n.replace(between, ''), n.replace(between, ' ')];
}

function cfrHit(text: string, ranges: CfrRange[]): number {
  for (const m of text.matchAll(CITE)) {
    const title = Number(m[1]);
    const part = Number(m[2]);
    const i = ranges.findIndex((r) => r.title === title && r.partFrom <= part && part <= r.partTo);
    if (i >= 0) return i;
  }
  return -1;
}

/** Returns the first matching marker id, or null. Throws if config is empty (the gate never runs with an empty list). */
export function findMarker(text: string, cfg: GateConfig): MarkerId | null {
  if (cfg.markers.length === 0 || cfg.cfrRanges.length === 0) throw new Error('gate config is empty');
  const vs = variants(normalise(text));
  for (const [i, kw] of cfg.markers.entries()) {
    const re = new RegExp(BOUND_L + esc(normalise(kw)).replace(/ /g, ' ') + BOUND_R, 'u');
    if (vs.some((v) => re.test(v))) return `K${i + 1}`;
  }
  for (const v of vs) {
    const r = cfrHit(v, cfg.cfrRanges);
    if (r >= 0) return `R${r + 1}`;
  }
  return null;
}

/**
 * Screens every free-text field of a write. 400 gate:attestation_required without attestation,
 * 422 gate:controlled_marker on a hit (only markerId is exposed, never the matched text).
 */
export function screenFreeText(fields: Record<string, string | undefined>, attestation: unknown, cfg: GateConfig): void {
  const texts = Object.values(fields).filter((v): v is string => typeof v === 'string' && v.length > 0);
  if (texts.length === 0) return;
  if (attestation !== true) throw new ProblemError(400, 'gate:attestation_required');
  for (const t of texts) {
    const markerId = findMarker(t, cfg);
    if (markerId) throw new ProblemError(422, 'gate:controlled_marker', { markerId });
  }
}
