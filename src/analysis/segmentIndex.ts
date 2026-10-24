/** Exact point-to-SEGMENT distance on a closed XY contour. The BVH divides
 * consecutive angle-ordered edges; bounds prune search without assuming that
 * the nearest point has the same polar angle (essential for twisted ribs). */
export class SegmentIndex {
  private readonly bounds: Float64Array;
  private readonly starts: Uint32Array;
  private readonly ends: Uint32Array;
  readonly count: number;
  constructor(readonly xy: Float64Array) {
    this.count = xy.length / 2;
    if (!Number.isInteger(this.count) || this.count < 3) throw new Error('Obrys potřebuje alespoň tři body.');
    this.bounds = new Float64Array(this.count * 16);
    this.starts = new Uint32Array(this.count * 4); this.ends = new Uint32Array(this.count * 4);
    this.build(0, 0, this.count);
  }
  private build(node: number, lo: number, hi: number): void {
    this.starts[node] = lo; this.ends[node] = hi;
    const offset = node * 4;
    if (hi - lo <= 8) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (let i = lo; i <= hi; i++) {
        const v = i % this.count, x = this.xy[2 * v]!, y = this.xy[2 * v + 1]!;
        minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      }
      this.bounds.set([minX, minY, maxX, maxY], offset); return;
    }
    const mid = Math.floor((lo + hi) / 2), left = 2 * node + 1, right = left + 1;
    this.build(left, lo, mid); this.build(right, mid, hi);
    const l = left * 4, r = right * 4;
    this.bounds.set([Math.min(this.bounds[l]!, this.bounds[r]!), Math.min(this.bounds[l + 1]!, this.bounds[r + 1]!),
      Math.max(this.bounds[l + 2]!, this.bounds[r + 2]!), Math.max(this.bounds[l + 3]!, this.bounds[r + 3]!)], offset);
  }
  private edgeSquared(x: number, y: number, edge: number): number {
    const a = 2 * edge, b = 2 * ((edge + 1) % this.count);
    const dx = this.xy[b]! - this.xy[a]!, dy = this.xy[b + 1]! - this.xy[a + 1]!;
    const length2 = dx * dx + dy * dy;
    const t = length2 ? Math.max(0, Math.min(1, ((x - this.xy[a]!) * dx + (y - this.xy[a + 1]!) * dy) / length2)) : 0;
    return (x - this.xy[a]! - t * dx) ** 2 + (y - this.xy[a + 1]! - t * dy) ** 2;
  }
  private boxSquared(node: number, x: number, y: number): number {
    const o = node * 4;
    const dx = Math.max(this.bounds[o]! - x, 0, x - this.bounds[o + 2]!);
    const dy = Math.max(this.bounds[o + 1]! - y, 0, y - this.bounds[o + 3]!);
    return dx * dx + dy * dy;
  }
  private search(node: number, x: number, y: number, best: number): number {
    if (this.boxSquared(node, x, y) > best) return best;
    const lo = this.starts[node]!, hi = this.ends[node]!;
    if (hi - lo <= 8) {
      for (let edge = lo; edge < hi; edge++) best = Math.min(best, this.edgeSquared(x, y, edge));
      return best;
    }
    const left = 2 * node + 1, right = left + 1;
    if (this.boxSquared(left, x, y) < this.boxSquared(right, x, y))
      return this.search(right, x, y, this.search(left, x, y, best));
    return this.search(left, x, y, this.search(right, x, y, best));
  }
  distance(x: number, y: number, hintEdge = 0): number {
    return Math.sqrt(this.search(0, x, y, this.edgeSquared(x, y, hintEdge % this.count)));
  }
}
