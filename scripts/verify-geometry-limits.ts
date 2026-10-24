import { writeFileSync } from 'node:fs';
import { denseParameters } from '../tests/helpers/dense-parameters';
import { compute } from '../src/workers/compute';
import { requestHash } from '../src/workers/protocol';
import { defaultAnalysisOptions } from '../src/analysis/types';
import { PREVIEW_TRIANGLE_LIMIT, EXPORT_TRIANGLE_LIMIT } from '../src/domain/stlDetail';

const parameters = denseParameters();
function probe(kind: 'mesh' | 'stl') {
  globalThis.gc?.();
  const start = performance.now(), stlDetail = 'coarse' as const;
  const response = compute({ requestId: kind === 'mesh' ? 1 : 2, revision: 0, kind, parameters, stlDetail,
    inputHash: requestHash(parameters, kind, undefined, stlDetail) });
  if (response.status !== 'ready' || !response.validation.valid) throw new Error(JSON.stringify(response));
  if (kind === 'stl' && (!response.stl || response.analysis?.status !== 'ready')) throw new Error('Expected valid STL and completed analysis');
  const result = { kind, triangles: response.validation.triangles, sampling: { ...response.mesh.sampling, heights: response.mesh.sampling.heights.length },
    stlBytes: response.stl?.byteLength, analysisStatus: response.analysis?.status,
    distanceQueries: response.analysis?.status === 'ready' ? response.analysis.report.layers.distanceQueries : undefined,
    durationMs: performance.now() - start };
  console.log(`${kind}: ${result.triangles} triangles, ${Math.round(result.durationMs)} ms`);
  return result;
}
const probes = [probe('mesh'), probe('stl')];
const report = { measuredAt: new Date().toISOString(), node: process.version, platform: process.platform, parameters,
  previewTriangleLimit: PREVIEW_TRIANGLE_LIMIT, exportTriangleLimit: EXPORT_TRIANGLE_LIMIT,
  analysisDistanceQueryLimit: defaultAnalysisOptions.maxDistanceQueries, maxRssMiB: process.resourceUsage().maxRSS / 1024,
  methodology: 'Single compute() calls, including preview render buffers or coarse STL/final analysis. Cumulative Node RSS, not browser memory or warmed p95.', probes };
writeFileSync('doc/verification/geometry-limits.json', `${JSON.stringify(report, null, 2)}\n`);
