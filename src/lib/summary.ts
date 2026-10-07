import { ACCESSORIES, EXPANDERS, PEDESTALS, pickPedestal, type LegResult, type PedestalModel } from './catalog';
import type { Layout } from './layout';
import type { HeightValue, Level, Project } from '../state/project';

export interface HeightRow {
  /** Height requested under the tile (mm). */
  height: number;
  /** Height the pedestal itself must be set to (after pad deduction). */
  pedestalHeight: number;
  count: number;
  level: Level | null;
  result: LegResult;
}

export interface ModelRow {
  pedestal: PedestalModel;
  count: number;
  order: number;
}

export interface OrderLine {
  id: string;
  name: string;
  count: number;
  order: number;
  packs?: number;
  pack?: number;
}

export interface Summary {
  legs: number;
  byHeight: HeightRow[];
  byModel: ModelRow[];
  expanders: OrderLine[];
  accessories: OrderLine[];
  tiles: { full: number; cut: number; area: number };
  issues: {
    tooLow: number;
    tooHigh: number;
    atLimit: number;
    narrowCuts: number[];
  };
  /** Per-leg resolution, keyed by node key — used for plan tooltips. */
  legInfo: Map<string, { height: number; level: Level | null; result: LegResult }>;
}

export const withSpare = (n: number, spare: number) => (n === 0 ? 0 : Math.ceil(n * (1 + spare / 100)));

export function resolveHeight(v: HeightValue | undefined, p: Project, levels: Map<string, Level>) {
  const value = v ?? p.baseLevelId;
  if (typeof value === 'number') return { height: value, level: null };
  const level = levels.get(value) ?? levels.get(p.baseLevelId) ?? p.levels[0];
  return { height: level.height, level };
}

export function padDeduction(p: Pick<Project, 'acousticPad' | 'deductPad'>) {
  return p.acousticPad && p.deductPad ? ACCESSORIES.acousticPad.thickness : 0;
}

export function summarize(p: Project, layout: Layout): Summary {
  const levels = new Map(p.levels.map((l) => [l.id, l]));
  const deduct = padDeduction(p);
  const rows = new Map<string, HeightRow>();
  const legInfo: Summary['legInfo'] = new Map();
  const results = new Map<number, LegResult>();

  for (const n of layout.nodes) {
    const { height, level } = resolveHeight(p.heights[n.key], p, levels);
    const pedestalHeight = height - deduct;
    let result = results.get(pedestalHeight);
    if (!result) {
      result = pickPedestal(pedestalHeight);
      results.set(pedestalHeight, result);
    }
    legInfo.set(n.key, { height, level, result });
    const rowKey = `${level?.id ?? '~'}|${height}`;
    const row = rows.get(rowKey);
    if (row) row.count++;
    else rows.set(rowKey, { height, pedestalHeight, count: 1, level, result });
  }

  const byHeight = [...rows.values()].sort((a, b) => a.height - b.height || (a.level ? -1 : 1));

  const modelCounts = new Map<string, number>();
  const expanderCounts = new Map<number, number>();
  const issues: Summary['issues'] = { tooLow: 0, tooHigh: 0, atLimit: 0, narrowCuts: [] };
  for (const r of byHeight) {
    if (!r.result.ok) {
      issues[r.result.reason === 'too-low' ? 'tooLow' : 'tooHigh'] += r.count;
      continue;
    }
    const { pedestal, expanders, headroom } = r.result.spec;
    modelCounts.set(pedestal.id, (modelCounts.get(pedestal.id) ?? 0) + r.count);
    for (const e of expanders) expanderCounts.set(e, (expanderCounts.get(e) ?? 0) + r.count);
    if (headroom === 0) issues.atLimit += r.count;
  }

  const byModel = PEDESTALS.filter((m) => modelCounts.has(m.id)).map((pedestal) => {
    const count = modelCounts.get(pedestal.id)!;
    return { pedestal, count, order: withSpare(count, p.spare) };
  });

  const expanders = EXPANDERS.filter((e) => expanderCounts.has(e.height)).map((e) => {
    const count = expanderCounts.get(e.height)!;
    return { id: e.id, name: e.name, count, order: withSpare(count, p.spare) };
  });

  const legs = layout.nodes.length;
  const accessories: OrderLine[] = [];
  const pack = (id: string, name: string, size: number): OrderLine => {
    const order = withSpare(legs, p.spare);
    return { id, name, count: legs, order, pack: size, packs: Math.ceil(order / size) };
  };
  if (p.acousticPad && legs) accessories.push(pack(ACCESSORIES.acousticPad.id, ACCESSORIES.acousticPad.name, ACCESSORIES.acousticPad.pack));
  if (p.slopeCorrector && legs) accessories.push(pack(ACCESSORIES.slopeCorrector.id, ACCESSORIES.slopeCorrector.name, ACCESSORIES.slopeCorrector.pack));

  const enabled = layout.tiles.filter((t) => t.enabled);
  const tiles = {
    full: enabled.filter((t) => !t.cut).length,
    cut: enabled.filter((t) => t.cut).length,
    area: enabled.reduce((s, t) => s + t.w * t.h, 0) / 1e6,
  };

  for (const axis of [layout.x, layout.y]) {
    const last = axis.spans[axis.spans.length - 1];
    if (axis.spans.length > 1 && last && last.cut && last.end - last.start < 100) issues.narrowCuts.push(last.end - last.start);
  }

  return { legs, byHeight, byModel, expanders, accessories, tiles, issues, legInfo };
}
