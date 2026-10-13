import type { AttributeValue } from '@aws-sdk/client-dynamodb';

/** Max size of a Domain item or a compressed audit item (overview §4.3). */
export const ITEM_CAP_BYTES = 350 * 1024;

const utf8 = (s: string) => Buffer.byteLength(s, 'utf8');

/** Number size per DynamoDB rules: ~1 byte per 2 significant digits, plus 1. */
function numberSize(n: string): number {
  const digits = n.replace(/^-/, '').replace(/[eE].*$/, '').replace('.', '').replace(/^0+/, '').replace(/0+$/, '');
  return Math.ceil(Math.max(digits.length, 1) / 2) + 1;
}

/** Size of one attribute value (DynamoDB item size rules). */
export function valueSize(v: AttributeValue): number {
  if (v.S !== undefined) return utf8(v.S);
  if (v.N !== undefined) return numberSize(v.N);
  if (v.B !== undefined) return v.B.byteLength;
  if (v.BOOL !== undefined || v.NULL !== undefined) return 1;
  if (v.SS !== undefined) return v.SS.reduce((a, s) => a + utf8(s), 0);
  if (v.NS !== undefined) return v.NS.reduce((a, s) => a + numberSize(s), 0);
  if (v.BS !== undefined) return v.BS.reduce((a, b) => a + b.byteLength, 0);
  if (v.L !== undefined) return 3 + v.L.reduce((a, x) => a + 1 + valueSize(x), 0);
  if (v.M !== undefined) return 3 + itemSize(v.M) + Object.keys(v.M).length;
  throw new Error('unsupported AttributeValue');
}

/** Item size: attribute names (UTF-8) plus values. */
export function itemSize(item: Record<string, AttributeValue>): number {
  return Object.entries(item).reduce((a, [k, v]) => a + utf8(k) + valueSize(v), 0);
}

/** Name of the largest top-level attribute, for the 413 `field` hint. */
export function largestField(item: Record<string, AttributeValue>): string {
  let best = '';
  let max = -1;
  for (const [k, v] of Object.entries(item)) {
    const s = utf8(k) + valueSize(v);
    if (s > max) { max = s; best = k; }
  }
  return best;
}
