import { useEffect, useState } from 'react';
import type { OrnamentParameters } from '../domain/parameters';
import { isCurrentResponse, requestHash, type GeometryRequest, type GeometryResponse } from '../workers/protocol';

export type ReadyGeometry = Extract<GeometryResponse, { status: 'ready' }>;
export function useGeometry(parameters: OrnamentParameters, revision: number, valid: boolean) {
  const [last, setLast] = useState<ReadyGeometry | null>(null);
  const [failure, setFailure] = useState<{ revision: number; message: string } | null>(null);
  useEffect(() => {
    if (!valid) return;
    let worker: Worker | undefined;
    let active = true;
    const timer = setTimeout(() => {
      const request: GeometryRequest = { requestId: revision, revision, kind: 'mesh', inputHash: requestHash(parameters, 'mesh'), parameters };
      try {
        worker = new Worker(new URL('../workers/geometry.worker.ts', import.meta.url), { type: 'module' });
        worker.onmessage = ({ data }: MessageEvent<GeometryResponse>) => {
          if (!active || !isCurrentResponse(data, request)) return;
          if (data.status === 'ready') { setLast(data); setFailure(null); }
          else setFailure({ revision, message: data.error.message });
          worker?.terminate();
        };
        worker.onerror = () => { if (active) setFailure({ revision, message: 'Výpočet modelu selhal. Zkuste změnit parametr nebo obnovit stránku.' }); worker?.terminate(); };
        worker.postMessage(request);
      } catch { if (active) setFailure({ revision, message: 'Výpočetní worker není dostupný. Zkuste obnovit stránku.' }); }
    }, 100);
    return () => { active = false; clearTimeout(timer); worker?.terminate(); };
  }, [parameters, revision, valid]);
  const current = valid && last?.revision === revision ? last : null;
  const error = failure?.revision === revision ? failure.message : '';
  const status = !valid ? 'invalid' : current ? 'ready' : error ? 'failed' : 'pending';
  return { last, current, error, status };
}
