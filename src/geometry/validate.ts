import type { MeshData } from './mesh';

export interface ValidationIssue { code: string; message: string; face?: number }
export interface MeshValidation {
  valid: boolean; issues: ValidationIssue[]; vertices: number; triangles: number;
  edges: number; components: number; euler: number; volumeMm3: number;
  bounds: { min: number[]; max: number[]; size: number[] };
}

/** General topological validator. Self-intersection freedom additionally relies on
 * the generator's positive, angle-ordered radial rings and strictly increasing Z.
 * This function does NOT certify arbitrary imported meshes against intersections.
 */
export function validateMesh(mesh: MeshData): MeshValidation {
  const { positions: p, indices: ix } = mesh, vertices = p.length / 3, triangles = ix.length / 3;
  const issues: ValidationIssue[] = [];
  const issue = (code: string, message: string, face?: number) => {
    if (issues.length < 100) issues.push({ code, message, face });
  };
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i++) {
    if (!Number.isFinite(p[i])) issue('NON_FINITE', 'Síť obsahuje nekonečné nebo nečíselné souřadnice.');
    min[i % 3] = Math.min(min[i % 3]!, p[i]!); max[i % 3] = Math.max(max[i % 3]!, p[i]!);
  }
  const size = min.map((v, i) => max[i]! - v);
  if (!Number.isInteger(vertices) || !Number.isInteger(triangles) || !triangles || mesh.faceRegions.length !== triangles) {
    issue('ARRAY_LENGTH', 'Nesprávná délka polí nebo prázdná síť.');
    return { valid: false, issues, vertices, triangles, edges: 0, components: 0, euler: 0, volumeMm3: 0, bounds: { min, max, size } };
  }
  const scale = Math.max(1, ...size), areaEpsilon = scale ** 2 * 1e-12;
  // Packed edges and a face hash table keep validation bounded at millions of
  // triangles. Avoid one JS object per edge and one string per face.
  const edgeKeys = new Float64Array(ix.length);
  let edgeCount = 0;
  const parent = Uint32Array.from({ length: vertices }, (_, i) => i);
  const used = new Uint8Array(vertices);
  let faceSlots = 1;
  while (faceSlots < triangles * 2) faceSlots *= 2;
  const faces = new Uint32Array(faceSlots), mask = faceSlots - 1;
  const sortedFace = (a: number, b: number, c: number): [number, number, number] => {
    if (a > b) [a, b] = [b, a];
    if (b > c) [b, c] = [c, b];
    if (a > b) [a, b] = [b, a];
    return [a, b, c];
  };
  const root = (a: number): number => {
    let r = a;
    while (parent[r] !== r) r = parent[r]!;
    while (parent[a] !== a) { const next = parent[a]!; parent[a] = r; a = next; }
    return r;
  };
  let volumeMm3 = 0;
  for (let f = 0; f < Math.floor(triangles); f++) {
    const a = ix[3 * f]!, b = ix[3 * f + 1]!, c = ix[3 * f + 2]!;
    if ([a, b, c].some(i => i >= vertices)) { issue('INDEX_RANGE', 'Index vrcholu je mimo rozsah.', f); continue; }
    const [fa, fb, fc] = sortedFace(a, b, c);
    let slot = (Math.imul(fa, 73856093) ^ Math.imul(fb, 19349663) ^ Math.imul(fc, 83492791)) & mask;
    while (faces[slot]) {
      const previous = (faces[slot]! - 1) * 3;
      const [pa, pb, pc] = sortedFace(ix[previous]!, ix[previous + 1]!, ix[previous + 2]!);
      if (fa === pa && fb === pb && fc === pc) { issue('DUPLICATE_FACE', 'Duplicitní trojúhelník.', f); break; }
      slot = (slot + 1) & mask;
    }
    if (!faces[slot]) faces[slot] = f + 1;
    const ax = p[a * 3]!, ay = p[a * 3 + 1]!, az = p[a * 3 + 2]!;
    const bx = p[b * 3]!, by = p[b * 3 + 1]!, bz = p[b * 3 + 2]!;
    const cx = p[c * 3]!, cy = p[c * 3 + 1]!, cz = p[c * 3 + 2]!;
    const nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay);
    const ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
    const nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (Math.hypot(nx, ny, nz) / 2 <= areaEpsilon) issue('DEGENERATE_FACE', 'Nulová nebo zanedbatelná plocha.', f);
    volumeMm3 += (ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx)) / 6;
    for (const [u, v] of [[a, b], [b, c], [c, a]]) {
      used[u!] = 1; used[v!] = 1; parent[root(u!)] = root(v!);
      const edgeKey = Math.min(u!, v!) * vertices + Math.max(u!, v!);
      // Keys are exact integers at the generator's bounded vertex counts.
      edgeKeys[edgeCount++] = edgeKey * 2 + (u! < v! ? 1 : 0);
    }
  }
  const sortedEdges = edgeKeys.subarray(0, edgeCount).sort();
  let edges = 0, nonManifold = false, winding = false;
  for (let i = 0; i < sortedEdges.length;) {
    const key = Math.floor(sortedEdges[i]! / 2);
    let count = 0, direction = 0;
    do { direction += sortedEdges[i]! % 2 ? 1 : -1; count++; i++; }
    while (i < sortedEdges.length && Math.floor(sortedEdges[i]! / 2) === key);
    edges++; nonManifold ||= count !== 2; winding ||= direction !== 0;
  }
  if (nonManifold) issue('NON_MANIFOLD_EDGE', 'Každá hrana musí mít právě dvě incidentní plochy.');
  if (winding) issue('WINDING', 'Směry sdílených hran nejsou opačné.');
  const seenRoots = new Uint8Array(vertices);
  let components = 0, usedCount = 0;
  for (let i = 0; i < vertices; i++) if (used[i]) {
    usedCount++;
    const r = root(i);
    if (!seenRoots[r]) { components++; seenRoots[r] = 1; }
  }
  if (components !== 1) issue('COMPONENTS', 'Tělo musí mít jednu souvislou komponentu.');
  if (usedCount !== vertices) issue('UNUSED_VERTEX', 'Síť obsahuje nepoužité vrcholy.');
  const euler = vertices - edges + triangles;
  if (euler !== 2) issue('EULER', 'Eulerova charakteristika těla musí být 2.');
  if (!(volumeMm3 > scale ** 3 * 1e-12)) issue('VOLUME', 'Podepsaný objem musí být kladný.');
  return { valid: issues.length === 0, issues, vertices, triangles, edges, components, euler, volumeMm3,
    bounds: { min, max, size } };
}
