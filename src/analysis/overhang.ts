import type { MeshData } from '../geometry/mesh';
import { FaceRegion } from '../geometry/mesh';
import type { OverhangReport } from './types';

/** Face normals in print coordinates. Angle is measured FROM A VERTICAL WALL:
 * vertical=0°, downward horizontal=90°, upward facing=0°. */
export function analyseOverhang(mesh: MeshData, limitDeg: number): OverhangReport {
  const { positions: p, indices: ix } = mesh;
  const anglesDeg = new Float32Array(ix.length / 3);
  let maxAngleDeg = 0, riskyAreaMm2 = 0, evaluatedAreaMm2 = 0, riskyFaces = 0;
  let zMinMm = Infinity, zMaxMm = -Infinity;
  for (let f = 0; f < ix.length / 3; f++) {
    const a = ix[f * 3]! * 3, b = ix[f * 3 + 1]! * 3, c = ix[f * 3 + 2]! * 3;
    const minZ = Math.min(p[a + 2]!, p[b + 2]!, p[c + 2]!);
    const maxZ = Math.max(p[a + 2]!, p[b + 2]!, p[c + 2]!);
    // Also recognize the bed geometrically, for independent analytic fixtures.
    if (maxZ <= 1e-8 || mesh.faceRegions[f] === FaceRegion.baseCap || mesh.faceRegions[f] === FaceRegion.tipCap) continue;
    const abx = p[b]! - p[a]!, aby = p[b + 1]! - p[a + 1]!, abz = p[b + 2]! - p[a + 2]!;
    const acx = p[c]! - p[a]!, acy = p[c + 1]! - p[a + 1]!, acz = p[c + 2]! - p[a + 2]!;
    const nx = aby * acz - abz * acy, ny = abz * acx - abx * acz, nz = abx * acy - aby * acx;
    const length = Math.hypot(nx, ny, nz);
    if (!(length > 0) || !Number.isFinite(length)) throw new Error('Neplatná plocha při analýze normál.');
    const angle = Math.asin(Math.max(0, Math.min(1, -nz / length))) * 180 / Math.PI;
    anglesDeg[f] = angle; maxAngleDeg = Math.max(maxAngleDeg, angle); evaluatedAreaMm2 += length / 2;
    if (angle > limitDeg + 1e-8) {
      riskyFaces++; riskyAreaMm2 += length / 2;
      zMinMm = Math.min(zMinMm, minZ); zMaxMm = Math.max(zMaxMm, maxZ);
    }
  }
  return { anglesDeg, maxAngleDeg, riskyAreaMm2, evaluatedAreaMm2,
    riskyAreaFraction: evaluatedAreaMm2 ? riskyAreaMm2 / evaluatedAreaMm2 : 0,
    riskyFaces, zMinMm: riskyFaces ? zMinMm : null, zMaxMm: riskyFaces ? zMaxMm : null };
}
