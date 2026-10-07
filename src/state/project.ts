import { buildLayout, nodeKey, remapDisabled, remapHeights, type Layout, type SupportPattern } from '../lib/layout';
import { PAVER_SPACING_MM } from '../lib/catalog';

export type Unit = 'cm' | 'mm';

export interface Level {
  id: string;
  name: string;
  height: number; // mm, substrate → underside of tile
  color: string;
}

/** A leg's height is either a level reference or a free value in mm (gradients). */
export type HeightValue = string | number;

export interface Project {
  version: 1;
  name: string;
  width: number;
  depth: number;
  tileW: number;
  tileL: number;
  joint: number;
  pattern: SupportPattern;
  acousticPad: boolean;
  deductPad: boolean;
  slopeCorrector: boolean;
  spare: number; // %
  levels: Level[];
  baseLevelId: string;
  heights: Record<string, HeightValue>;
  disabled: string[];
}

export const LEVEL_COLORS = [
  '#2F7D6D',
  '#C4562E',
  '#3F6FB5',
  '#B58A1E',
  '#8150A8',
  '#3E8E3A',
  '#B83F6E',
  '#2A8CA0',
  '#8C6A4A',
  '#5E6876',
];

let seq = 0;
export const uid = () => `l${Date.now().toString(36)}${(seq++).toString(36)}`;

export function nextColor(levels: Level[]): string {
  const used = new Set(levels.map((l) => l.color));
  return LEVEL_COLORS.find((c) => !used.has(c)) ?? LEVEL_COLORS[levels.length % LEVEL_COLORS.length];
}

export const layoutOf = (p: Pick<Project, 'width' | 'depth' | 'tileW' | 'tileL' | 'joint' | 'pattern' | 'disabled'>): Layout =>
  buildLayout({ ...p, disabled: new Set(p.disabled) });

export function blankProject(): Project {
  const base: Level = { id: uid(), name: 'Base', height: 80, color: LEVEL_COLORS[0] };
  return {
    version: 1,
    name: 'My terrace',
    width: 4000,
    depth: 3000,
    tileW: 600,
    tileL: 600,
    joint: PAVER_SPACING_MM,
    pattern: 'auto',
    acousticPad: true,
    deductPad: true,
    slopeCorrector: false,
    spare: 5,
    levels: [base],
    baseLevelId: base.id,
    heights: {},
    disabled: [],
  };
}

/** A realistic example: a terrace stepping down from a slab, with a notch. */
export function demoProject(): Project {
  const slab: Level = { id: uid(), name: 'Slab', height: 72, color: LEVEL_COLORS[0] };
  const step: Level = { id: uid(), name: 'Lower step', height: 205, color: LEVEL_COLORS[1] };
  const drain: Level = { id: uid(), name: 'By the drain', height: 40, color: LEVEL_COLORS[2] };
  const p: Project = {
    ...blankProject(),
    name: 'Garden terrace',
    width: 4800,
    depth: 3600,
    levels: [slab, step, drain],
    baseLevelId: slab.id,
    disabled: ['6,4', '7,4', '6,5', '7,5'],
  };
  const layout = layoutOf(p);
  for (const n of layout.nodes) {
    if (n.x > 3000) p.heights[n.key] = step.id;
    else if (n.y > 2400 && n.x < 1300) p.heights[n.key] = drain.id;
  }
  return p;
}

/** Upper bound on grid size so the plan stays responsive. */
export const MAX_TILES = 6000;

export const tileCount = (p: Pick<Project, 'width' | 'depth' | 'tileW' | 'tileL' | 'joint'>) =>
  Math.ceil(p.width / (p.tileW + p.joint)) * Math.ceil(p.depth / (p.tileL + p.joint));

// ---------------------------------------------------------------- reducer

type GeometryKey = 'width' | 'depth' | 'tileW' | 'tileL' | 'joint' | 'pattern';
const GEOMETRY: GeometryKey[] = ['width', 'depth', 'tileW', 'tileL', 'joint', 'pattern'];

export type Action =
  | { type: 'set'; patch: Partial<Project> }
  | { type: 'rotateTile' }
  | { type: 'paint'; keys: string[]; value: HeightValue }
  | { type: 'paintMany'; values: Record<string, HeightValue> }
  | { type: 'setTiles'; keys: string[]; enabled: boolean }
  | { type: 'addLevels'; levels: Omit<Level, 'id' | 'color'>[] }
  | { type: 'updateLevel'; id: string; patch: Partial<Omit<Level, 'id'>> }
  | { type: 'removeLevel'; id: string }
  | { type: 'setBaseLevel'; id: string }
  | { type: 'fillAll'; value: HeightValue }
  | { type: 'load'; project: Project };

