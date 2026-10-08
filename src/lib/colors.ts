/**
 * Colour for free (slope) heights: a neutral graphite ramp, light = low, deep = high,
 * kept apart from the categorical level colours so slopes never read as a named level.
 */
export function slopeColor(h: number, min: number, max: number): string {
  const t = max > min ? (h - min) / (max - min) : 0.5;
  return `hsl(215 ${12 + t * 6}% ${76 - t * 46}%)`;
}

export function slopeRange(values: number[]): [number, number] {
  if (!values.length) return [0, 0];
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of values) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return [lo, hi];
}
