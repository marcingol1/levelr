/** Colour for free (slope) heights: a single-hue ramp from light to deep. */
export function slopeColor(h: number, min: number, max: number): string {
  const t = max > min ? (h - min) / (max - min) : 0.5;
  const l = 74 - t * 42;
  return `hsl(28 ${38 + t * 22}% ${l}%)`;
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
