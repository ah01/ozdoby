import { describe, expect, it } from 'vitest';
import { defaultPrint, ornamentSchema, validateBottom } from '../src/domain/parameters';
import { createPreset } from '../src/domain/presets';
import { FaceRegion, generateMesh, GeometryError, type MeshData } from '../src/geometry/mesh';
import { profileRadius, smoothShoulderAngle } from '../src/geometry/profile';
import { surfacePoint, surfaceRadius } from '../src/geometry/surface';
import { validateMesh } from '../src/geometry/validate';
import { encodeStl } from '../src/io/stl';
import { readStl } from './helpers/read-stl';

function cylinder(radius = 10, height = 20, segments = 128): MeshData {
  const positions: number[] = [], indices: number[] = [];
  for (const z of [0, height]) for (let i = 0; i < segments; i++)
    positions.push(radius * Math.cos(i * 2 * Math.PI / segments), radius * Math.sin(i * 2 * Math.PI / segments), z);
  positions.push(0, 0, 0, 0, 0, height);
  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    indices.push(i, next, i + segments, next, next + segments, i + segments,
      2 * segments, next, i, 2 * segments + 1, i + segments, next + segments);
  }
  return { positions: Float64Array.from(positions), indices: Uint32Array.from(indices), faceRegions: new Uint8Array(indices.length / 3) };
}

