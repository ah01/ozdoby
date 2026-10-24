/// <reference lib="webworker" />
import { compute } from './compute';
import type { GeometryRequest } from './protocol';

const worker = self as unknown as DedicatedWorkerGlobalScope;
worker.onmessage = (event: MessageEvent<GeometryRequest>) => {
  const response = compute(event.data);
  // Fresh arrays belong exclusively to this job. The UI owns them after transfer;
  // no render-owned arrays are ever sent back to the worker.
  const transfer: Transferable[] = response.status === 'ready'
    ? [response.mesh.positions.buffer, response.mesh.indices.buffer, response.mesh.faceRegions.buffer] : [];
  if (response.status === 'ready' && response.stl) transfer.push(response.stl);
  if (response.status === 'ready' && response.render)
    transfer.push(response.render.positions.buffer, response.render.normals.buffer, response.render.colors.buffer);
  if (response.status === 'ready' && response.analysis?.status === 'ready') {
    const report = response.analysis.report;
    transfer.push(report.colors.buffer, report.faceRisks.buffer, report.overhang.anglesDeg.buffer);
  }
  worker.postMessage(response, transfer);
};
