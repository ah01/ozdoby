import { expect, it } from 'vitest';
import { defaultPrint, ornamentSchema } from '../src/domain/parameters';
import { createPreset } from '../src/domain/presets';
import { generateMesh } from '../src/geometry/mesh';
import { validateMesh } from '../src/geometry/validate';
import { surfacePoint } from '../src/geometry/surface';
import { encodeStl } from '../src/io/stl';
import { readStl } from './helpers/read-stl';
import { denseParameters } from './helpers/dense-parameters';
import { analyseLayers, ornamentSurface } from '../src/analysis/layerSupport';
import { PREVIEW_TRIANGLE_LIMIT } from '../src/domain/stlDetail';

it('accepts a 5 mm neck through validation and actual float32 STL, but refuses smaller values', () => {
  const p = createPreset('egg'); p.neck.diameterMm = 5;
  p.surface.amplitudeMm = 0.5; p.surface.waveAmplitudeMm = 0.3;
  const mesh = generateMesh(p);
  expect(ornamentSchema.safeParse(p).success).toBe(true);
  const decoded = readStl(encodeStl(mesh));
  expect(validateMesh(decoded).issues).toEqual([]);
  for (let i = 0; i < decoded.positions.length; i += 3) if (decoded.positions[i + 2] === 0)
    expect(Math.hypot(decoded.positions[i]!, decoded.positions[i + 1]!)).toBeLessThanOrEqual(2.500001);
  p.neck.diameterMm = 4.9; expect(ornamentSchema.safeParse(p).success).toBe(false);
});

it('plans a formerly refused dense preview within the unchanged spatial tolerance', () => {
  const p = denseParameters(), mesh = generateMesh(p, 'preview');
  const { angles, heights, errorBoundMm } = mesh.sampling;
  expect(mesh.sampling.strategy).toBe('local');
  expect(mesh.sampling.toleranceMm).toBe(0.2);
  expect(mesh.indices.length / 3).toBeGreaterThan(600_000);
  expect(mesh.indices.length / 3).toBeLessThanOrEqual(PREVIEW_TRIANGLE_LIMIT);
  expect(validateMesh(mesh).issues).toEqual([]);
  for (let j = 0; j < heights.length - 1; j += Math.max(1, Math.floor(heights.length / 25)))
    for (let i = 0; i < angles; i += Math.max(1, Math.floor(angles / 25)))
      for (const [s, t] of [[0.2, 0.3], [0.8, 0.7]]) {
        const a = j * angles + i, b = j * angles + (i + 1) % angles, c = a + angles, d = b + angles;
        const corners = s! + t! <= 1 ? [a, b, c] : [d, c, b], weights = s! + t! <= 1 ? [1 - s! - t!, s!, t!] : [s! + t! - 1, 1 - s!, 1 - t!];
        const point = surfacePoint(p, (i + s!) * 2 * Math.PI / angles, heights[j]! + t! * (heights[j + 1]! - heights[j]!));
        const approximation = [0, 1, 2].map(axis => corners.reduce((sum, v, k) => sum + weights[k]! * mesh.positions[v * 3 + axis]!, 0));
        expect(Math.hypot(...point.map((v, k) => v - approximation[k]!))).toBeLessThanOrEqual(errorBoundMm + 1e-10);
      }
  expect(errorBoundMm + 0.0001).toBeLessThanOrEqual(0.2);
  const stl = encodeStl(generateMesh(p, 'export', 'coarse'));
  expect(new DataView(stl).getUint32(80, true)).toBeLessThanOrEqual(2_000_000);
}, 30_000);

it('finishes dense rib/wave/twist analysis beyond the old query budget', () => {
  const report = analyseLayers(ornamentSurface(denseParameters()), defaultPrint);
  expect(report.distanceQueries).toBeGreaterThan(3_000_000);
  expect(report.distanceQueries).toBeLessThanOrEqual(12_000_000);
  expect(report.bands.length).toBeGreaterThan(600);
  expect(Number.isFinite(report.maxUpperDistanceMm)).toBe(true);
}, 45_000);
