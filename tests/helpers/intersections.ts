import type { MeshData } from '../../src/geometry/mesh';

type V3 = [number, number, number];
type Box = { min: V3; max: V3 };
type Triangle = Box & { ids: number[]; points: V3[] };
type Node = Box & { count: number; triangles?: Triangle[]; left?: Node; right?: Node };
const subtract = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Independent triangle intersection audit with a spatial BVH. SAT uses both
 * face normals, all edge cross products, and in-plane axes for coplanar cases.
 * Incident pairs are deliberately excluded, so shared edges/vertices are legal.
 * This is a test oracle for the generated fixtures, not an imported-CAD validator.
 */
export function hasNonIncidentIntersection(mesh: MeshData): boolean {
  const triangles: Triangle[] = [];
  for (let f = 0; f < mesh.indices.length; f += 3) {
    const ids = [...mesh.indices.slice(f, f + 3)];
    const points = ids.map(id => [...mesh.positions.slice(3 * id, 3 * id + 3)] as V3);
    triangles.push({ ids, points, min: [0, 1, 2].map(k => Math.min(...points.map(p => p[k]!))) as V3,
      max: [0, 1, 2].map(k => Math.max(...points.map(p => p[k]!))) as V3 });
  }
  if (triangles.length === 0) return false;
  const build = (items: Triangle[]): Node => {
    const min: V3 = [Infinity, Infinity, Infinity], max: V3 = [-Infinity, -Infinity, -Infinity];
    for (const t of items) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k]!, t.min[k]!); max[k] = Math.max(max[k]!, t.max[k]!); }
    const node: Node = { min, max, count: items.length };
    if (items.length <= 8) { node.triangles = items; return node; }
    const extents = max.map((v, k) => v - min[k]!);
    const axis = extents.indexOf(Math.max(...extents));
    items.sort((a, b) => a.min[axis]! + a.max[axis]! - b.min[axis]! - b.max[axis]!);
    const mid = Math.floor(items.length / 2);
    node.left = build(items.slice(0, mid)); node.right = build(items.slice(mid));
    return node;
  };
  const tree = build(triangles), epsilon = Math.max(1, ...tree.max.map((v, k) => v - tree.min[k]!)) * 1e-10;
  const overlap = (a: Box, b: Box) => a.min.every((v, k) => v <= b.max[k]! + epsilon && a.max[k]! >= b.min[k]! - epsilon);
  const intersect = (a: Triangle, b: Triangle): boolean => {
    if (a.ids.some(id => b.ids.includes(id)) || !overlap(a, b)) return false;
    const edges = (t: Triangle) => [subtract(t.points[1]!, t.points[0]!), subtract(t.points[2]!, t.points[1]!), subtract(t.points[0]!, t.points[2]!)];
    const ea = edges(a), eb = edges(b), na = cross(ea[0]!, ea[1]!), nb = cross(eb[0]!, eb[1]!);
    const axes = [na, nb, ...ea.flatMap(u => eb.map(v => cross(u, v))), ...ea.map(e => cross(na, e)), ...eb.map(e => cross(nb, e))];
    for (const axis of axes) {
      const length = Math.hypot(...axis);
      if (length < 1e-14) continue;
      const normalized = axis.map(v => v / length) as V3;
      const pa = a.points.map(p => dot(p, normalized)), pb = b.points.map(p => dot(p, normalized));
      if (Math.max(...pa) < Math.min(...pb) - epsilon || Math.max(...pb) < Math.min(...pa) - epsilon) return false;
    }
    return true;
  };
  const visit = (a: Node, b: Node): boolean => {
    if (!overlap(a, b)) return false;
    if (a === b && a.left) return visit(a.left, a.left) || visit(a.left, a.right!) || visit(a.right!, a.right!);
    if (a.triangles && b.triangles) {
      for (let i = 0; i < a.triangles.length; i++) for (let j = a === b ? i + 1 : 0; j < b.triangles.length; j++)
        if (intersect(a.triangles[i]!, b.triangles[j]!)) return true;
      return false;
    }
    if (a.left && (!b.left || a.count >= b.count)) return visit(a.left, b) || visit(a.right!, b);
    return visit(a, b.left!) || visit(a, b.right!);
  };
  return visit(tree, tree);
}
