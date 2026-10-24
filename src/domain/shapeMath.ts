import type { OrnamentParameters, ShapeId } from './parameters';

export const clamp01 = (t: number): number => Math.max(0, Math.min(1, t));
export const smoothstep = (t: number): number => { const x = clamp01(t); return x * x * (3 - 2 * x); };
const DIAMOND_ROUNDING = 0.15;

/** Monotone segment profiles with zero slope at both interfaces. */
export function profileEase(shape: ShapeId, t: number): number {
  const x = clamp01(t);
  if (shape === 'egg') return (1 - Math.cos(Math.PI * x)) / 2;
  if (shape !== 'diamond') return smoothstep(x);
  const e = DIAMOND_ROUNDING, c = 1 / (1 - e);
  if (x < e) { const q = x / e; return c * e * (q ** 3 - q ** 4 / 2); }
  if (x > 1 - e) return 1 - profileEase(shape, 1 - x);
  return c * (x - e / 2);
}
export function profileEaseBounds(shape: ShapeId): { first: number; second: number } {
  if (shape === 'egg') return { first: Math.PI / 2, second: Math.PI ** 2 / 2 };
  if (shape === 'diamond') return { first: 1 / (1 - DIAMOND_ROUNDING), second: 1.5 / (DIAMOND_ROUNDING * (1 - DIAMOND_ROUNDING)) };
  return { first: 1.5, second: 6 };
}
export function bodyRadius(p: OrnamentParameters, u: number): number {
  const peak = p.body.maxRadiusAt, rn = p.neck.diameterMm / 2, r = p.body.baseDiameterMm / 2, rt = p.body.tipRadiusMm;
  return u <= peak ? rn + (r - rn) * profileEase(p.shape, u / peak)
    : r + (rt - r) * profileEase(p.shape, (u - peak) / (1 - peak));
}
export function amplitudeWeight(p: OrnamentParameters, u: number): number {
  const x = clamp01(u);
  switch (p.surface.amplitudeProfile) {
    case 'middle': return 4 * x * (1 - x);
    case 'neck': return smoothstep(1 - x);
    default: return 1;
  }
}
export function amplitudeWeightBounds(p: OrnamentParameters): { first: number; second: number } {
  switch (p.surface.amplitudeProfile) {
    case 'middle': return { first: 4, second: 8 };
    case 'neck': return { first: 1.5, second: 6 };
    default: return { first: 0, second: 0 };
  }
}
export function twistWeight(p: OrnamentParameters, u: number): number {
  const x = clamp01(u);
  switch (p.surface.twistProfile) {
    case 'linear': return x;
    case 'reverse': return 4 * x * (1 - x);
    default: return smoothstep(x);
  }
}
export function twistWeightBounds(p: OrnamentParameters): { first: number; second: number } {
  switch (p.surface.twistProfile) {
    case 'linear': return { first: 1, second: 0 };
    case 'reverse': return { first: 4, second: 8 };
    default: return { first: 1.5, second: 6 };
  }
}
