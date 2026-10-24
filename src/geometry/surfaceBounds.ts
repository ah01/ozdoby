import type { OrnamentParameters } from '../domain/parameters';
import { amplitudeWeightBounds, POINT_TIP_WEIGHT, profileEaseBounds, ribDerivativeBounds, twistWeightBounds } from '../domain/shapeMath';

export function angularSecondBound(p: OrnamentParameters): number {
  const a = p.surface.amplitudeMm, k = p.surface.ribs, w = ribDerivativeBounds(p);
  return p.body.baseDiameterMm / 2 + (p.surface.waveAmplitudeMm ?? 0) + a * (1 + 2 * k * w.first + k * k * w.second);
}

export function surfaceKnots(p: OrnamentParameters): number[] {
  const h = p.body.heightMm, n = p.neck.lengthMm, peak = n + h * p.body.maxRadiusAt;
  const waveKnots: number[] = [];
  if (p.surface.waveAmplitudeMm > 0) for (let j = 0; j <= 4 * (p.surface.waveCount + 1); j++) {
    const u = (j / 4 - (p.surface.waveShiftPercent % 100) / 100) / p.surface.waveCount;
    if (u > 0 && u < 1) waveKnots.push(n + u * h);
  }
  return [...new Set([0, n, peak, n + p.surface.blendLengthMm, n + h - p.surface.blendLengthMm, n + h, ...waveKnots,
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
  if (!lower && p.body.tipRadiusMm === 0) {
    profile.first = (1 - POINT_TIP_WEIGHT) * profile.first + 2 * POINT_TIP_WEIGHT;
    profile.second = (1 - POINT_TIP_WEIGHT) * profile.second + 2 * POINT_TIP_WEIGHT;
  }
  const baseFirst = profile.first * delta / length, baseSecond = profile.second * delta / length ** 2;
  const a = p.surface.amplitudeMm, k = p.surface.ribs;
  const ramp = lo < p.neck.lengthMm + b - 1e-10 || hi > p.neck.lengthMm + h - b + 1e-10;
  const blend1 = ramp ? 1.5 / b : 0, blend2 = ramp ? 6 / b ** 2 : 0;
  const e1 = blend1 + weight.first / h;
  const e2 = blend2 + 2 * blend1 * weight.first / h + weight.second / h ** 2;
  const twist = Math.abs(p.surface.twistDeg * Math.PI / 180);
  const phase1 = k * twist * phase.first / h, phase2 = k * twist * phase.second / h ** 2;
  const w = ribDerivativeBounds(p), waveA = p.surface.waveAmplitudeMm ?? 0;
  const frequency = 2 * Math.PI * (p.surface.waveCount ?? 4) / h;
  const waveFirst = waveA * (blend1 + frequency), waveSecond = waveA * (blend2 + 2 * blend1 * frequency + frequency ** 2);
  return [angularSecondBound(p),
    baseFirst + waveFirst + a * (e1 * (1 + k * w.first) + phase1 * (w.first + k * w.second)),
    baseSecond + waveSecond + a * (e2 + 2 * e1 * phase1 * w.first + phase2 * w.first + phase1 ** 2 * w.second)];
}
