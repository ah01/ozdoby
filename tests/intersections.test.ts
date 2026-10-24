import { expect, it } from 'vitest';
import { createPreset } from '../src/domain/presets';
import { generateMesh, type MeshData } from '../src/geometry/mesh';
import { hasNonIncidentIntersection } from './helpers/intersections';

it('independently audits full export meshes of all presets and phase-0 wide fixture', () => {
  const wide = createPreset('round'); wide.body.baseDiameterMm = 90; wide.body.heightMm = 35;
  const transformed = createPreset('diamond');
  Object.assign(transformed.surface, { amplitudeMm: 0.7, ribs: 8, twistDeg: 60, amplitudeProfile: 'middle', twistProfile: 'reverse' });
  for (const p of [createPreset(), createPreset('round'), createPreset('drop'), createPreset('egg'), createPreset('diamond'), transformed, wide])
    expect(hasNonIncidentIntersection(generateMesh(p))).toBe(false);
}, 60_000);

it('the independent oracle detects crossing and coplanar triangles and allows legitimate incidence', () => {
  const mesh: MeshData = { positions: Float64Array.from([-2, -1, 0, 2, -1, 0, 0, 2, 0, 0, 0, -1, 0, 0, 1, 3, 0, 0]),
    indices: Uint32Array.from([0, 1, 2, 3, 4, 5]), faceRegions: new Uint8Array(2) };
  expect(hasNonIncidentIntersection(mesh)).toBe(true);
  mesh.positions.set([-1, 0, 0, 1, 0, 0, 0, -2, 0], 9);
  expect(hasNonIncidentIntersection(mesh)).toBe(true);
  mesh.positions.set([10, 0, 0, 12, 0, 0, 10, 2, 0], 9);
  expect(hasNonIncidentIntersection(mesh)).toBe(false);
  mesh.indices.set([0, 1, 3], 3);
  expect(hasNonIncidentIntersection(mesh)).toBe(false);
});
