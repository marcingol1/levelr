import { describe, expect, it } from 'vitest';
import { summarize, withSpare } from './summary';
import { blankProject, layoutOf, reduce } from '../state/project';

describe('summarize', () => {
  it('counts legs per pedestal model, per height, with spare and pads', () => {
    let p = { ...blankProject(), width: 1800, depth: 1200, joint: 0, spare: 10 };
    p = reduce(p, { type: 'addLevels', levels: [{ name: 'High', height: 200 }] });
    const high = p.levels[1];
    const layout = layoutOf(p);
    // Right column of legs (x = 1800) on the high level: one tile gets two heights.
    const right = layout.nodes.filter((n) => n.x === 1800).map((n) => n.key);
    p = reduce(p, { type: 'paint', keys: right, value: high.id });

    const s = summarize(p, layoutOf(p));
    expect(s.legs).toBe(12);
    expect(s.byHeight.map((r) => [r.height, r.count])).toEqual([
      [80, 9],
      [200, 3],
    ]);
    // 80 mm minus the 2 mm acoustic pad → 78 mm → 65–119.
    expect(s.byModel.map((m) => [m.pedestal.id, m.count, m.order])).toEqual([
      ['pro-65-119', 9, 10],
      ['pro-173-300', 3, 4],
    ]);
    expect(s.accessories[0]).toMatchObject({ count: 12, order: 14, packs: 2 });
    expect(s.tiles).toEqual({ full: 6, cut: 0, area: expect.closeTo(2.16, 6) });
  });

  it('withSpare rounds up', () => {
    expect(withSpare(0, 5)).toBe(0);
    expect(withSpare(20, 5)).toBe(21);
    expect(withSpare(21, 5)).toBe(23);
  });
});
