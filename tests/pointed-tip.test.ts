import { expect, it } from 'vitest';
import { defaultPrint, ornamentSchema } from '../src/domain/parameters';
import { createPreset } from '../src/domain/presets';
import { FaceRegion, generateMesh } from '../src/geometry/mesh';
import { validateMesh } from '../src/geometry/validate';
import { surfacePoint } from '../src/geometry/surface';
import { encodeStl } from '../src/io/stl';
import { readStl } from './helpers/read-stl';
import { createRenderData } from '../src/features/preview/renderData';
import { analyse } from '../src/analysis/report';

it.each(['round', 'elongated', 'drop', 'egg', 'diamond'] as const)('%s closes zero radius at one manifold apex and supports smaller disks', shape => {
  const p = createPreset(shape);
  for (const radius of [0, 0.01, 0.1]) {
    p.body.tipRadiusMm = radius;
    expect(ornamentSchema.safeParse(p).success).toBe(true);
    const mesh = generateMesh(p), checked = validateMesh(mesh);
    expect(checked.issues).toEqual([]); expect(checked.euler).toBe(2);
    expect(checked.bounds.size).toEqual([56, 56, p.neck.lengthMm + p.body.heightMm]);
    const tipVertices = Array.from({ length: mesh.positions.length / 3 }, (_, i) => i)
      .filter(i => mesh.positions[i * 3 + 2] === p.neck.lengthMm + p.body.heightMm);
    expect(tipVertices.length).toBe(radius === 0 ? 1 : mesh.sampling.angles + 1);
    expect(mesh.faceRegions.some(region => region === FaceRegion.tipCap)).toBe(radius > 0);
    expect(validateMesh(readStl(encodeStl(mesh))).issues).toEqual([]);
  }
});

it.each(['round', 'elongated', 'drop', 'egg', 'diamond'] as const)('%s preserves interpolation precision all the way to its deformed point', shape => {
  const p = createPreset(shape); p.body.tipRadiusMm = 0;
  Object.assign(p.surface, { amplitudeMm: 0.5, waveAmplitudeMm: 0.2, ribs: 8, twistDeg: 60 });
  const mesh = generateMesh(p), { heights, angles, errorBoundMm } = mesh.sampling;
  expect(validateMesh(mesh).issues).toEqual([]);
  const top = mesh.positions.length / 3 - 1;
  const slabs = [...new Set([...Array.from({ length: heights.length - 1 }, (_, i) => i)
    .filter(i => i % Math.max(1, Math.floor(heights.length / 12)) === 0), heights.length - 2])];
  for (const j of slabs) for (let i = 0; i < angles; i += Math.max(1, Math.floor(angles / 12)))
    for (const [s, t] of [[0.2, 0.3], [0.8, 0.7]]) {
      const a = j * angles + i, b = j * angles + (i + 1) % angles;
      const c = j === heights.length - 2 ? top : a + angles, d = j === heights.length - 2 ? top : b + angles;
      const corners = s! + t! <= 1 ? [a, b, c] : [d, c, b], weights = s! + t! <= 1 ? [1 - s! - t!, s!, t!] : [s! + t! - 1, 1 - s!, 1 - t!];
      const point = surfacePoint(p, (i + s!) * 2 * Math.PI / angles, heights[j]! + t! * (heights[j + 1]! - heights[j]!));
      const approximation = [0, 1, 2].map(axis => corners.reduce((sum, v, k) => sum + weights[k]! * mesh.positions[v * 3 + axis]!, 0));
      expect(Math.hypot(...point.map((v, k) => v - approximation[k]!))).toBeLessThanOrEqual(errorBoundMm + 1e-10);
    }
  expect(errorBoundMm + 0.0001).toBeLessThanOrEqual(0.05);
  expect(validateMesh(readStl(encodeStl(mesh))).valid).toBe(true);
});

it('merges a numerically unusable final wave ring without losing a vertex or precision', () => {
  const p = createPreset(); p.body.tipRadiusMm = 0;
  Object.assign(p.surface, { amplitudeMm: 0.5, waveAmplitudeMm: 0.2, waveShiftPercent: 0.001 });
  const mesh = generateMesh(p), render = createRenderData(mesh);
  expect(validateMesh(readStl(encodeStl(mesh))).issues).toEqual([]);
  expect(mesh.sampling.errorBoundMm + 0.0001).toBeLessThanOrEqual(0.05);
  let maxNormalError = 0;
  for (let i = 0; i < render.normals.length; i += 3)
    maxNormalError = Math.max(maxNormalError, Math.abs(Math.hypot(render.normals[i]!, render.normals[i + 1]!, render.normals[i + 2]!) - 1));
  expect(maxNormalError).toBeLessThan(1e-6);
});

it('analyses a point contour explicitly and rejects an axis-crossing deformation', () => {
  const p = createPreset('egg'); p.body.tipRadiusMm = 0;
  p.surface.amplitudeMm = 0.5; p.surface.waveAmplitudeMm = 0.2;
  const report = analyse(p, defaultPrint, generateMesh(p, 'preview'));
  expect(report.tip.diameterMm).toBe(0); expect(report.tip.risk).toBe(2);
  expect(report.messages.find(message => message.code === 'OPEN_TIP')?.detail).toContain('jediném vrcholu');
  expect(Number.isFinite(report.layers.maxUpperDistanceMm)).toBe(true);
  Object.assign(p.body, { baseDiameterMm: 30, heightMm: 140 });
  Object.assign(p.surface, { amplitudeMm: 4, waveAmplitudeMm: 2, blendLengthMm: 4 });
  expect(ornamentSchema.safeParse(p).success).toBe(false);
  p.body.tipRadiusMm = -0.01; expect(ornamentSchema.safeParse(p).success).toBe(false);
});
