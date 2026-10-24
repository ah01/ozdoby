import type { OrnamentParameters } from '../domain/parameters';
import { bodyRadius, clamp01, POINT_TIP_WEIGHT, profileEaseBounds, ribDerivativeBounds, smoothstep } from '../domain/shapeMath';

/** Bounds in a closed interval, split at all body/blend knots by the caller. */
const contains = (lo: number, hi: number, x: number) => lo <= x && x <= hi;
const quadraticFirst = (lo: number, hi: number) => contains(lo, hi, 0.5) ? 1.5 : Math.max(6 * lo * (1 - lo), 6 * hi * (1 - hi));
const quadraticSecond = (lo: number, hi: number) => Math.max(Math.abs(6 - 12 * lo), Math.abs(6 - 12 * hi));

function profileBounds(p: OrnamentParameters, lo: number, hi: number): [number, number] {
  const full = profileEaseBounds(p.shape);
  if (p.shape === 'diamond') return [full.first, lo >= 0.15 && hi <= 0.85 ? 0 : full.second];
  if (p.shape === 'egg') return [(contains(lo, hi, 0.5) ? 1 : Math.max(Math.sin(Math.PI * lo), Math.sin(Math.PI * hi))) * Math.PI / 2,
    Math.max(Math.abs(Math.cos(Math.PI * lo)), Math.abs(Math.cos(Math.PI * hi))) * Math.PI ** 2 / 2];
  return [quadraticFirst(lo, hi), quadraticSecond(lo, hi)];
}

export function localDerivativeBounds(p: OrnamentParameters, lo: number, hi: number): [number, number, number] {
  const n = p.neck.lengthMm, h = p.body.heightMm, b = p.surface.blendLengthMm;
  if (hi <= n) return [p.neck.diameterMm / 2, 0, 0];
  const u0 = clamp01((lo - n) / h), u1 = clamp01((hi - n) / h), peak = p.body.maxRadiusAt;
  const lower = (u0 + u1) / 2 <= peak, length = h * (lower ? peak : 1 - peak);
  const t0 = clamp01(lower ? u0 / peak : (u0 - peak) / (1 - peak));
  const t1 = clamp01(lower ? u1 / peak : (u1 - peak) / (1 - peak));
  const delta = p.body.baseDiameterMm / 2 - (lower ? p.neck.diameterMm / 2 : p.body.tipRadiusMm);
  let [profile1, profile2] = profileBounds(p, t0, t1);
  if (!lower && p.body.tipRadiusMm === 0) {
    profile1 = (1 - POINT_TIP_WEIGHT) * profile1 + 2 * POINT_TIP_WEIGHT * t1;
    profile2 = (1 - POINT_TIP_WEIGHT) * profile2 + 2 * POINT_TIP_WEIGHT;
  }
  const baseFirst = delta * profile1 / length, baseSecond = delta * profile2 / length ** 2;
  const baseMax = Math.max(bodyRadius(p, u0), bodyRadius(p, u1));
  const blend0 = smoothstep((hi - n) / b) * smoothstep((n + h - lo) / b);
  let blend1 = 0, blend2 = 0;
  if (lo < n + b || hi > n + h - b) {
    const start = lo < n + b;
    const a = clamp01((start ? lo - n : n + h - hi) / b), c = clamp01((start ? hi - n : n + h - lo) / b);
    blend1 = quadraticFirst(a, c) / b; blend2 = quadraticSecond(a, c) / b ** 2;
  }
  let weight0 = 1, weight1 = 0, weight2 = 0;
  if (p.surface.amplitudeProfile === 'middle') {
    weight0 = contains(u0, u1, 0.5) ? 1 : Math.max(4 * u0 * (1 - u0), 4 * u1 * (1 - u1));
    weight1 = Math.max(Math.abs(4 - 8 * u0), Math.abs(4 - 8 * u1)) / h; weight2 = 8 / h ** 2;
  } else if (p.surface.amplitudeProfile === 'neck') {
    weight0 = smoothstep(1 - u0); weight1 = quadraticFirst(1 - u1, 1 - u0) / h;
    weight2 = quadraticSecond(1 - u1, 1 - u0) / h ** 2;
  }
  const e0 = blend0 * weight0, e1 = blend1 * weight0 + blend0 * weight1;
  const e2 = blend2 * weight0 + 2 * blend1 * weight1 + blend0 * weight2;
  let phaseFirst = quadraticFirst(u0, u1), phaseSecond = quadraticSecond(u0, u1);
  if (p.surface.twistProfile === 'linear') { phaseFirst = 1; phaseSecond = 0; }
  if (p.surface.twistProfile === 'reverse') { phaseFirst = Math.max(Math.abs(4 - 8 * u0), Math.abs(4 - 8 * u1)); phaseSecond = 8; }
  const a = p.surface.amplitudeMm, k = p.surface.ribs, waveA = p.surface.waveAmplitudeMm;
  const phase = k * Math.abs(p.surface.twistDeg * Math.PI / 180), q1 = phase * phaseFirst / h, q2 = phase * phaseSecond / h ** 2;
  const w = ribDerivativeBounds(p), frequency = 2 * Math.PI * p.surface.waveCount / h;
  return [baseMax + waveA * blend0 + a * e0 * (1 + 2 * k * w.first + k ** 2 * w.second),
    baseFirst + waveA * (blend1 + blend0 * frequency) + a * (e1 * (1 + k * w.first) + e0 * q1 * (w.first + k * w.second)),
    baseSecond + waveA * (blend2 + 2 * blend1 * frequency + blend0 * frequency ** 2)
      + a * (e2 + 2 * e1 * q1 * w.first + e0 * (q2 * w.first + q1 ** 2 * w.second))];
}
