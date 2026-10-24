import { expect, it } from 'vitest';
import { createPreset } from '../src/domain/presets';
import { defaultPrint, ornamentSchema } from '../src/domain/parameters';
import { ribDerivatives, ribValue } from '../src/domain/shapeMath';
import { generateMesh } from '../src/geometry/mesh';
import { derivativeBounds, surfaceKnots } from '../src/geometry/surfaceBounds';
import { localDerivativeBounds } from '../src/geometry/localBounds';
import { horizontalWave, surfacePoint, surfaceRadius } from '../src/geometry/surface';
import { validateMesh } from '../src/geometry/validate';
import { analyseLayers, ornamentSurface } from '../src/analysis/layerSupport';
import { readStl } from './helpers/read-stl';
import { encodeStl } from '../src/io/stl';

it('rib shapes retain their depth, change peak width and have correct analytic curvature derivatives', () => {
  const p = createPreset(), step = 1e-4;
  for (const shape of ['rounded', 'narrow', 'broad'] as const) {
    p.surface.ribShape = shape;
    expect(ribValue(p, 0)).toBe(1); expect(ribValue(p, Math.PI)).toBe(-1);
    const [first, second] = ribDerivatives(p, 0.8);
    expect(first).toBeCloseTo((ribValue(p, 0.8 + step) - ribValue(p, 0.8 - step)) / (2 * step), 6);
    expect(second).toBeCloseTo((ribValue(p, 0.8 + step) - 2 * ribValue(p, 0.8) + ribValue(p, 0.8 - step)) / step ** 2, 6);
  }
  p.surface.ribShape = 'narrow'; expect(ribValue(p, Math.PI / 2)).toBeCloseTo(-0.45);
  p.surface.ribShape = 'broad'; expect(ribValue(p, Math.PI / 2)).toBeCloseTo(0.45);
});

it('rotation moves rib peaks without changing their period or the protected neck', () => {
  const p = createPreset(); p.surface.amplitudeMm = 1; p.surface.ribRotationDeg = 15;
  const z = 52, theta = 15 * Math.PI / 180;
  expect(surfaceRadius(p, theta, z) - surfaceRadius(p, theta + Math.PI / p.surface.ribs, z)).toBeCloseTo(2, 12);
  expect(surfaceRadius(p, theta, z)).toBeCloseTo(surfaceRadius(p, theta + 2 * Math.PI / p.surface.ribs, z), 12);
  for (const z of [0, 4, 8]) expect(surfaceRadius(p, theta, z)).toBe(7);
  p.surface.ribRotationDeg = 0; const original = surfaceRadius(p, 0.4, z);
  p.surface.ribRotationDeg = 360; expect(surfaceRadius(p, 0.4, z)).toBe(original);
});

it('horizontal waves work without ribs, shift by a fraction of a cycle and keep both interfaces', () => {
  const p = createPreset(); p.surface.waveAmplitudeMm = 0.8; p.surface.waveCount = 4;
  const z = p.neck.lengthMm + p.body.heightMm / 2;
  const originalWave = horizontalWave(p, z + 1), originalKnots = surfaceKnots(p);
  p.surface.waveShiftPercent = 100;
  expect(horizontalWave(p, z + 1)).toBe(originalWave); expect(surfaceKnots(p)).toEqual(originalKnots);
  p.surface.waveShiftPercent = 0;
  expect(horizontalWave(p, z)).toBeCloseTo(0, 12);
  p.surface.waveShiftPercent = 25; expect(horizontalWave(p, z)).toBeCloseTo(0.8, 12);
  expect(surfaceRadius(p, 0, z)).toBe(surfaceRadius(p, 1, z));
  expect(horizontalWave(p, 0)).toBe(0); expect(horizontalWave(p, 8)).toBe(0); expect(horizontalWave(p, 96)).toBe(0);
  expect(surfaceKnots(p)).toContain(z);
  const surface = ornamentSurface(p); expect(surface.circular).toBe(true);
  const report = analyseLayers(surface, defaultPrint);
  const neutral = createPreset();
  expect(report.maxUpperDistanceMm).toBeGreaterThan(analyseLayers(ornamentSurface(neutral), defaultPrint).maxUpperDistanceMm);
  expect(validateMesh(readStl(encodeStl(generateMesh(p)))).valid).toBe(true);
});

