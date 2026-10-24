import { expect, it, vi } from 'vitest';
import { defaultPrint } from '../src/domain/parameters';
import { createPreset } from '../src/domain/presets';
import { FaceRegion, generateMesh, type MeshData } from '../src/geometry/mesh';
import { analyseOverhang } from '../src/analysis/overhang';
import { analyseLayers, ornamentSurface, type AnalysisSurface } from '../src/analysis/layerSupport';
import { SegmentIndex } from '../src/analysis/segmentIndex';
import { analyse } from '../src/analysis/report';
import * as analysisModule from '../src/analysis/report';
import { defaultAnalysisOptions } from '../src/analysis/types';
import { analysisHash } from '../src/workers/analysisProtocol';
import { isCurrentResponse, requestHash } from '../src/workers/protocol';
import { compute } from '../src/workers/compute';

function cone(slope: number): { mesh: MeshData; surface: AnalysisSurface } {
  const count = 128, height = 10, base = 40, positions: number[] = [], indices: number[] = [], regions: number[] = [];
  for (const z of [0, height]) for (let i = 0; i < count; i++) {
    const r = base + slope * z, theta = i * 2 * Math.PI / count;
    positions.push(r * Math.cos(theta), r * Math.sin(theta), z);
  }
  positions.push(0, 0, 0, 0, 0, height);
  for (let i = 0; i < count; i++) {
    const j = (i + 1) % count;
    indices.push(i, j, i + count, j, j + count, i + count, 2 * count, j, i, 2 * count + 1, i + count, j + count);
    regions.push(FaceRegion.body, FaceRegion.body, FaceRegion.baseCap, FaceRegion.tipCap);
  }
  return { mesh: { positions: Float64Array.from(positions), indices: Uint32Array.from(indices), faceRegions: Uint8Array.from(regions) },
    surface: { heightMm: height, radius: (_theta, z) => base + slope * z, circular: true, angularSecondBound: base + Math.abs(slope * height),
      zSecondBound: 0, minimumAngles: count, knots: [] } };
}

it('a vertical cylinder has zero side overhang and its bed cap is exempt', () => {
  const { mesh, surface } = cone(0), normal = analyseOverhang(mesh, 45), layers = analyseLayers(surface, defaultPrint);
  expect(normal.maxAngleDeg).toBe(0); expect(normal.riskyAreaFraction).toBe(0);
  expect(layers.maxUpperDistanceMm).toBe(0); expect(layers.minLowerOverlap).toBe(1);
});

it('expanding and contracting cones separate normal overhang from bidirectional contour distance', () => {
  const expanding = cone(1), shrinking = cone(-3);
  expect(analyseOverhang(expanding.mesh, 40).maxAngleDeg).toBeCloseTo(45, 1);
  expect(analyseOverhang(expanding.mesh, 40).riskyAreaFraction).toBeCloseTo(1);
  expect(analyseOverhang(shrinking.mesh, 45).maxAngleDeg).toBe(0);
  const support = analyseLayers(shrinking.surface, defaultPrint);
  expect(support.maxUpperDistanceMm).toBeCloseTo(0.6, 10);
  expect(support.maxLowerDistanceMm).toBeCloseTo(0.6, 10);
  expect(support.bands.every(b => b.trend === 'contracting')).toBe(true);
  expect(support.bands.some(b => b.risk === 2)).toBe(true);
});

it('halving the layer improves cone overlap without changing the normal angle', () => {
  const { mesh, surface } = cone(1), full = analyseLayers(surface, defaultPrint);
  const half = analyseLayers(surface, { ...defaultPrint, layerHeightMm: 0.1 });
  expect(full.maxUpperDistanceMm).toBeCloseTo(0.2, 10); expect(half.maxUpperDistanceMm).toBeCloseTo(0.1, 10);
  expect(half.minUpperOverlap).toBeGreaterThan(full.minUpperOverlap);
  expect(analyseOverhang(mesh, 45).maxAngleDeg).toBeCloseTo(45, 1);
});

it('point-to-segment BVH agrees with brute force, including closest points between vertices', () => {
  const square = new SegmentIndex(Float64Array.from([-1, -1, 1, -1, 1, 1, -1, 1]));
  expect(square.distance(0, 0)).toBe(1); expect(square.distance(0, 2)).toBe(1);
  const xy = Float64Array.from(Array.from({ length: 180 }, (_, i) => {
    const theta = Math.floor(i / 2) * 2 * Math.PI / 90, r = 10 + 3 * Math.cos(theta * 7);
    return r * (i % 2 ? Math.sin(theta) : Math.cos(theta));
  }));
  const index = new SegmentIndex(xy);
  for (let i = 0; i < 80; i++) {
    const x = 14 * Math.cos(i * 1.73), y = 14 * Math.sin(i * 2.19);
    let brute = Infinity;
    for (let e = 0; e < 90; e++) {
      const a = 2 * e, b = 2 * ((e + 1) % 90), dx = xy[b]! - xy[a]!, dy = xy[b + 1]! - xy[a + 1]!;
      const t = Math.max(0, Math.min(1, ((x - xy[a]!) * dx + (y - xy[a + 1]!) * dy) / (dx * dx + dy * dy)));
      brute = Math.min(brute, Math.hypot(x - xy[a]! - t * dx, y - xy[a + 1]! - t * dy));
    }
    expect(index.distance(x, y, i)).toBeCloseTo(brute, 10);
  }
});

