import { describe, expect, it } from 'vitest';
import { pickPedestal } from './catalog';

const pick = (h: number) => {
  const r = pickPedestal(h);
  return r.ok ? `${r.spec.pedestal.min}-${r.spec.pedestal.max}${r.spec.expanders.length ? '+' + r.spec.expanders.join('+') : ''}` : r.reason;
};

describe('pickPedestal', () => {
  it('picks the range that contains the height', () => {
    expect(pick(15)).toBe('13-18');
    expect(pick(40)).toBe('29-47');
    expect(pick(70)).toBe('65-119');
    expect(pick(200)).toBe('173-300');
  });

  it('prefers the range with more adjustment room at overlaps', () => {
    // 18 is the top of 13–18 and the bottom of 18–23: both have zero room, take the less extended one.
    expect(pick(18)).toBe('18-23');
    expect(pick(65)).toBe('65-119');
  });

  it('flags heights outside the system', () => {
    expect(pick(12)).toBe('too-low');
    expect(pick(501)).toBe('too-high');
  });

  it('adds expanders above 300 mm, fewest pieces first', () => {
    expect(pick(320)).toBe('173-300+100');
    expect(pick(400)).toBe('173-300+100');
    expect(pick(450)).toBe('173-300+100+100');
    expect(pick(500)).toBe('173-300+100+100');
  });
});