it('disabled transforms leave STL unchanged and combined depths cannot cross the axis', () => {
  const p = createPreset(), baseline = encodeStl(generateMesh(p));
  Object.assign(p.surface, { ribShape: 'broad', ribRotationDeg: 83, waveCount: 12, waveShiftPercent: 51 });
  expect(encodeStl(generateMesh(p))).toEqual(baseline);
  p.surface.amplitudeMm = 4; p.surface.waveAmplitudeMm = 2; p.body.tipRadiusMm = 0.8;
  const result = ornamentSchema.safeParse(p);
  expect(result.success).toBe(false);
  if (!result.success) expect(result.error.issues.map(issue => issue.path.join('.'))).toEqual(expect.arrayContaining(['surface.amplitudeMm', 'surface.waveAmplitudeMm']));
});

const combinations = (['egg', 'diamond'] as const).flatMap(shape => (['rounded', 'narrow', 'broad'] as const).flatMap(ribShape =>
  (['smooth', 'linear', 'reverse'] as const).map(twistProfile => ({ shape, ribShape, twistProfile }))));
it.each(combinations)('$shape/$ribShape/$twistProfile bounds the combined surface in space and after interpolation', modes => {
  const p = createPreset(modes.shape);
  Object.assign(p.surface, { amplitudeMm: 0.6, ribs: 7, ribRotationDeg: 17, ribShape: modes.ribShape, twistProfile: modes.twistProfile,
    twistDeg: -60, amplitudeProfile: 'middle', waveAmplitudeMm: 0.4, waveCount: 5, waveShiftPercent: 31 });
  const mesh = generateMesh(p), { angles, heights, errorBoundMm } = mesh.sampling;
  expect(validateMesh(mesh).issues).toEqual([]);
  expect(errorBoundMm + 0.0001).toBeLessThanOrEqual(0.05);
  for (let j = 0; j < heights.length - 1; j += Math.max(1, Math.floor(heights.length / 12)))
    for (let i = 0; i < angles; i += Math.max(1, Math.floor(angles / 12)))
      for (const [s, t] of [[0.2, 0.3], [0.8, 0.7]]) {
        const a = j * angles + i, b = j * angles + (i + 1) % angles, c = a + angles, d = b + angles;
        const corners = s! + t! <= 1 ? [a, b, c] : [d, c, b], weights = s! + t! <= 1 ? [1 - s! - t!, s!, t!] : [s! + t! - 1, 1 - s!, 1 - t!];
        const point = surfacePoint(p, (i + s!) * 2 * Math.PI / angles, heights[j]! + t! * (heights[j + 1]! - heights[j]!));
        const approximation = [0, 1, 2].map(axis => corners.reduce((sum, v, k) => sum + weights[k]! * mesh.positions[v * 3 + axis]!, 0));
        expect(Math.hypot(...point.map((v, k) => v - approximation[k]!))).toBeLessThanOrEqual(errorBoundMm + 1e-10);
      }
  const knots = surfaceKnots(p), step = 0.0002;
  for (let j = 1; j < knots.length; j++) {
    const z = (knots[j - 1]! + knots[j]!) / 2;
    if (knots[j]! - knots[j - 1]! < 4 * step) continue;
    for (const bounds of [derivativeBounds, localDerivativeBounds]) {
      const [tt, tz, zz] = bounds(p, knots[j - 1]!, knots[j]!);
      for (const theta of [0.3, 1.2, 2.4]) {
        const point = surfacePoint(p, theta, z), left = surfacePoint(p, theta - step, z), right = surfacePoint(p, theta + step, z);
        const low = surfacePoint(p, theta, z - step), high = surfacePoint(p, theta, z + step);
        const ll = surfacePoint(p, theta - step, z - step), lh = surfacePoint(p, theta - step, z + step);
        const rl = surfacePoint(p, theta + step, z - step), rh = surfacePoint(p, theta + step, z + step);
        expect(Math.hypot(...point.map((v, axis) => (right[axis]! - 2 * v + left[axis]!) / step ** 2))).toBeLessThanOrEqual(tt + 1e-5);
        expect(Math.hypot(...point.map((v, axis) => (high[axis]! - 2 * v + low[axis]!) / step ** 2))).toBeLessThanOrEqual(zz + 1e-5);
        expect(Math.hypot(...point.map((_, axis) => (rh[axis]! - rl[axis]! - lh[axis]! + ll[axis]!) / (4 * step ** 2)))).toBeLessThanOrEqual(tz + 1e-5);
      }
    }
  }
});
