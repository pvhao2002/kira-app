import {describe, expect, it} from 'vitest';
import {AA_RATIO, whiteContrast} from './contrast';
import {vnd} from './format';

describe('helpers', () => {
  it('white on dark green passes AA, on pale yellow fails', () => {
    expect(whiteContrast('#2e5233')).toBeGreaterThanOrEqual(AA_RATIO);
    expect(whiteContrast('#f2d98a')).toBeLessThan(AA_RATIO);
  });
  it('formats VND with vi-VN grouping', () => {
    expect(vnd(45000)).toBe('₫45.000');
  });
});
