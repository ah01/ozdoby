import { expect, it } from 'vitest';
import { createPreset } from '../src/domain/presets';
import { defaultPrint, ornamentSchema } from '../src/domain/parameters';
import { profileRadius } from '../src/geometry/profile';
import { surfaceAmplitude, surfacePoint, surfaceRadius, surfaceTwist } from '../src/geometry/surface';
import { generateMesh } from '../src/geometry/mesh';
import { validateMesh } from '../src/geometry/validate';
import { encodeStl } from '../src/io/stl';
import { parseSettings, serializeSettings } from '../src/io/preset';
import { readStl } from './helpers/read-stl';
import { ornamentSurface } from '../src/analysis/layerSupport';
import { analyse } from '../src/analysis/report';

it.each(['egg', 'diamond'] as const)('%s has a distinct monotone profile and a valid float32 STL', shape => {
  const p = createPreset(shape), n = p.neck.lengthMm, h = p.body.heightMm, peak = p.body.maxRadiusAt;
  const baseline = { ...p, shape: 'elongated' as const };
  expect(profileRadius(p, n + h * peak / 4)).not.toBeCloseTo(profileRadius(baseline, n + h * peak / 4), 4);
  const lower = Array.from({ length: 101 }, (_, i) => profileRadius(p, n + h * peak * i / 100));
  const upper = Array.from({ length: 101 }, (_, i) => profileRadius(p, n + h * (peak + (1 - peak) * i / 100)));
  expect(lower.every((r, i) => !i || r >= lower[i - 1]!)).toBe(true);
  expect(upper.every((r, i) => !i || r <= upper[i - 1]!)).toBe(true);
  const result = validateMesh(readStl(encodeStl(generateMesh(p))));
  expect(result.issues).toEqual([]); expect(result.bounds.size).toEqual([56, 56, n + h]);
  const report = analyse(p, defaultPrint, generateMesh(p, 'preview'));
  expect(report.algorithmVersion).toBe('1.4.0'); expect(report.layers.bands.length).toBeGreaterThan(100);
});

it('preserves the straight middle of diamond sides with rounded shoulder and maximum', () => {
  const p = createPreset('diamond'), length = p.body.heightMm * p.body.maxRadiusAt;
  const radius = (t: number) => profileRadius(p, p.neck.lengthMm + t * length);
  expect(radius(0.6) - radius(0.4)).toBeCloseTo(radius(0.4) - radius(0.2), 12);
  const epsilon = 1e-6;
  expect((radius(epsilon) - radius(0)) / (epsilon * length)).toBeLessThan(1e-6);
  expect((radius(1) - radius(1 - epsilon)) / (epsilon * length)).toBeLessThan(1e-6);
});

it('redistributes ribs and reverses twist while preserving neck, tip and zero-amplitude geometry', () => {
  const p = createPreset('egg'), n = p.neck.lengthMm, h = p.body.heightMm;
  p.surface.amplitudeMm = 1; p.surface.twistDeg = 90;
  const original = surfaceAmplitude(p, n + h / 4);
  p.surface.amplitudeProfile = 'middle';
  expect(surfaceAmplitude(p, n + h / 4)).toBeCloseTo(original * 0.75, 12);
  expect(surfaceAmplitude(p, n + h / 2)).toBeCloseTo(1, 12);
  p.surface.amplitudeProfile = 'neck';
  expect(surfaceAmplitude(p, n + h / 4)).toBeGreaterThan(surfaceAmplitude(p, n + 3 * h / 4));
  p.surface.twistProfile = 'reverse';
  expect(surfaceTwist(p, n)).toBe(0); expect(surfaceTwist(p, n + h / 2)).toBeCloseTo(Math.PI / 2, 12);
  expect(surfaceTwist(p, n + h)).toBe(0);
  for (const z of [0, n / 2, n]) for (const theta of [0, 1, 2]) expect(surfaceRadius(p, theta, z)).toBe(7);
  expect(surfaceRadius(p, 1, n + h)).toBeCloseTo(p.body.tipRadiusMm, 12);
  p.surface.amplitudeMm = 0;
  const a = generateMesh(p, 'preview'); p.surface.twistProfile = 'linear'; p.surface.amplitudeProfile = 'uniform';
  const b = generateMesh(p, 'preview');
  expect(b.positions).toEqual(a.positions); expect(b.indices).toEqual(a.indices);
});