describe('canonical geometry', () => {
  it.each(['round', 'elongated', 'drop'] as const)('%s is a closed, outward solid in mm', shape => {
    const p = createPreset(shape), mesh = generateMesh(p), report = validateMesh(mesh);
    expect(report.issues).toEqual([]);
    expect(report.components).toBe(1); expect(report.euler).toBe(2);
    expect(report.bounds.size).toEqual([56, 56, p.body.heightMm + p.neck.lengthMm]);
    expect(report.bounds.min[2]).toBe(0); expect(report.volumeMm3).toBeGreaterThan(0);
    const critical = [p.neck.lengthMm, p.neck.lengthMm + p.body.heightMm * p.body.maxRadiusAt,
      p.neck.lengthMm + p.surface.blendLengthMm, p.neck.lengthMm + p.body.heightMm - p.surface.blendLengthMm];
    critical.forEach(z => expect(mesh.sampling.heights).toContain(z));
  });

  it('agrees with independent analytic cylinder volume and catches inverted winding', () => {
    const mesh = cylinder(), report = validateMesh(mesh);
    expect(report.valid).toBe(true); expect(report.bounds.size).toEqual([20, 20, 20]);
    expect(report.volumeMm3 / (Math.PI * 10 ** 2 * 20)).toBeCloseTo(1, 3);
    for (let i = 0; i < mesh.indices.length; i += 3)
      [mesh.indices[i], mesh.indices[i + 1]] = [mesh.indices[i + 1]!, mesh.indices[i]!];
    expect(validateMesh(mesh).issues.map(i => i.code)).toContain('VOLUME');
  });

  it('preserves a circular neck and protected interfaces with ribs and twist', () => {
    const p = createPreset(); p.surface.amplitudeMm = 2; p.surface.twistDeg = 120;
    for (const z of [0, 1, p.neck.lengthMm]) for (let i = 0; i < 100; i++)
      expect(surfaceRadius(p, i * Math.PI / 50, z)).toBe(7);
    expect(surfaceRadius(p, 1, 96)).toBeCloseTo(1.2, 12);
    expect(profileRadius(p, 52)).toBe(28);
    const mesh = generateMesh(p, 'preview'); expect(validateMesh(mesh).valid).toBe(true);
  });

  it('has no twist effect at zero amplitude and is deterministic', () => {
    const p = createPreset(), a = generateMesh(p, 'preview'); p.surface.twistDeg = 180;
    const b = generateMesh(p, 'preview');
    expect(b.positions).toEqual(a.positions); expect(b.indices).toEqual(a.indices);
  });

  it('samples the prescribed rib period and positive twist direction', () => {
    const p = createPreset(); p.surface.amplitudeMm = 1;
    const z = 52, r = surfaceRadius(p, 0, z);
    expect(surfaceRadius(p, Math.PI / p.surface.ribs, z)).toBeCloseTo(r - 2);
    p.surface.twistDeg = 120;
    const phi = (120 * Math.PI / 180) / 2;
    expect(surfaceRadius(p, phi, z)).toBeCloseTo(r);
    expect(surfaceRadius(p, phi + 2 * Math.PI / p.surface.ribs, z)).toBeCloseTo(r);
  });

  it('conservatively bounds deviation inside triangles, including diagonal edges', () => {
    const p = createPreset(); p.surface.amplitudeMm = 1; p.surface.twistDeg = 80;
    const mesh = generateMesh(p), { angles, heights, errorBoundMm } = mesh.sampling;
    expect(errorBoundMm).toBeLessThanOrEqual(0.05);
    for (let j = 0; j < heights.length - 1; j += 3) for (let i = 0; i < angles; i += 7)
      for (const [s, t] of [[0.5, 0.5], [0.2, 0.3], [0.8, 0.7], [0, 0.5], [0.5, 0]]) {
        const z = heights[j]! + t! * (heights[j + 1]! - heights[j]!);
        const theta = (i + s!) * 2 * Math.PI / angles;
        const point = surfacePoint(p, theta, z), next = (i + 1) % angles;
        const a = j * angles + i, b = j * angles + next, c = a + angles, d = b + angles;
        const corners = s! + t! <= 1 ? [a, b, c] : [d, c, b];
        const weights = s! + t! <= 1 ? [1 - s! - t!, s!, t!] : [s! + t! - 1, 1 - s!, 1 - t!];
        const interpolated = [0, 1, 2].map(axis => corners.reduce((sum, corner, k) => sum + weights[k]! * mesh.positions[corner * 3 + axis]!, 0));
        expect(Math.hypot(...point.map((v, k) => v - interpolated[k]!))).toBeLessThanOrEqual(errorBoundMm + 1e-10);
      }
  });

  it('keeps radial cells ordered and finite over 50 reproducible parameter combinations', () => {
    let seed = 0x321fa;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
    let valid = 0;
    for (let c = 0; c < 50; c++) {
      const p = createPreset((['round', 'elongated', 'drop'] as const)[c % 3]);
      p.body.baseDiameterMm = 30 + random() * 70; p.body.heightMm = 35 + random() * 105;
      p.body.maxRadiusAt = 0.3 + random() * 0.4; p.body.tipRadiusMm = 0.8 + random() * 2.2;
      p.neck.diameterMm = 10 + random() * 14; p.neck.lengthMm = 5 + random() * 11;
      p.surface.ribs = 3 + Math.floor(random() * 22); p.surface.amplitudeMm = random() * 4;
      p.surface.twistDeg = -180 + random() * 360;
      p.surface.blendLengthMm = 4 + random() * (Math.min(20, p.body.heightMm / 2) - 4);
      try {
        const mesh = generateMesh(p, 'preview'), report = validateMesh(mesh);
        expect(report.issues).toEqual([]); valid++;
        const { heights, angles } = mesh.sampling;
        expect(heights.every((z, i) => i === 0 || z > heights[i - 1]!)).toBe(true);
        // Positive radial rings, angle gaps < π and increasing Z constrain every
        // triangle to a distinct convex angular wedge / vertical slab.
        let radialInvariant = true;
        for (let j = 0; j < heights.length; j++) for (let i = 0; i < angles; i++) {
          const index = (j * angles + i) * 3, theta = i * 2 * Math.PI / angles;
          const x = mesh.positions[index]!, y = mesh.positions[index + 1]!;
          if (!(x * Math.cos(theta) + y * Math.sin(theta) > 0)
            || Math.abs(y * Math.cos(theta) - x * Math.sin(theta)) >= 1e-10) radialInvariant = false;
        }
        expect(radialInvariant).toBe(true);
      } catch (error) {
        if (!(error instanceof GeometryError)) throw error;
        expect(['INVALID_PARAMETERS', 'RESOURCE_LIMIT']).toContain(error.code);
      }
    }
    expect(valid).toBeGreaterThan(35);
  });

  it('handles extreme supported dimensions with a solid or structured resource refusal', () => {
    for (const extreme of [false, true]) {
      const p = createPreset(); p.body.baseDiameterMm = extreme ? 100 : 30;
      p.body.heightMm = extreme ? 140 : 35; p.body.tipRadiusMm = extreme ? 3 : 0.8;
      p.surface.blendLengthMm = 4; p.surface.amplitudeMm = 4; p.surface.ribs = 24; p.surface.twistDeg = 180;
      try { expect(validateMesh(generateMesh(p)).valid).toBe(true); }
      catch (error) { expect(error).toBeInstanceOf(GeometryError); expect(['INVALID_PARAMETERS', 'RESOURCE_LIMIT']).toContain((error as GeometryError).code); }
    }
  });

  it('identifies the short wide shoulder as riskier without declaring printability', () => {
    const p = createPreset('round'); p.body.baseDiameterMm = 90; p.body.heightMm = 35;
    expect(smoothShoulderAngle(createPreset())).toBeLessThan(45);
    expect(smoothShoulderAngle(p)).toBeGreaterThan(70);
  });
});

