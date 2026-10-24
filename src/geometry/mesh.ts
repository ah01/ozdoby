import { ornamentSchema, type OrnamentParameters } from '../domain/parameters';
import { surfacePoint } from './surface';
import { defaultStlDetail, EXPORT_TRIANGLE_LIMIT, PREVIEW_TRIANGLE_LIMIT, stlDetails, type StlDetail } from '../domain/stlDetail';

export const FaceRegion = { neck: 0, body: 1, baseCap: 2, tipCap: 3 } as const;
export interface MeshData {
  positions: Float64Array;
  indices: Uint32Array;
  faceRegions: Uint8Array;
}
export interface MeshResult extends MeshData {
  sampling: { angles: number; heights: number[]; toleranceMm: number; errorBoundMm: number };
}
export class GeometryError extends Error {
  constructor(public readonly code: string, message: string) { super(message); }
}

/** Upper bounds on |Pθθ|, |Pθz| and |Pzz| on an interval split at all profile knots.
 * For a triangle, Taylor remainder <= Mθθ Δθ²/8 + Mθz ΔθΔz/4 + Mzz Δz²/8.
 * The 1/8 factors follow from barycentric variance <= range²/4; the mixed
 * factor follows from Cauchy-Schwarz. See doc/geometry.md.
 */
function derivativeBounds(p: OrnamentParameters, lo: number, hi: number): [number, number, number] {
  const rn = p.neck.diameterMm / 2, r = p.body.baseDiameterMm / 2;
  if (hi <= p.neck.lengthMm) return [rn, 0, 0];
  const h = p.body.heightMm, peak = p.body.maxRadiusAt, b = p.surface.blendLengthMm;
  const lower = (lo + hi) / 2 <= p.neck.lengthMm + h * peak;
  const length = h * (lower ? peak : 1 - peak);
  const delta = lower ? r - rn : r - p.body.tipRadiusMm;
  const baseFirst = 1.5 * delta / length;
  const baseSecond = 6 * delta / (length * length);
  const a = p.surface.amplitudeMm, k = p.surface.ribs;
  const ramp = lo < p.neck.lengthMm + b - 1e-10 || hi > p.neck.lengthMm + h - b + 1e-10;
  const e1 = ramp ? 1.5 / b : 0, e2 = ramp ? 6 / (b * b) : 0;
  const twist = Math.abs(p.surface.twistDeg * Math.PI / 180);
  const phase1 = k * twist * 1.5 / h, phase2 = k * twist * 6 / (h * h);
  return [r + a * (k + 1) ** 2,
    baseFirst + a * (k + 1) * (e1 + phase1),
    baseSecond + a * (e2 + 2 * e1 * phase1 + phase2 + phase1 * phase1)];
}

export function generateMesh(input: OrnamentParameters, quality: 'preview' | 'export' = 'export', detail: StlDetail = defaultStlDetail): MeshResult {
  const parsed = ornamentSchema.safeParse(input);
  if (!parsed.success) throw new GeometryError('INVALID_PARAMETERS', parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '));
  const p = parsed.data, h = p.body.heightMm, n = p.neck.lengthMm;
  if (!Object.hasOwn(stlDetails, detail)) throw new GeometryError('INVALID_DETAIL', 'Neznámá přesnost STL.');
  const toleranceMm = quality === 'export' ? stlDetails[detail].toleranceMm : 0.2;
  // Maximum model coordinate is 156 mm. Reserve 0.0001 mm for float32 STL
  // quantization (less than 0.000014 mm in Euclidean distance at this scale).
  const interpolationBudget = toleranceMm - 0.0001;
  const triangleLimit = quality === 'export' ? EXPORT_TRIANGLE_LIMIT : PREVIEW_TRIANGLE_LIMIT;
  let angles = Math.max(quality === 'export' ? 256 : 128, 16 * p.surface.ribs);
  angles = Math.ceil(angles / 4) * 4;
  const maxAngular = p.body.baseDiameterMm / 2 + p.surface.amplitudeMm * (p.surface.ribs + 1) ** 2;
  while (maxAngular * (2 * Math.PI / angles) ** 2 / 8 > interpolationBudget / 3) angles *= 2;
  const dt = 2 * Math.PI / angles;
  const knots = [...new Set([0, n, n + h * p.body.maxRadiusAt,
    n + p.surface.blendLengthMm, n + h - p.surface.blendLengthMm, n + h])].sort((a, b) => a - b);
  const heights = [0];
  let errorBoundMm = 0;
  const split = (lo: number, hi: number, depth: number): void => {
    const [tt, tz, zz] = derivativeBounds(p, lo, hi), dz = hi - lo;
    const bound = tt * dt * dt / 8 + tz * dt * dz / 4 + zz * dz * dz / 8;
    if (bound <= interpolationBudget) {
      heights.push(hi); errorBoundMm = Math.max(errorBoundMm, bound);
      if (2 * angles * heights.length > triangleLimit)
        throw new GeometryError('RESOURCE_LIMIT', `Požadovaná přesnost překračuje limit ${triangleLimit.toLocaleString('cs-CZ')} trojúhelníků. ${quality === 'export' ? 'Zvolte hrubší detail STL, nebo snižte amplitudu, počet žeber či zkroucení.' : 'Snižte amplitudu, počet žeber či zkroucení. STL lze zkusit stáhnout s hrubším detailem.'}`);
      return;
    }
    if (depth >= 24) throw new GeometryError('PRECISION_LIMIT', 'Nelze dosáhnout požadované přesnosti triangulace.');
    const mid = (lo + hi) / 2;
    split(lo, mid, depth + 1); split(mid, hi, depth + 1);
  };
  for (let i = 1; i < knots.length; i++) split(knots[i - 1]!, knots[i]!, 0);

  const positions = new Float64Array((heights.length * angles + 2) * 3);
  for (let j = 0; j < heights.length; j++) for (let i = 0; i < angles; i++)
    positions.set(surfacePoint(p, i * dt, heights[j]!), (j * angles + i) * 3);
  const bottom = heights.length * angles, top = bottom + 1;
  positions.set([0, 0, 0], bottom * 3); positions.set([0, 0, n + h], top * 3);
  const indices = new Uint32Array(2 * angles * heights.length * 3);
  const faceRegions = new Uint8Array(indices.length / 3);
  let face = 0;
  const add = (a: number, b: number, c: number, region: number) => {
    indices.set([a, b, c], face * 3); faceRegions[face++] = region;
  };
  for (let j = 0; j < heights.length - 1; j++) for (let i = 0; i < angles; i++) {
    const next = (i + 1) % angles;
    const a = j * angles + i, b = j * angles + next, c = a + angles, d = b + angles;
    const region = heights[j + 1]! <= n ? FaceRegion.neck : FaceRegion.body;
    add(a, b, c, region); add(b, d, c, region);
  }
  for (let i = 0; i < angles; i++) {
    const next = (i + 1) % angles, last = (heights.length - 1) * angles;
    add(bottom, next, i, FaceRegion.baseCap);
    add(top, last + i, last + next, FaceRegion.tipCap);
  }
  return { positions, indices, faceRegions, sampling: { angles, heights, toleranceMm, errorBoundMm } };
}
