import { GeometryError, type MeshData } from '../geometry/mesh';
import { validateMesh } from '../geometry/validate';

/** Binary solid STL; all coordinates are millimetres, Z-up, neck on Z=0. */
export function encodeStl(mesh: MeshData): ArrayBuffer {
  const original = validateMesh(mesh);
  if (!original.valid) throw new GeometryError('INVALID_MESH', original.issues.map(i => i.message).join(' '));
  // Validate the actual float32 coordinates before writing; do not rely on float64 validity.
  const quantized = { ...mesh, positions: Float64Array.from(mesh.positions, Math.fround) };
  const check = validateMesh(quantized);
  if (!check.valid || check.bounds.min.some((v, i) => Math.abs(v - original.bounds.min[i]!) > 0.001)
    || check.bounds.max.some((v, i) => Math.abs(v - original.bounds.max[i]!) > 0.001))
    throw new GeometryError('FLOAT32_PRECISION', 'Převod STL do float32 poškodil geometrii nebo rozměry.');
  const buffer = new ArrayBuffer(84 + check.triangles * 50), view = new DataView(buffer);
  new Uint8Array(buffer, 0, 80).set(new TextEncoder().encode('3d-bulb 0.1.0 | solid | mm | Z-up | neck-first'));
  view.setUint32(80, check.triangles, true);
  const p = quantized.positions;
  for (let f = 0; f < check.triangles; f++) {
    const a = mesh.indices[f * 3]! * 3, b = mesh.indices[f * 3 + 1]! * 3, c = mesh.indices[f * 3 + 2]! * 3;
    const ab = [p[b]! - p[a]!, p[b + 1]! - p[a + 1]!, p[b + 2]! - p[a + 2]!];
    const ac = [p[c]! - p[a]!, p[c + 1]! - p[a + 1]!, p[c + 2]! - p[a + 2]!];
    const normal = [ab[1]! * ac[2]! - ab[2]! * ac[1]!, ab[2]! * ac[0]! - ab[0]! * ac[2]!, ab[0]! * ac[1]! - ab[1]! * ac[0]!];
    const length = Math.hypot(...normal), offset = 84 + f * 50;
    normal.forEach((v, i) => view.setFloat32(offset + i * 4, v / length, true));
    [a, b, c].forEach((v, j) => { for (let i = 0; i < 3; i++) view.setFloat32(offset + 12 + j * 12 + i * 4, p[v + i]!, true); });
    view.setUint16(offset + 48, 0, true);
  }
  return buffer;
}
