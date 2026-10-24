import { FaceRegion, type MeshData } from '../../geometry/mesh';

export interface RenderData { positions: Float32Array; normals: Float32Array; colors: Float32Array }

/** An isolated, non-indexed render copy: smooth side normals, flat caps and
 * per-face neck colour. The canonical indexed mesh is never modified. */
export function createRenderData(mesh: MeshData): RenderData {
  const { positions, indices, faceRegions } = mesh;
  const accumulated = new Float64Array(positions.length);
  const faceNormals = new Float64Array(indices.length);
  for (let f = 0; f < indices.length / 3; f++) {
    const [a, b, c] = [indices[3 * f]! * 3, indices[3 * f + 1]! * 3, indices[3 * f + 2]! * 3];
    const ab = [positions[b]! - positions[a]!, positions[b + 1]! - positions[a + 1]!, positions[b + 2]! - positions[a + 2]!];
    const ac = [positions[c]! - positions[a]!, positions[c + 1]! - positions[a + 1]!, positions[c + 2]! - positions[a + 2]!];
    const normal = [ab[1]! * ac[2]! - ab[2]! * ac[1]!, ab[2]! * ac[0]! - ab[0]! * ac[2]!, ab[0]! * ac[1]! - ab[1]! * ac[0]!];
    const length = Math.hypot(...normal);
    faceNormals.set(normal.map(v => v / length), f * 3);
    if (faceRegions[f] !== FaceRegion.baseCap && faceRegions[f] !== FaceRegion.tipCap)
      for (const vertex of [a, b, c]) for (let k = 0; k < 3; k++) accumulated[vertex + k] = accumulated[vertex + k]! + normal[k]!;
  }
  for (let v = 0; v < accumulated.length; v += 3) {
    const length = Math.hypot(accumulated[v]!, accumulated[v + 1]!, accumulated[v + 2]!) || 1;
    for (let k = 0; k < 3; k++) accumulated[v + k] = accumulated[v + k]! / length;
  }
  const renderPositions = new Float32Array(indices.length * 3), normals = new Float32Array(indices.length * 3), colors = new Float32Array(indices.length * 3);
  // Linear RGB values; meshStandardMaterial performs the display conversion.
  const body = [0.69, 0.60, 0.43], neck = [0.35, 0.20, 0.11];
  for (let f = 0; f < indices.length / 3; f++) for (let corner = 0; corner < 3; corner++) {
    const vertex = indices[f * 3 + corner]! * 3, target = (f * 3 + corner) * 3;
    const cap = faceRegions[f] === FaceRegion.baseCap || faceRegions[f] === FaceRegion.tipCap;
    renderPositions.set(positions.subarray(vertex, vertex + 3), target);
    normals.set(cap ? faceNormals.subarray(f * 3, f * 3 + 3) : accumulated.subarray(vertex, vertex + 3), target);
    colors.set(faceRegions[f] === FaceRegion.neck || faceRegions[f] === FaceRegion.baseCap ? neck : body, target);
  }
  return { positions: renderPositions, normals, colors };
}
