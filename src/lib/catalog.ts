/**
 * RENOPAD PRO pedestal system (Renoplast).
 * Source: Renoplast technical data sheet — 8 height ranges 13–300 mm,
 * 2 mm paver spacing, 50/100 mm expanders fitted to the 173–300 mm pedestal
 * (max. two, up to 500 mm), 0–5% slope corrector, acoustic top pad.
 */

export interface PedestalModel {
  id: string;
  name: string;
  min: number; // mm
  max: number; // mm
}

export interface Expander {
  id: string;
  name: string;
  height: number; // mm
}

export const SYSTEM_NAME = 'RENOPAD PRO';

export const PEDESTALS: PedestalModel[] = [
  [13, 18],
  [18, 23],
  [23, 29],
  [29, 47],
  [47, 65],
  [65, 119],
  [119, 173],
  [173, 300],
].map(([min, max]) => ({ id: `pro-${min}-${max}`, name: `RENOPAD PRO ${min}–${max} mm`, min, max }));

export const EXPANDERS: Expander[] = [
  { id: 'exp-100', name: 'Ekspander 100 mm RENOPAD PRO', height: 100 },
  { id: 'exp-50', name: 'Ekspander 50 mm RENOPAD PRO', height: 50 },
];

/** Expanders only fit the tallest pedestal; at most two per leg. */
export const EXPANDER_BASE_ID = 'pro-173-300';
export const MAX_EXPANDERS_PER_LEG = 2;

export const ACCESSORIES = {
  acousticPad: { id: 'acoustic-pad', name: 'Nakładka wygłuszająca RENOPAD PRO', thickness: 2, pack: 10 },
  slopeCorrector: { id: 'slope-corrector', name: 'Korektor spadku 0–5% RENOPAD PRO', pack: 10 },
} as const;

export const PAVER_SPACING_MM = 2;

export interface LegSpec {
  pedestal: PedestalModel;
  /** Expander heights, tallest first. Empty for most legs. */
  expanders: number[];
  /** Distance to the closest end of the adjustment range (mm). 0 = no room left. */
  headroom: number;
}

export type LegResult =
  | { ok: true; spec: LegSpec }
  | { ok: false; reason: 'too-low' | 'too-high' };

const headroomOf = (h: number, p: PedestalModel) => Math.min(h - p.min, p.max - h);

/**
 * Pick the pedestal for a target height (mm, pedestal only — pads already deducted).
 * Prefers the model with the most adjustment room in both directions, so the
 * installer can still fine-tune on site; ties go to the less-extended model.
 */
export function pickPedestal(height: number, pedestals: PedestalModel[] = PEDESTALS): LegResult {
  const h = Math.round(height * 10) / 10;
  const fits = pedestals.filter((p) => h >= p.min && h <= p.max);
  if (fits.length) {
    fits.sort((a, b) => headroomOf(h, b) - headroomOf(h, a) || h - a.min - (h - b.min));
    return { ok: true, spec: { pedestal: fits[0], expanders: [], headroom: headroomOf(h, fits[0]) } };
  }
  const lowest = Math.min(...pedestals.map((p) => p.min));
  if (h < lowest) return { ok: false, reason: 'too-low' };

  const base = pedestals.find((p) => p.id === EXPANDER_BASE_ID);
  if (!base) return { ok: false, reason: 'too-high' };

  let best: LegSpec | null = null;
  for (const combo of expanderCombos()) {
    const rest = h - combo.reduce((s, e) => s + e, 0);
    if (rest < base.min || rest > base.max) continue;
    const candidate = { pedestal: base, expanders: combo, headroom: headroomOf(rest, base) };
    if (
      !best ||
      candidate.expanders.length < best.expanders.length ||
      (candidate.expanders.length === best.expanders.length && candidate.headroom > best.headroom)
    ) {
      best = candidate;
    }
  }
  return best ? { ok: true, spec: best } : { ok: false, reason: 'too-high' };
}

function expanderCombos(): number[][] {
  const heights = EXPANDERS.map((e) => e.height);
  const combos: number[][] = heights.map((h) => [h]);
  if (MAX_EXPANDERS_PER_LEG >= 2) {
    for (let i = 0; i < heights.length; i++)
      for (let j = i; j < heights.length; j++) combos.push([heights[i], heights[j]]);
  }
  return combos;
}

export const MAX_HEIGHT =
  PEDESTALS[PEDESTALS.length - 1].max + MAX_EXPANDERS_PER_LEG * Math.max(...EXPANDERS.map((e) => e.height));
export const MIN_HEIGHT = PEDESTALS[0].min;