const combinations = (['egg', 'diamond'] as const).flatMap(shape =>
  (['uniform', 'middle', 'neck'] as const).flatMap(amplitudeProfile =>
    (['smooth', 'linear', 'reverse'] as const).map(twistProfile => ({ shape, amplitudeProfile, twistProfile }))));
it.each(combinations)('$shape/$amplitudeProfile/$twistProfile stays within its interpolation and analysis bounds', modes => {
  const p = createPreset(modes.shape);
  Object.assign(p.surface, { amplitudeProfile: modes.amplitudeProfile, twistProfile: modes.twistProfile, amplitudeMm: 0.7, ribs: 8, twistDeg: -60 });
  const mesh = generateMesh(p), { angles, heights, errorBoundMm } = mesh.sampling;
  expect(validateMesh(mesh).issues).toEqual([]);
  expect(errorBoundMm + 0.0001).toBeLessThanOrEqual(0.05);
  for (let j = 0; j < heights.length - 1; j += Math.max(1, Math.floor(heights.length / 12)))
    for (let i = 0; i < angles; i += Math.max(1, Math.floor(angles / 12)))
      for (const [s, t] of [[0.2, 0.3], [0.8, 0.7]]) {
        const next = (i + 1) % angles, a = j * angles + i, b = j * angles + next, c = a + angles, d = b + angles;
        const corners = s! + t! <= 1 ? [a, b, c] : [d, c, b];
        const weights = s! + t! <= 1 ? [1 - s! - t!, s!, t!] : [s! + t! - 1, 1 - s!, 1 - t!];
        const exact = surfacePoint(p, (i + s!) * 2 * Math.PI / angles, heights[j]! + t! * (heights[j + 1]! - heights[j]!));
        const interpolated = [0, 1, 2].map(axis => corners.reduce((sum, corner, k) => sum + weights[k]! * mesh.positions[corner * 3 + axis]!, 0));
        expect(Math.hypot(...exact.map((v, k) => v - interpolated[k]!))).toBeLessThanOrEqual(errorBoundMm + 1e-10);
      }
  const surface = ornamentSurface(p), step = 0.0005;
  for (let z = p.neck.lengthMm + 1; z < surface.heightMm - 1; z += 0.73) {
    if (surface.knots.some(knot => Math.abs(z - knot) < 2 * step)) continue;
    const theta = 1.1;
    const second = Math.abs((surface.radius(theta, z + step) - 2 * surface.radius(theta, z) + surface.radius(theta, z - step)) / step ** 2);
    expect(second).toBeLessThanOrEqual(surface.zSecondBound + 1e-6);
  }
});

it('loads legacy settings with neutral defaults and round-trips new choices strictly', () => {
  const legacy = JSON.parse(JSON.stringify(createPreset()));
  for (const id of ['amplitudeProfile', 'twistProfile', 'ribShape', 'ribRotationDeg', 'waveAmplitudeMm', 'waveCount', 'waveShiftPercent']) delete legacy.surface[id];
  const restored = parseSettings(JSON.stringify({ schemaVersion: 1, generatorVersion: '0.1.0', parameters: legacy, print: defaultPrint }));
  expect(restored.parameters).toEqual(createPreset());
  expect(encodeStl(generateMesh(restored.parameters))).toEqual(encodeStl(generateMesh(createPreset())));
  const p = createPreset('diamond'); p.surface.amplitudeProfile = 'neck'; p.surface.twistProfile = 'reverse';
  const saved = { ...restored, parameters: p };
  expect(parseSettings(serializeSettings(saved))).toEqual(saved);
  expect(ornamentSchema.safeParse({ ...p, surface: { ...p.surface, twistProfile: 'unknown' } }).success).toBe(false);
});