it('intermediate samples detect an excursion hidden between nominal layer boundaries', () => {
  const surface: AnalysisSurface = { heightMm: 1.05, radius: (_theta, z) => 10 + Math.sin((z - 0.05) * 2 * Math.PI), circular: true,
    angularSecondBound: 11, zSecondBound: (2 * Math.PI) ** 2, minimumAngles: 128, knots: [] };
  const report = analyseLayers(surface, { ...defaultPrint, firstLayerHeightMm: 0.05, layerHeightMm: 1, bottomSolidLayers: 1 });
  expect(report.maxUpperDistanceMm).toBeCloseTo(1, 8);
});

it('twisted ribs can worsen adjacent-contour support at the same amplitude', () => {
  const p = createPreset(); p.surface.amplitudeMm = 1;
  const straight = analyseLayers(ornamentSurface(p), defaultPrint);
  p.surface.twistDeg = 120;
  const twisted = analyseLayers(ornamentSurface(p), defaultPrint);
  expect(twisted.maxUpperDistanceMm).toBeGreaterThan(straight.maxUpperDistanceMm + 0.005);
  expect(twisted.maxLowerDistanceMm).toBeGreaterThan(straight.maxLowerDistanceMm + 0.005);
});

it('print width changes the report and hash but leaves mesh/STL bytes unchanged', () => {
  const p = createPreset(), mesh = generateMesh(p, 'preview'), positions = mesh.positions.slice();
  const a = analyse(p, defaultPrint, mesh), wider = { ...defaultPrint, extrusionWidthMm: 0.6 };
  const b = analyse(p, wider, mesh);
  expect(mesh.positions).toEqual(positions); expect(b.layers.minUpperOverlap).toBeGreaterThan(a.layers.minUpperOverlap);
  expect(a.overhang.maxAngleDeg).toBe(b.overhang.maxAngleDeg);
  expect(analysisHash(p, wider)).not.toBe(analysisHash(p, defaultPrint));
  expect(requestHash(p, 'mesh', wider)).toBe(requestHash(p, 'mesh', defaultPrint));
  const identity = { requestId: 1, revision: 0, kind: 'analysis' as const, inputHash: analysisHash(p, defaultPrint) };
  expect(isCurrentResponse(identity, { ...identity, inputHash: analysisHash(p, wider) })).toBe(false);
});

it('report metrics remain stable between preview and export resolution, with a separate open tip message', () => {
  const p = createPreset('round'); p.body.baseDiameterMm = 90; p.body.heightMm = 35;
  const preview = analyse(p, defaultPrint, generateMesh(p, 'preview'));
  const fine = analyse(p, defaultPrint, generateMesh(p));
  expect(Math.abs(preview.overhang.maxAngleDeg - fine.overhang.maxAngleDeg)).toBeLessThan(1);
  expect(Math.abs(preview.overhang.riskyAreaFraction - fine.overhang.riskyAreaFraction)).toBeLessThan(0.025);
  expect(preview.layers.maxUpperDistanceMm).toBe(fine.layers.maxUpperDistanceMm);
  expect(fine.messages.some(m => m.code === 'OPEN_TIP')).toBe(true); expect(fine.risk).toBe('high');
  expect(fine.faceRisks).toHaveLength(generateMesh(p).indices.length / 3);
});

it('analysis limits fail explicitly; a valid final STL survives an unfinished analysis', () => {
  const p = createPreset(); p.surface.amplitudeMm = 1;
  expect(() => analyse(p, defaultPrint, generateMesh(p, 'preview'), { ...defaultAnalysisOptions, maxDistanceQueries: 1 })).toThrow('limit');
  p.body.heightMm = 140;
  const print = { ...defaultPrint, layerHeightMm: 0.05 };
  const failure = vi.spyOn(analysisModule, 'analyse').mockImplementationOnce(() => { throw new Error('Analýza překročila limit vzorkování.'); });
  const response = compute({ requestId: 1, revision: 0, kind: 'stl', inputHash: requestHash(p, 'stl', print), parameters: p, print });
  failure.mockRestore();
  expect(response.status).toBe('ready');
  if (response.status === 'ready') { expect(response.stl?.byteLength).toBeGreaterThan(84); expect(response.analysis?.status).toBe('failed'); }
});
