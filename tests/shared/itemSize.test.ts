import { describe, expect, it } from 'vitest';
import { itemSize, valueSize, largestField, ITEM_CAP_BYTES } from '../../src/shared/itemSize.js';

describe('item size (overview §4.3)', () => {
  it('cap is 350 KB', () => expect(ITEM_CAP_BYTES).toBe(358400));
  it('sizes each type per DynamoDB rules', () => {
    expect(valueSize({ S: 'héllo' })).toBe(6);
    expect(valueSize({ N: '123' })).toBe(3);
    expect(valueSize({ N: '-0.0012e5' })).toBe(2);
    expect(valueSize({ N: '0' })).toBe(2);
    expect(valueSize({ B: new Uint8Array(10) })).toBe(10);
    expect(valueSize({ BOOL: true })).toBe(1);
    expect(valueSize({ NULL: true })).toBe(1);
    expect(valueSize({ SS: ['ab', 'c'] })).toBe(3);
    expect(valueSize({ NS: ['1', '22'] })).toBe(4);
    expect(valueSize({ BS: [new Uint8Array(2), new Uint8Array(3)] })).toBe(5);
    expect(valueSize({ L: [{ S: 'a' }, { BOOL: false }] })).toBe(3 + 2 + 2);
    expect(valueSize({ M: { k: { S: 'v' } } })).toBe(3 + 2 + 1);
    expect(() => valueSize({} as never)).toThrow();
  });
  it('item size = names + values; largest field', () => {
    const item = { ab: { S: 'xyz' }, big: { S: 'a'.repeat(10) } };
    expect(itemSize(item)).toBe(2 + 3 + 3 + 10);
    expect(largestField(item)).toBe('big');
  });
});
