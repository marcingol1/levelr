import { describe, expect, it } from 'vitest';
import { parseLen, parseLenList, toUnit } from './units';

describe('units', () => {
  it('parses lengths with and without units', () => {
    expect(parseLen('72', 'mm')).toBe(72);
    expect(parseLen('7,2', 'cm')).toBe(72);
    expect(parseLen('20 cm', 'mm')).toBe(200);
    expect(parseLen('0.5m', 'mm')).toBe(500);
    expect(parseLen('abc', 'mm')).toBeNull();
  });

  it('parses bulk level lists', () => {
    expect(parseLenList('70, 120, 20 cm', 'mm')).toEqual([70, 120, 200]);
    expect(parseLenList('7 12 20', 'cm')).toEqual([70, 120, 200]);
  });

  it('formats for inputs', () => {
    expect(toUnit(586, 'cm')).toBe('58.6');
    expect(toUnit(600, 'cm')).toBe('60');
  });
});