describe('mesh validation and export', () => {
  it('rejects malformed array lengths without attempting graph traversal', () => {
    expect(validateMesh({ positions: new Float64Array(4), indices: Uint32Array.from([0, 1, 0]), faceRegions: new Uint8Array(1) }).issues.map(i => i.code)).toContain('ARRAY_LENGTH');
  });
  it.each(['missing', 'flipped', 'duplicate', 'degenerate', 'index', 'nan'] as const)('detects %s corruption', kind => {
    const mesh = cylinder();
    if (kind === 'missing') { mesh.indices = mesh.indices.slice(3); mesh.faceRegions = mesh.faceRegions.slice(1); }
    if (kind === 'flipped') [mesh.indices[0], mesh.indices[1]] = [mesh.indices[1]!, mesh.indices[0]!];
    if (kind === 'duplicate') mesh.indices.set(mesh.indices.slice(0, 3), 3);
    if (kind === 'degenerate') mesh.indices[0] = mesh.indices[1]!;
    if (kind === 'index') mesh.indices[0] = 1_000_000;
    if (kind === 'nan') mesh.positions[0] = NaN;
    const codes = { missing: 'NON_MANIFOLD_EDGE', flipped: 'WINDING', duplicate: 'DUPLICATE_FACE',
      degenerate: 'DEGENERATE_FACE', index: 'INDEX_RANGE', nan: 'NON_FINITE' };
    expect(validateMesh(mesh).issues.map(i => i.code)).toContain(codes[kind]);
    expect(() => encodeStl(mesh)).toThrow(GeometryError);
  });

  it('round-trips binary STL with independent welding, winding, volume and units', () => {
    const mesh = generateMesh(createPreset()), buffer = encodeStl(mesh);
    expect(buffer.byteLength).toBe(84 + mesh.indices.length / 3 * 50);
    const decoded = validateMesh(readStl(buffer));
    expect(decoded.issues).toEqual([]); expect(decoded.bounds.size).toEqual([56, 56, 96]);
    expect(decoded.volumeMm3 / validateMesh(mesh).volumeMm3).toBeCloseTo(1, 6);
    expect([...mesh.faceRegions].filter(r => r === FaceRegion.baseCap)).toHaveLength(mesh.sampling.angles);
  });

  it('rejects invalid numeric values, versions, fractions and bottom height', () => {
    for (const value of [NaN, Infinity, -1, 29, 101]) {
      const p = createPreset(); p.body.baseDiameterMm = value;
      expect(ornamentSchema.safeParse(p).success).toBe(false);
      expect(() => generateMesh(p)).toThrow(GeometryError);
    }
    const p = createPreset(); p.surface.ribs = 4.5;
    expect(ornamentSchema.safeParse(p).success).toBe(false);
    expect(ornamentSchema.safeParse({ ...p, schemaVersion: 2 }).success).toBe(false);
    expect(validateBottom(createPreset(), defaultPrint)).toBeNull();
    expect(validateBottom(createPreset(), { ...defaultPrint, bottomSolidLayers: 50 })).toContain('krčku');
  });
});
