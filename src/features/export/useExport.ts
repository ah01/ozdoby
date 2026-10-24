import { useEffect, useRef, useState } from 'react';
import type { OrnamentParameters, PrintAssumptions } from '../../domain/parameters';
import { riskLabels } from '../../analysis/types';
import { defaultStlDetail, stlDetails, type StlDetail } from '../../domain/stlDetail';
import { isCurrentResponse, requestHash, type GeometryRequest, type GeometryResponse } from '../../workers/protocol';

export function download(data: BlobPart, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const modelName = (p: OrnamentParameters, width = p.body.baseDiameterMm): string =>
  `bulb-${p.shape}-${Number(width.toFixed(2))}x${Number((p.body.heightMm + p.neck.lengthMm).toFixed(2))}-neck${p.neck.diameterMm}`;

export function useExport() {
  const worker = useRef<Worker | null>(null), serial = useRef(0);
  const [exportRevision, setExportRevision] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [detail, setDetail] = useState<StlDetail>(defaultStlDetail);
  useEffect(() => () => worker.current?.terminate(), []);
  const cancel = () => { worker.current?.terminate(); worker.current = null; setExportRevision(null); };
  const start = (parameters: OrnamentParameters, print: PrintAssumptions, revision: number) => {
    cancel(); setError(''); setNotice(''); setExportRevision(revision);
    const frozen = structuredClone(parameters);
    const frozenPrint = structuredClone(print);
    const frozenDetail = detail;
    const request: GeometryRequest = { requestId: ++serial.current, revision, kind: 'stl', inputHash: requestHash(frozen, 'stl', frozenPrint, frozenDetail), parameters: frozen, print: frozenPrint, stlDetail: frozenDetail };
    try {
      const job = new Worker(new URL('../../workers/geometry.worker.ts', import.meta.url), { type: 'module' });
      worker.current = job;
      job.onmessage = ({ data }: MessageEvent<GeometryResponse>) => {
        if (worker.current !== job || !isCurrentResponse(data, request)) return;
        if (data.status === 'ready' && data.stl) {
          const summary = `STL revize ${revision} · přesnost ${stlDetails[frozenDetail].toleranceMm.toLocaleString('cs-CZ')} mm · ${data.validation.triangles.toLocaleString('cs-CZ')} trojúhelníků.`;
          setNotice(data.analysis?.status === 'ready' ? `${summary} ${riskLabels[data.analysis.report.risk]}. Ověřte dráhu ve sliceru.`
            : `${summary} Bez dokončené analýzy. ${data.analysis?.status === 'failed' ? data.analysis.message : ''}`);
          download(data.stl, `${modelName(frozen, data.validation.bounds.size[0]!)}.stl`, 'application/octet-stream');
        }
        else if (data.status === 'failed') setError(data.error.message);
        job.terminate(); worker.current = null; setExportRevision(null);
      };
      job.onerror = () => { if (worker.current === job) { setError('Export STL selhal. Zkuste hrubší detail STL nebo snižte hloubku či počet žeber a vln.'); cancel(); } };
      job.postMessage(request);
    } catch { setError('Exportní worker není dostupný.'); cancel(); }
  };
  return { start, cancel, error, notice, exportRevision, detail, setDetail };
}