export function reduce(p: Project, a: Action): Project {
  switch (a.type) {
    case 'set': {
      const next = { ...p, ...a.patch };
      if (tileCount(next) > MAX_TILES) return p;
      return GEOMETRY.some((k) => k in a.patch && a.patch[k] !== p[k]) ? relayout(p, next) : next;
    }
    case 'rotateTile':
      return relayout(p, { ...p, tileW: p.tileL, tileL: p.tileW });
    case 'paint': {
      const heights = { ...p.heights };
      for (const k of a.keys) {
        if (a.value === p.baseLevelId) delete heights[k];
        else heights[k] = a.value;
      }
      return { ...p, heights };
    }
    case 'paintMany':
      return { ...p, heights: { ...p.heights, ...a.values } };
    case 'setTiles': {
      const set = new Set(p.disabled);
      for (const k of a.keys) a.enabled ? set.delete(k) : set.add(k);
      return { ...p, disabled: [...set] };
    }
    case 'addLevels': {
      const levels = [...p.levels];
      for (const l of a.levels) levels.push({ ...l, id: uid(), color: nextColor(levels) });
      return { ...p, levels };
    }
    case 'updateLevel':
      return { ...p, levels: p.levels.map((l) => (l.id === a.id ? { ...l, ...a.patch } : l)) };
    case 'removeLevel': {
      if (p.levels.length <= 1) return p;
      const levels = p.levels.filter((l) => l.id !== a.id);
      const baseLevelId = a.id === p.baseLevelId ? levels[0].id : p.baseLevelId;
      const heights: Record<string, HeightValue> = {};
      for (const [k, v] of Object.entries(p.heights)) {
        if (v !== a.id && v !== baseLevelId) heights[k] = v;
      }
      return { ...p, levels, baseLevelId, heights };
    }
    case 'setBaseLevel': {
      // Legs still on the old base keep their height explicitly.
      const layout = layoutOf(p);
      const heights = { ...p.heights };
      for (const n of layout.nodes) if (!(n.key in heights)) heights[n.key] = p.baseLevelId;
      for (const [k, v] of Object.entries(heights)) if (v === a.id) delete heights[k];
      return { ...p, baseLevelId: a.id, heights };
    }
    case 'fillAll':
      return a.value === p.baseLevelId
        ? { ...p, heights: {} }
        : { ...p, heights: Object.fromEntries(layoutOf(p).nodes.map((n) => [n.key, a.value])) };
    case 'load':
      return a.project;
  }
}

function relayout(prev: Project, next: Project): Project {
  const before = layoutOf(prev);
  // Lay out the new grid with every tile enabled so disabled areas can be mapped by position.
  const all = layoutOf({ ...next, disabled: [] });
  const disabled = remapDisabled(before.tiles, all.tiles);
  const after = layoutOf({ ...next, disabled });
  const reach = Math.max(next.tileW, next.tileL, prev.tileW, prev.tileL);
  return { ...next, disabled, heights: remapHeights(before.nodes, prev.heights, after.nodes, reach) };
}

// ---------------------------------------------------------------- history

export interface History {
  past: Project[];
  present: Project;
  future: Project[];
}

export type HistoryAction = Action | { type: 'undo' } | { type: 'redo' };

const LIMIT = 100;

export function historyReducer(h: History, a: HistoryAction): History {
  if (a.type === 'undo') {
    if (!h.past.length) return h;
    return { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] };
  }
  if (a.type === 'redo') {
    if (!h.future.length) return h;
    return { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) };
  }
  const present = reduce(h.present, a);
  if (present === h.present) return h;
  return { past: [...h.past, h.present].slice(-LIMIT), present, future: [] };
}

/** Defensive parse for anything loaded from storage or a share link. */
export function sanitize(raw: unknown): Project | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<Project>;
  const num = (v: unknown, min: number, max: number, d: number) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d;
  const base = blankProject();
  const levels = Array.isArray(r.levels)
    ? r.levels
        .filter((l) => l && typeof l.id === 'string' && typeof l.height === 'number')
        .map((l, i) => ({
          id: l.id,
          name: typeof l.name === 'string' ? l.name.slice(0, 40) : `Level ${i + 1}`,
          height: num(l.height, 0, 2000, 80),
          color: typeof l.color === 'string' && /^#[0-9a-f]{6}$/i.test(l.color) ? l.color : LEVEL_COLORS[i % 10],
        }))
    : [];
  if (!levels.length) return null;
  const ids = new Set(levels.map((l) => l.id));
  const heights: Record<string, HeightValue> = {};
  if (r.heights && typeof r.heights === 'object') {
    for (const [k, v] of Object.entries(r.heights)) {
      if (!/^\d+:\d+$/.test(k)) continue;
      if ((typeof v === 'string' && ids.has(v)) || (typeof v === 'number' && Number.isFinite(v))) heights[k] = v;
    }
  }
  const patterns: SupportPattern[] = ['auto', 'corners', 'center', 'edges', 'full'];
  return {
    version: 1,
    name: typeof r.name === 'string' ? r.name.slice(0, 80) : base.name,
    width: num(r.width, 100, 100_000, base.width),
    depth: num(r.depth, 100, 100_000, base.depth),
    tileW: num(r.tileW, 100, 3000, base.tileW),
    tileL: num(r.tileL, 100, 3000, base.tileL),
    joint: num(r.joint, 0, 20, base.joint),
    pattern: patterns.includes(r.pattern as SupportPattern) ? (r.pattern as SupportPattern) : 'auto',
    acousticPad: r.acousticPad ?? base.acousticPad,
    deductPad: r.deductPad ?? base.deductPad,
    slopeCorrector: r.slopeCorrector ?? base.slopeCorrector,
    spare: num(r.spare, 0, 50, base.spare),
    levels,
    baseLevelId: ids.has(r.baseLevelId as string) ? (r.baseLevelId as string) : levels[0].id,
    heights,
    disabled: Array.isArray(r.disabled) ? r.disabled.filter((k) => typeof k === 'string' && /^\d+,\d+$/.test(k)) : [],
  };
}

export { nodeKey };
