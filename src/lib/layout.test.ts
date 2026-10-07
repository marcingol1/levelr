import { describe, expect, it } from 'vitest';
import { buildAxis, buildLayout, remapHeights, resolvePattern } from './layout';

const base = { width: 1200, depth: 600, tileW: 600, tileL: 600, joint: 0, pattern: 'corners' as const, disabled: new Set<string>() };

describe('buildAxis', () => {
  it('splits a length into tiles with a cut remainder', () => {
    const a = buildAxis(1500, 600, 2, false);
    expect(a.spans.map((s) => [s.start, s.end, s.cut])).toEqual([
      [0, 600, false],
      [602, 1202, false],
      [1204, 1500, true],
    ]);
    // Legs at both edges and centred under each joint.
    expect(a.lines).toEqual([0, 601, 1203, 1500]);
  });

  it('does not create a sliver span when the remainder is only the joint', () => {
    expect(buildAxis(1202, 600, 2, false).spans).toHaveLength(2);
  });
});

describe('buildLayout', () => {
  it('shares corner legs between tiles', () => {
    const l = buildLayout(base);
    expect(l.tiles).toHaveLength(2);
    expect(l.nodes).toHaveLength(6);
  });

  it('3×3 tiles need 16 legs with corner supports', () => {
    expect(buildLayout({ ...base, width: 1800, depth: 1800 }).nodes).toHaveLength(16);
  });

  it('adds long-edge supports for 60×120 tiles', () => {
    const l = buildLayout({ ...base, width: 1200, depth: 600, tileW: 1200, pattern: 'auto' });
    expect(l.roles).toEqual({ midX: true, midY: false, center: false });
    expect(l.nodes).toHaveLength(6);
  });

  it('adds a centre support for 90×90 tiles', () => {
    expect(resolvePattern('auto', 900, 900)).toEqual({ midX: false, midY: false, center: true });
    expect(buildLayout({ ...base, width: 900, depth: 900, tileW: 900, tileL: 900, pattern: 'auto' }).nodes).toHaveLength(5);
  });

  it('drops legs that only serve disabled tiles', () => {
    const l = buildLayout({ ...base, disabled: new Set(['1,0']) });
    expect(l.nodes).toHaveLength(4);
    expect(l.tiles.filter((t) => t.enabled)).toHaveLength(1);
  });
});

describe('remapHeights', () => {
  it('keeps exact matches and inherits nearest for new points', () => {
    const a = buildLayout(base);
    const heights = { [a.nodes[0].key]: 'x' };
    const b = buildLayout({ ...base, tileW: 300 });
    const out = remapHeights(a.nodes, heights, b.nodes, 600);
    expect(out[a.nodes[0].key]).toBe('x');
  });
});
