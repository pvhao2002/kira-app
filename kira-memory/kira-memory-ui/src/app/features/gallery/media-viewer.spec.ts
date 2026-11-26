import {swipeStep} from './media-viewer';

describe('swipeStep', () => {
  it('goes to the next memory on a swipe to the left and back on a swipe to the right', () => {
    expect(swipeStep(-120, 10)).toBe(1);
    expect(swipeStep(90, -20)).toBe(-1);
  });

  it('ignores taps and short nudges', () => {
    expect(swipeStep(0, 0)).toBe(0);
    expect(swipeStep(-30, 0)).toBe(0);
  });

  it('ignores mostly vertical moves, which are scrolls', () => {
    expect(swipeStep(-80, 200)).toBe(0);
    expect(swipeStep(60, -60)).toBe(0);
  });
});
