/// <reference lib="webworker" />
import { analyse } from '../analysis/report';
import { GeometryError } from '../geometry/mesh';
import { analysisHash, type AnalysisRequest, type AnalysisResponse } from './analysisProtocol';

const worker = self as unknown as DedicatedWorkerGlobalScope;
worker.onmessage = ({ data: request }: MessageEvent<AnalysisRequest>) => {
  const identity = { requestId: request.requestId, revision: request.revision, kind: 'analysis' as const, inputHash: request.inputHash };
  let response: AnalysisResponse;
  try {
    if (request.inputHash !== analysisHash(request.parameters, request.print)) throw new GeometryError('INVALID_REQUEST', 'Nesouhlasí hash vstupů analýzy.');
    response = { ...identity, status: 'ready', report: analyse(request.parameters, request.print, request.mesh) };
  } catch (error) {
    response = { ...identity, status: 'failed', error: { code: error instanceof GeometryError ? error.code : 'ANALYSIS_FAILED',
      message: error instanceof Error ? error.message : 'Analýza selhala.' } };
  }
  const transfer = response.status === 'ready' ? [response.report.colors.buffer, response.report.faceRisks.buffer, response.report.overhang.anglesDeg.buffer] : [];
  worker.postMessage(response, transfer);
};
