import type { OrnamentParameters } from '../domain/parameters';
import { profileRadius, smoothstep } from './profile';

export function surfaceRadius(p: OrnamentParameters, theta: number, z: number): number {
  const base = profileRadius(p, z);
  if (z <= p.neck.lengthMm || p.surface.amplitudeMm === 0) return base;
  const h = z - p.neck.lengthMm;
  const envelope = smoothstep(h / p.surface.blendLengthMm)
    * smoothstep((p.body.heightMm - h) / p.surface.blendLengthMm);
  const phi = p.surface.twistDeg * Math.PI / 180 * smoothstep(h / p.body.heightMm);
  return base + p.surface.amplitudeMm * envelope * Math.cos(p.surface.ribs * (theta - phi));
}

export function surfacePoint(p: OrnamentParameters, theta: number, z: number): [number, number, number] {
  const r = surfaceRadius(p, theta, z);
  return [r * Math.cos(theta), r * Math.sin(theta), z];
}
