import { describe, expect, it } from 'vitest';
import { parseTags, readMinutes, slugify } from './content';

describe('content helpers', () => {
  it('slugifies titles', () => {
    expect(slugify('Deep Dive: Saga Pattern & 2PC!')).toBe('deep-dive-saga-pattern-2pc');
    expect(slugify('Tiếng Việt')).toBe('tieng-viet');
    expect(slugify('!!!')).toBe('untitled');
  });
  it('estimates read minutes at 220 wpm, min 1', () => {
    expect(readMinutes('')).toBe(1);
    expect(readMinutes('w '.repeat(441))).toBe(3);
  });
  it('parses tags from a string or array', () => {
    expect(parseTags('Java, Loom ,,')).toEqual(['Java', 'Loom']);
    expect(parseTags(['a', ' b '])).toEqual(['a', 'b']);
  });
});
