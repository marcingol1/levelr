/**
 * Turns terrace + tile settings into a support lattice: tile spans along each
 * axis, the joint lines pedestals sit on, and the set of support points
 * ("legs") needed under every enabled tile.
 */

export type SupportPattern = 'auto' | 'corners' | 'center' | 'edges' | 'full';

export interface LayoutInput {
  width: number; // mm, X axis
  depth: number; // mm, Y axis
  tileW: number; // mm, tile size along X
  tileL: number; // mm, tile size along Y
  joint: number; // mm
  pattern: SupportPattern;
  disabled: ReadonlySet<string>; // tile keys "c,r"
}

export interface Span {
  start: number;
  end: number;
  cut: boolean;
}

export interface Axis {
  spans: Span[];
  /** Positions (mm) of every lattice line along this axis, ascending. */
  lines: number[];
  /** Per span: index of its start line, optional mid line, end line. */
  idx: { start: number; mid: number | null; end: number }[];
}

export interface Node {
  key: string;
  x: number;
  y: number;
  /** Tiles (keys) resting on this leg. */
  tiles: string[];
}

export interface Tile {
  key: string;
  c: number;
  r: number;
  x: number;
  y: number;
  w: number;
  h: number;
  cut: boolean;
  enabled: boolean;
  nodes: string[];
}

export interface Layout {
  x: Axis;
  y: Axis;
  tiles: Tile[];
  nodes: Node[];
  nodeByKey: Map<string, Node>;
  roles: Roles;
}

export interface Roles {
  midX: boolean; // midpoint of edges running along X
  midY: boolean; // midpoint of edges running along Y
  center: boolean;
}

/** Cut tiles narrower than this never get an intermediate support. */
export const MIN_SPAN_FOR_MID = 500;

export const tileKey = (c: number, r: number) => `${c},${r}`;
export const nodeKey = (x: number, y: number) => `${Math.round(x)}:${Math.round(y)}`;

export function resolvePattern(pattern: SupportPattern, tileW: number, tileL: number): Roles {
  const long = Math.max(tileW, tileL);
  const short = Math.min(tileW, tileL);
  let p = pattern;
  if (p === 'auto') {
    if (long <= 600) p = 'corners';
    else if (short <= 600) p = 'edges';
    else if (short < 1000) p = 'center';
    else p = 'full';
  }
  switch (p) {
    case 'corners':
      return { midX: false, midY: false, center: false };
    case 'center':
      return { midX: false, midY: false, center: true };
    case 'edges':
      return { midX: tileW >= tileL, midY: tileL >= tileW, center: false };
    case 'full':
      return { midX: true, midY: true, center: true };
    default:
      return { midX: false, midY: false, center: false };
  }
}

export function buildAxis(length: number, tile: number, joint: number, wantMid: boolean): Axis {
  const spans: Span[] = [];
  const pitch = tile + joint;
  if (length > 0 && tile > 0) {
    for (let pos = 0; pos < length - 0.5; pos += pitch) {
      const end = Math.min(pos + tile, length);
      spans.push({ start: pos, end, cut: end - pos < tile - 0.5 });
    }
  }

  const lines: number[] = [];
  const idx: Axis['idx'] = [];
  spans.forEach((s, i) => {
    if (i === 0) lines.push(s.start);
    const start = lines.length - 1;
    let mid: number | null = null;
    if (wantMid && s.end - s.start > MIN_SPAN_FOR_MID) {
      lines.push((s.start + s.end) / 2);
      mid = lines.length - 1;
    }
    const isLast = i === spans.length - 1;
    // Pedestals between tiles sit centred under the joint.
    lines.push(isLast ? s.end : Math.min(s.end + joint / 2, length));
    idx.push({ start, mid, end: lines.length - 1 });
  });
  return { spans, lines, idx };
}

export function buildLayout(input: LayoutInput): Layout {
  const roles = resolvePattern(input.pattern, input.tileW, input.tileL);
  const x = buildAxis(input.width, input.tileW, input.joint, roles.midX || roles.center);
  const y = buildAxis(input.depth, input.tileL, input.joint, roles.midY || roles.center);

  const tiles: Tile[] = [];
  const nodeByKey = new Map<string, Node>();

  y.spans.forEach((ys, r) => {
    x.spans.forEach((xs, c) => {
      const key = tileKey(c, r);
      const enabled = !input.disabled.has(key);
      const tile: Tile = {
        key,
        c,
        r,
        x: xs.start,
        y: ys.start,
        w: xs.end - xs.start,
        h: ys.end - ys.start,
        cut: xs.cut || ys.cut,
        enabled,
        nodes: [],
      };
      tiles.push(tile);
      if (!enabled) return;

      const xi = x.idx[c];
      const yi = y.idx[r];
      const points: [number, number][] = [
        [xi.start, yi.start],
        [xi.end, yi.start],
        [xi.start, yi.end],
        [xi.end, yi.end],
      ];
      if (roles.midX && xi.mid !== null) points.push([xi.mid, yi.start], [xi.mid, yi.end]);
      if (roles.midY && yi.mid !== null) points.push([xi.start, yi.mid], [xi.end, yi.mid]);
      if (roles.center && xi.mid !== null && yi.mid !== null) points.push([xi.mid, yi.mid]);

      for (const [i, j] of points) {
        const px = x.lines[i];
        const py = y.lines[j];
        const k = nodeKey(px, py);
        let node = nodeByKey.get(k);
        if (!node) {
          node = { key: k, x: px, y: py, tiles: [] };
          nodeByKey.set(k, node);
        }
        if (!node.tiles.includes(key)) node.tiles.push(key);
        if (!tile.nodes.includes(k)) tile.nodes.push(k);
      }
    });
  });

  const nodes = [...nodeByKey.values()].sort((a, b) => a.y - b.y || a.x - b.x);
  return { x, y, tiles, nodes, nodeByKey, roles };
}

/**
 * Carry painted heights over to a new lattice (e.g. after changing tile size):
 * exact positions are kept, new points inherit from the nearest old point.
 */
export function remapHeights<T>(
  oldNodes: Node[],
  heights: Record<string, T>,
  newNodes: Node[],
  maxDistance: number,
): Record<string, T> {
  const painted = oldNodes.filter((n) => n.key in heights);
  const out: Record<string, T> = {};
  if (!painted.length) return out;
  const max2 = maxDistance * maxDistance;
  for (const n of newNodes) {
    if (n.key in heights) {
      out[n.key] = heights[n.key];
      continue;
    }
    let best: Node | null = null;
    let bestD = Infinity;
    for (const o of painted) {
      const d = (o.x - n.x) ** 2 + (o.y - n.y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = o;
      }
    }
    if (best && bestD <= max2) out[n.key] = heights[best.key];
  }
  return out;
}

/** Carry disabled tiles over to a new grid by tile-centre position. */
export function remapDisabled(oldTiles: Tile[], newTiles: Tile[]): string[] {
  const off = oldTiles.filter((t) => !t.enabled);
  if (!off.length) return [];
  return newTiles
    .filter((t) => {
      const cx = t.x + t.w / 2;
      const cy = t.y + t.h / 2;
      return off.some((o) => cx >= o.x && cx <= o.x + o.w && cy >= o.y && cy <= o.y + o.h);
    })
    .map((t) => t.key);
}
