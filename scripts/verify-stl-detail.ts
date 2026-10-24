import { writeFileSync } from 'node:fs';
import { createPreset } from '../src/domain/presets';
import { EXPORT_TRIANGLE_LIMIT, stlDetails, type StlDetail } from '../src/domain/stlDetail';
import { compute } from '../src/workers/compute';
import { requestHash } from '../src/workers/protocol';

// Single-run capacity probes, not warmed p95 performance acceptance.
const ribbed = createPreset('elongated');
ribbed.body.baseDiameterMm = 50; ribbed.body.heightMm = 101;
ribbed.surface.ribs = 17; ribbed.surface.amplitudeMm = 1.8; ribbed.surface.twistDeg = 120;
const large = createPreset('elongated');
large.body.baseDiameterMm = 100; large.body.heightMm = 140; large.body.tipRadiusMm = 3;
large.surface.ribs = 24; large.surface.amplitudeMm = 3; large.surface.twistDeg = 180; large.surface.blendLengthMm = 20;
const cases = [
  ...Object.keys(stlDetails).map(detail => ({ name: 'ribbed', parameters: ribbed, detail: detail as StlDetail })),
  { name: 'near-limit', parameters: large, detail: 'standard' as const },
];
const probes = cases.map(({ name, parameters, detail }, index) => {
  globalThis.gc?.();
  const start = performance.now();
  const response = compute({ requestId: index + 1, revision: 0, kind: 'stl', parameters, stlDetail: detail,
    inputHash: requestHash(parameters, 'stl', undefined, detail) });
  if (response.status !== 'ready' || !response.stl || !response.validation.valid)
    throw new Error(`${name}/${detail}: ${response.status === 'failed' ? response.error.message : 'missing STL'}`);
  if (response.validation.triangles > EXPORT_TRIANGLE_LIMIT || response.mesh.sampling.errorBoundMm + 0.0001 > stlDetails[detail].toleranceMm)
    throw new Error('Capacity or tolerance contract exceeded');
  const result = { name, parameters, detail, toleranceMm: response.mesh.sampling.toleranceMm,
    errorBoundMm: response.mesh.sampling.errorBoundMm, triangles: response.validation.triangles,
    stlBytes: response.stl.byteLength, valid: response.validation.valid, durationMs: performance.now() - start,
    analysisStatus: response.analysis?.status };
  console.log(`${name}/${detail}: ${result.triangles} triangles, ${Math.round(result.durationMs)} ms, analysis ${result.analysisStatus}`);
  return result;
});
const report = { measuredAt: new Date().toISOString(), node: process.version, platform: process.platform,
  methodology: 'Single compute() calls including topology, float32 STL validation/encoding and final analysis. Not warmed p95; peak RSS is cumulative for this Node process, not browser memory.',
  exportTriangleLimit: EXPORT_TRIANGLE_LIMIT, maxRssMiB: process.resourceUsage().maxRSS / 1024, probes };
writeFileSync('doc/verification/stl-detail-capacity.json', `${JSON.stringify(report, null, 2)}\n`);
