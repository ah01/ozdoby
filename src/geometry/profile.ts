import type { OrnamentParameters } from '../domain/parameters';

export const smoothstep = (t: number): number => {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
};

export function profileRadius(p: OrnamentParameters, z: number): number {
  const u = Math.max(0, Math.min(1, (z - p.neck.lengthMm) / p.body.heightMm));
  const rn = p.neck.diameterMm / 2, r = p.body.baseDiameterMm / 2, rt = p.body.tipRadiusMm;
  return u <= p.body.maxRadiusAt
    ? rn + (r - rn) * smoothstep(u / p.body.maxRadiusAt)
    : r + (rt - r) * smoothstep((u - p.body.maxRadiusAt) / (1 - p.body.maxRadiusAt));
}

/** Analytic maximum of positive dr/dz for the smooth phase-0 shoulder. */
export function smoothShoulderAngle(p: OrnamentParameters): number {
  return Math.atan(1.5 * (p.body.baseDiameterMm - p.neck.diameterMm) / 2
    / (p.body.heightMm * p.body.maxRadiusAt)) * 180 / Math.PI;
}
