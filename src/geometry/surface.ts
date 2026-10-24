import type { OrnamentParameters } from '../domain/parameters';
import { profileRadius, smoothstep } from './profile';
import { amplitudeWeight, ribValue, twistWeight } from '../domain/shapeMath';

export function surfaceBlend(p: OrnamentParameters, z: number): number {
  const h = z - p.neck.lengthMm;
  return smoothstep(h / p.surface.blendLengthMm) * smoothstep((p.body.heightMm - h) / p.surface.blendLengthMm);
}

export function surfaceAmplitude(p: OrnamentParameters, z: number): number {
  if (z <= p.neck.lengthMm) return 0;
  const h = z - p.neck.lengthMm;
  return p.surface.amplitudeMm * surfaceBlend(p, z) * amplitudeWeight(p, h / p.body.heightMm);
}

export function ribPhase(p: OrnamentParameters, theta: number, z: number): number {
  return p.surface.ribs * (theta - surfaceTwist(p, z) - ((p.surface.ribRotationDeg ?? 0) % 360) * Math.PI / 180);
}
export function horizontalWave(p: OrnamentParameters, z: number): number {
  if (!p.surface.waveAmplitudeMm || z <= p.neck.lengthMm) return 0;
  const u = (z - p.neck.lengthMm) / p.body.heightMm;
  return p.surface.waveAmplitudeMm * surfaceBlend(p, z) * Math.sin(2 * Math.PI * (p.surface.waveCount * u + (p.surface.waveShiftPercent % 100) / 100));
}
export function surfaceTwist(p: OrnamentParameters, z: number): number {
  return p.surface.twistDeg * Math.PI / 180 * twistWeight(p, (z - p.neck.lengthMm) / p.body.heightMm);
}

export function surfaceRadius(p: OrnamentParameters, theta: number, z: number): number {
  const base = profileRadius(p, z);
  if (z <= p.neck.lengthMm) return base;
  const waved = base + horizontalWave(p, z);
  return p.surface.amplitudeMm === 0 ? waved : waved + surfaceAmplitude(p, z) * ribValue(p, ribPhase(p, theta, z));
}

export function surfacePoint(p: OrnamentParameters, theta: number, z: number): [number, number, number] {
  const r = surfaceRadius(p, theta, z);
  return [r * Math.cos(theta), r * Math.sin(theta), z];
}
