import type { OrnamentParameters } from '../domain/parameters';
import { bodyRadius, profileEaseBounds } from '../domain/shapeMath';
export { smoothstep } from '../domain/shapeMath';

export function profileRadius(p: OrnamentParameters, z: number): number {
  const u = Math.max(0, Math.min(1, (z - p.neck.lengthMm) / p.body.heightMm));
  return bodyRadius(p, u);
}

/** Analytic maximum of positive dr/dz for the unmodulated shoulder. */
export function smoothShoulderAngle(p: OrnamentParameters): number {
  return Math.atan(profileEaseBounds(p.shape).first * (p.body.baseDiameterMm - p.neck.diameterMm) / 2
    / (p.body.heightMm * p.body.maxRadiusAt)) * 180 / Math.PI;
}
