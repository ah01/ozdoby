import { useEffect, useRef, useState } from 'react';
import type { OrnamentParameters, PrintAssumptions } from '../domain/parameters';
import { analysisHash, type AnalysisRequest, type AnalysisResponse } from '../workers/analysisProtocol';
import { isCurrentResponse } from '../workers/protocol';
import type { ReadyGeometry } from './useGeometry';

export function useAnalysis(parameters: OrnamentParameters, print: PrintAssumptions, geometry: ReadyGeometry | null, revision: number, valid: boolean) {
  const [response, setResponse] = useState<AnalysisResponse | null>(null), serial = useRef(0);
  const inputHash = analysisHash(parameters, print);
  useEffect(() => {
    if (!valid || !geometry) return;
    let active = true, worker: Worker | undefined;
    const request: AnalysisRequest = { requestId: ++serial.current, revision, kind: 'analysis', inputHash, parameters, print, mesh: geometry.mesh };
    const fail = (message: string) => { if (active) setResponse({ ...request, status: 'failed', error: { code: 'ANALYSIS_FAILED', message } }); };
    const timer = setTimeout(() => {
      try {
        worker = new Worker(new URL('../workers/analysis.worker.ts', import.meta.url), { type: 'module' });
        worker.onmessage = ({ data }: MessageEvent<AnalysisResponse>) => {
          if (active && isCurrentResponse(data, request)) setResponse(data);
          worker?.terminate();
        };
        worker.onerror = () => { fail('Analýza selhala. Geometricky validní STL můžete stáhnout; export zkusí finální analýzu znovu.'); worker?.terminate(); };
        // Structured clone deliberately copies the canonical mesh. Never transfer
        // buffers still owned by the preview. Print changes cannot mutate the mesh.
        worker.postMessage(request);
      } catch { fail('Analytický worker není dostupný. Výsledek je nevyhodnocený.'); }
    }, 100);
    return () => { active = false; clearTimeout(timer); worker?.terminate(); };
  }, [parameters, print, geometry, revision, valid, inputHash]);
  const current = valid && !!geometry && response?.revision === revision && response.inputHash === inputHash ? response : null;
  return { inputHash, current, report: current?.status === 'ready' ? current.report : null,
    status: !valid ? 'invalid' as const : current?.status ?? 'pending', error: current?.status === 'failed' ? current.error.message : '' };
}
