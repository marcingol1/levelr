import type { Unit } from '../state/project';

const trim = (n: number, digits: number) => {
  const s = n.toFixed(digits);
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
};

/** Value for an input field in the given unit (no suffix). */
export const toUnit = (mm: number, unit: Unit) => (unit === 'cm' ? trim(mm / 10, 1) : trim(mm, 0));

/** Human label with unit, e.g. "72 mm", "58.6 cm". */
export const fmtLen = (mm: number, unit: Unit) => `${toUnit(mm, unit)} ${unit}`;

/** Large dimensions read better in metres. */
export const fmtSpan = (mm: number) => `${trim(mm / 1000, 2)} m`;

/**
 * Parse a length typed by the user. Accepts "72", "7,2", "7.2 cm", "72mm", "0.5 m".
 * Bare numbers use `unit`.
 */
export function parseLen(input: string, unit: Unit): number | null {
  const m = input.trim().toLowerCase().replace(',', '.').match(/^(-?\d*\.?\d+)\s*(mm|cm|m)?$/);
  if (!m) return null;
  const v = parseFloat(m[1]);
  if (!Number.isFinite(v)) return null;
  const u = (m[2] as 'mm' | 'cm' | 'm' | undefined) ?? unit;
  return Math.round((u === 'm' ? v * 1000 : u === 'cm' ? v * 10 : v) * 10) / 10;
}

/** Split a bulk entry like "70, 120; 20 cm" into lengths in mm. */
export function parseLenList(input: string, unit: Unit): number[] {
  return input
    .split(/[,;\n]+|\s{2,}/)
    .map((s) => s.trim())
    .filter(Boolean)
    .flatMap((s) => {
      // "70 120 200" (space-separated, no units) — split further.
      if (/^\d+([.,]\d+)?(\s+\d+([.,]\d+)?)+$/.test(s)) return s.split(/\s+/);
      return [s];
    })
    .map((s) => parseLen(s, unit))
    .filter((v): v is number => v !== null && v > 0);
}
