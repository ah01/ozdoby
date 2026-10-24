import type { OrnamentParameters, ShapeId } from './parameters';

export const clamp01 = (t: number): number => Math.max(0, Math.min(1, t));
export const smoothstep = (t: number): number => { const x = clamp01(t); return x * x * (3 - 2 * x); };
const DIAMOND_ROUNDING = 0.15;
// A finite cone slope at a zero-radius tip avoids a pinched, numerically flat cusp.
export const POINT_TIP_WEIGHT = 0.1;

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
  if (rt === 0 && u > peak) {
    const v = clamp01((1 - u) / (1 - peak));
    return r * ((1 - POINT_TIP_WEIGHT) * profileEase(p.shape, v) + POINT_TIP_WEIGHT * v * (2 - v));
  }
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

export function ribShapeFactor(p: OrnamentParameters): number {
  return p.surface.ribShape === 'narrow' ? 0.45 : p.surface.ribShape === 'broad' ? -0.45 : 0;
}
/** Monotone remapping of cosine, endpoints -1/+1 and no cusps. */
export function ribValue(p: OrnamentParameters, phase: number): number {
  const c = Math.cos(phase), q = ribShapeFactor(p);
  return c + q * (c * c - 1);
}
export function ribDerivatives(p: OrnamentParameters, phase: number): [number, number] {
  const q = ribShapeFactor(p);
  return [-Math.sin(phase) - q * Math.sin(2 * phase), -Math.cos(phase) - 2 * q * Math.cos(2 * phase)];
}
export function ribDerivativeBounds(p: OrnamentParameters): { first: number; second: number } {
  const q = Math.abs(ribShapeFactor(p));
  return { first: 1 + q, second: 1 + 2 * q };
}
