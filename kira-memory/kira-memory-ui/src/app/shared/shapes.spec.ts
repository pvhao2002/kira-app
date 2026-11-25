import {SHAPE_KEYS, shapeAt} from './shapes';

describe('shapeAt', () => {
  it('keeps a fixed shape', () => {
    expect(shapeAt('star', 0)).toBe('star');
  });

  it('changes every minute in auto, the same for any device at the same minute', () => {
    const minute = 29_000_000;
    const a = shapeAt('auto', minute * 60_000);
    expect(shapeAt('auto', minute * 60_000 + 59_999)).toBe(a);
    expect(shapeAt('auto', (minute + 1) * 60_000)).not.toBe(a);
    const week = new Set(Array.from({length: SHAPE_KEYS.length}, (_, i) => shapeAt('auto', (minute + i) * 60_000)));
    expect(week.size).toBe(SHAPE_KEYS.length);
  });
});
