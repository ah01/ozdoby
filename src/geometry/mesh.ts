import { ornamentSchema, type OrnamentParameters } from '../domain/parameters';
import { surfacePoint } from './surface';
import { angularSecondBound, derivativeBounds, surfaceKnots } from './surfaceBounds';
import { localDerivativeBounds } from './localBounds';
import { defaultStlDetail, EXPORT_TRIANGLE_LIMIT, PREVIEW_TRIANGLE_LIMIT, stlDetails, type StlDetail } from '../domain/stlDetail';

export const FaceRegion = { neck: 0, body: 1, baseCap: 2, tipCap: 3 } as const;
export interface MeshData {
  positions: Float64Array;
  indices: Uint32Array;
  faceRegions: Uint8Array;
}
export interface MeshResult extends MeshData {
  sampling: { angles: number; heights: number[]; toleranceMm: number; errorBoundMm: number; strategy: 'standard' | 'local' };
}
export class GeometryError extends Error {
  constructor(public readonly code: string, message: string) { super(message); }
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
  const maxAngular = angularSecondBound(p);
  while (maxAngular * (2 * Math.PI / angles) ** 2 / 8 > interpolationBudget / 3) angles *= 2;
  const knots = surfaceKnots(p);
  const plan = (count: number, bounds: typeof derivativeBounds): { heights: number[]; errorBoundMm: number } | null => {
    const heights = [0], dt = 2 * Math.PI / count;
    let errorBoundMm = 0;
    const split = (lo: number, hi: number, depth: number): boolean => {
      const [tt, tz, zz] = bounds(p, lo, hi), dz = hi - lo;
      const bound = tt * dt * dt / 8 + tz * dt * dz / 4 + zz * dz * dz / 8;
      if (bound <= interpolationBudget) {
        heights.push(hi); errorBoundMm = Math.max(errorBoundMm, bound);
        return 2 * count * heights.length <= triangleLimit;
      }
      if (depth >= 24) throw new GeometryError('PRECISION_LIMIT', 'Nelze dosáhnout požadované přesnosti triangulace.');
      const mid = (lo + hi) / 2;
      return split(lo, mid, depth + 1) && split(mid, hi, depth + 1);
    };
    for (let i = 1; i < knots.length; i++) if (!split(knots[i - 1]!, knots[i]!, 0)) return null;
    return { heights, errorBoundMm };
  };
  // Preserve existing small meshes. Before rejecting a dense surface,
  // try interval-local derivative bounds and several balanced angular counts.
  // Every plan keeps the same tolerance and resource cap; no mesh is allocated yet.
  let sampling = plan(angles, derivativeBounds), strategy: MeshResult['sampling']['strategy'] = 'standard';
  if (!sampling || (quality === 'preview' && 2 * angles * sampling.heights.length > 600_000)) {
    const required = Math.max(quality === 'export' ? 256 : 128, 16 * p.surface.ribs,
      2 * Math.PI * Math.sqrt(maxAngular / (8 * interpolationBudget / 3)));
    let bestTriangles = sampling ? 2 * angles * sampling.heights.length : Infinity;
    for (const count of new Set([1, 1.25, 1.5, 2].map(factor => Math.ceil(required * factor / 4) * 4).concat(angles))) {
      const candidate = plan(count, localDerivativeBounds);
      const triangles = candidate ? 2 * count * candidate.heights.length : Infinity;
      if (triangles < bestTriangles) { sampling = candidate; angles = count; bestTriangles = triangles; strategy = 'local'; }
    }
  }
  if (!sampling) throw new GeometryError('RESOURCE_LIMIT', `Požadovaná přesnost překračuje limit ${triangleLimit.toLocaleString('cs-CZ')} trojúhelníků i po optimalizaci sítě. ${quality === 'export' ? 'Zvolte hrubší detail STL, nebo snižte hloubku či počet žeber a vln nebo zkroucení.' : 'Snižte hloubku či počet žeber a vln nebo zkroucení. STL lze zkusit stáhnout s hrubším detailem.'}`);
  const { heights } = sampling, dt = 2 * Math.PI / angles, pointed = p.body.tipRadiusMm === 0;
  let errorBoundMm = sampling.errorBoundMm;

  if (pointed) {
    const scale = Math.max(n + h, p.body.baseDiameterMm + 2 * (p.surface.amplitudeMm + p.surface.waveAmplitudeMm), 1);
    const areaEpsilon = scale ** 2 * 1e-12;
    const usableFan = (z: number): boolean => {
      for (let i = 0; i < angles; i++) {
        const a = surfacePoint(p, i * dt, z).map(Math.fround), b = surfacePoint(p, ((i + 1) % angles) * dt, z).map(Math.fround);
        const dz = Math.fround(n + h) - a[2]!;
        if (Math.hypot(dz * (b[1]! - a[1]!), dz * (a[0]! - b[0]!), a[0]! * b[1]! - a[1]! * b[0]!) / 2 <= areaEpsilon) return false;
      }
      return true;
    };
    while (!usableFan(heights[heights.length - 2]!)) {
      const lo = heights[heights.length - 3]!;
      if (heights.length < 3 || lo < Math.max(n + h * p.body.maxRadiusAt, n + h - p.surface.blendLengthMm))
        throw new GeometryError('PRECISION_LIMIT', 'Špičku nelze bezpečně triangulovat s tímto nastavením.');
      const [tt, tz, zz] = localDerivativeBounds(p, lo, n + h), dz = n + h - lo;
      const bound = tt * dt ** 2 / 8 + tz * dt * dz / 4 + zz * dz ** 2 / 8;
      if (bound > interpolationBudget) throw new GeometryError('PRECISION_LIMIT', 'Špička vyžaduje jinou přesnost STL nebo menší deformaci.');
      heights.splice(heights.length - 2, 1); errorBoundMm = Math.max(errorBoundMm, bound);
    }
  }
  const ringHeights = pointed ? heights.slice(0, -1) : heights;

  const positions = new Float64Array((ringHeights.length * angles + 2) * 3);
  for (let j = 0; j < ringHeights.length; j++) for (let i = 0; i < angles; i++)
    positions.set(surfacePoint(p, i * dt, ringHeights[j]!), (j * angles + i) * 3);
  const bottom = ringHeights.length * angles, top = bottom + 1;
  positions.set([0, 0, 0], bottom * 3); positions.set([0, 0, n + h], top * 3);
  const indices = new Uint32Array(2 * angles * ringHeights.length * 3);
  const faceRegions = new Uint8Array(indices.length / 3);
  let face = 0;
  const add = (a: number, b: number, c: number, region: number) => {
    indices.set([a, b, c], face * 3); faceRegions[face++] = region;
  };
  for (let j = 0; j < ringHeights.length - 1; j++) for (let i = 0; i < angles; i++) {
    const next = (i + 1) % angles;
    const a = j * angles + i, b = j * angles + next, c = a + angles, d = b + angles;
    const region = ringHeights[j + 1]! <= n ? FaceRegion.neck : FaceRegion.body;
    add(a, b, c, region); add(b, d, c, region);
  }
  for (let i = 0; i < angles; i++) {
    const next = (i + 1) % angles, last = (ringHeights.length - 1) * angles;
    add(bottom, next, i, FaceRegion.baseCap);
    add(top, last + i, last + next, pointed ? FaceRegion.body : FaceRegion.tipCap);
  }
  return { positions, indices, faceRegions, sampling: { angles, heights, toleranceMm, errorBoundMm, strategy } };
}
