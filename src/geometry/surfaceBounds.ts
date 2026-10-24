import type { OrnamentParameters } from '../domain/parameters';
import { amplitudeWeightBounds, profileEaseBounds, twistWeightBounds } from '../domain/shapeMath';

export function surfaceKnots(p: OrnamentParameters): number[] {
  const h = p.body.heightMm, n = p.neck.lengthMm, peak = n + h * p.body.maxRadiusAt;
  return [...new Set([0, n, peak, n + p.surface.blendLengthMm, n + h - p.surface.blendLengthMm, n + h,
    ...(p.surface.amplitudeMm > 0 && (p.surface.amplitudeProfile === 'middle' || p.surface.twistProfile === 'reverse') ? [n + h / 2] : [])])].sort((a, b) => a - b);
}

/** Norm bounds on Pθθ, Pθz and Pzz for an interval within one profile segment.
 * All new envelope/twist modes are bounded analytically, including their extrema.
 */
export function derivativeBounds(p: OrnamentParameters, lo: number, hi: number): [number, number, number] {
  const rn = p.neck.diameterMm / 2, r = p.body.baseDiameterMm / 2;
  if (hi <= p.neck.lengthMm) return [rn, 0, 0];
  const h = p.body.heightMm, peak = p.body.maxRadiusAt, b = p.surface.blendLengthMm;
  const lower = (lo + hi) / 2 <= p.neck.lengthMm + h * peak;
  const length = h * (lower ? peak : 1 - peak), delta = lower ? r - rn : r - p.body.tipRadiusMm;
  const profile = profileEaseBounds(p.shape), weight = amplitudeWeightBounds(p), phase = twistWeightBounds(p);
  const baseFirst = profile.first * delta / length, baseSecond = profile.second * delta / length ** 2;
  const a = p.surface.amplitudeMm, k = p.surface.ribs;
  const ramp = lo < p.neck.lengthMm + b - 1e-10 || hi > p.neck.lengthMm + h - b + 1e-10;
  const blend1 = ramp ? 1.5 / b : 0, blend2 = ramp ? 6 / b ** 2 : 0;
  const e1 = blend1 + weight.first / h;
  const e2 = blend2 + 2 * blend1 * weight.first / h + weight.second / h ** 2;
  const twist = Math.abs(p.surface.twistDeg * Math.PI / 180);
  const phase1 = k * twist * phase.first / h, phase2 = k * twist * phase.second / h ** 2;
  return [r + a * (k + 1) ** 2,
    baseFirst + a * (k + 1) * (e1 + phase1),
    baseSecond + a * (e2 + 2 * e1 * phase1 + phase2 + phase1 ** 2)];
}
