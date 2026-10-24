import type { OrnamentParameters } from '../domain/parameters';
import { profileRadius, smoothstep } from './profile';
import { amplitudeWeight, twistWeight } from '../domain/shapeMath';

export function surfaceAmplitude(p: OrnamentParameters, z: number): number {
  if (z <= p.neck.lengthMm) return 0;
  const h = z - p.neck.lengthMm;
  return p.surface.amplitudeMm * smoothstep(h / p.surface.blendLengthMm)
    * smoothstep((p.body.heightMm - h) / p.surface.blendLengthMm) * amplitudeWeight(p, h / p.body.heightMm);
}
export function surfaceTwist(p: OrnamentParameters, z: number): number {
  return p.surface.twistDeg * Math.PI / 180 * twistWeight(p, (z - p.neck.lengthMm) / p.body.heightMm);
}

export function surfaceRadius(p: OrnamentParameters, theta: number, z: number): number {
  const base = profileRadius(p, z);
  if (z <= p.neck.lengthMm || p.surface.amplitudeMm === 0) return base;
  return base + surfaceAmplitude(p, z) * Math.cos(p.surface.ribs * (theta - surfaceTwist(p, z)));
}

export function surfacePoint(p: OrnamentParameters, theta: number, z: number): [number, number, number] {
  const r = surfaceRadius(p, theta, z);
  return [r * Math.cos(theta), r * Math.sin(theta), z];
}
