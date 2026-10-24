import type { MeshData } from '../../src/geometry/mesh';

/** Independent binary STL reader. Welds identical float32 positions without using
 * generator rings, region data or encoder implementation. */
export function readStl(buffer: ArrayBuffer): MeshData {
  const view = new DataView(buffer), count = view.getUint32(80, true);
  if (buffer.byteLength !== 84 + 50 * count) throw new Error('Invalid STL length');
  const positions: number[] = [], indices: number[] = [], map = new Map<string, number>();
  for (let f = 0; f < count; f++) for (let v = 0; v < 3; v++) {
    const point = Array.from({ length: 3 }, (_, i) => view.getFloat32(84 + 50 * f + 12 + 12 * v + 4 * i, true));
    if (!point.every(Number.isFinite)) throw new Error('Non-finite STL vertex');
    const key = point.map(n => Object.is(n, -0) ? 0 : n).join(',');
    let index = map.get(key);
    if (index === undefined) { index = positions.length / 3; map.set(key, index); positions.push(...point); }
    indices.push(index);
  }
  return { positions: Float64Array.from(positions), indices: Uint32Array.from(indices), faceRegions: new Uint8Array(count) };
}
