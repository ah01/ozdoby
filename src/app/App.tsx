import { useEffect, useRef, useState } from 'react';
import { defaultPrint, type OrnamentParameters, type ShapeId } from '../domain/parameters';
import { createPreset, presetLabels } from '../domain/presets';
import { GENERATOR_VERSION, serializeSettings } from '../io/preset';
import { isCurrentResponse, requestHash, type GeometryRequest, type GeometryResponse } from '../workers/protocol';

function download(data: BlobPart, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function App() {
  const [shape, setShape] = useState<ShapeId>('elongated');
  const [result, setResult] = useState<GeometryResponse | null>(null);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const serial = useRef(0), exportWorker = useRef<Worker | null>(null);
  const parameters = createPreset(shape);

  useEffect(() => {
    const p = createPreset(shape);
    const identity: GeometryRequest = { requestId: ++serial.current, revision: serial.current, kind: 'mesh', inputHash: requestHash(p, 'mesh'), parameters: p };
    setResult(null); setError('');
    let worker: Worker;
    try { worker = new Worker(new URL('../workers/geometry.worker.ts', import.meta.url), { type: 'module' }); }
    catch { setError('Výpočetní worker není dostupný. Zkuste obnovit stránku.'); return; }
    worker.onmessage = ({ data }: MessageEvent<GeometryResponse>) => {
      if (isCurrentResponse(data, identity)) setResult(data);
    };
    worker.onerror = () => setError('Výpočet modelu selhal. Zkuste obnovit stránku.');
    worker.postMessage(identity);
    // Termination cancels synchronous work as well as queued jobs. No old queue
    // accumulates when presets are changed rapidly or StrictMode remounts effects.
    return () => worker.terminate();
  }, [shape]);
  useEffect(() => () => exportWorker.current?.terminate(), []);

  const name = (p: OrnamentParameters) => `bulb-${p.shape}-${p.body.baseDiameterMm}x${p.body.heightMm + p.neck.lengthMm}-neck${p.neck.diameterMm}`;
  function exportStl() {
    const frozen = structuredClone(parameters);
    const request: GeometryRequest = { requestId: ++serial.current, revision: serial.current, kind: 'stl', inputHash: requestHash(frozen, 'stl'), parameters: frozen };
    setExporting(true); setError('');
    let worker: Worker;
    try { worker = new Worker(new URL('../workers/geometry.worker.ts', import.meta.url), { type: 'module' }); }
    catch { setExporting(false); setError('Exportní worker není dostupný.'); return; }
    exportWorker.current = worker;
    worker.onmessage = ({ data }: MessageEvent<GeometryResponse>) => {
      if (!isCurrentResponse(data, request)) return;
      setExporting(false);
      if (data.status === 'ready' && data.stl) download(data.stl, `${name(frozen)}.stl`, 'application/octet-stream');
      else if (data.status === 'failed') setError(data.error.message);
      worker.terminate(); exportWorker.current = null;
    };
    worker.onerror = () => { setError('Export STL selhal.'); setExporting(false); worker.terminate(); exportWorker.current = null; };
    worker.postMessage(request);
  }
  const validation = result?.status === 'ready' ? result.validation : null;
  return <main>
    <header><a className="brand" href="./">baňka<span> / </span>studio</a><span className="version">Pracovní verze · 0.1</span></header>
    <section className="intro"><p className="eyebrow">PARAMETRICKÉ VÁNOČNÍ OZDOBY</p>
      <h1>Od profilu<br />k prvnímu výtisku.</h1>
      <p>První verze generátoru uzavřených modelů pro spiral vase tisk. Vyberte referenční siluetu a stáhněte si tělo baňky v milimetrech.</p>
    </section>
    <section className="workspace" aria-label="Referenční generátor">
      <div className="settings"><p className="eyebrow">01 / SILUETA</p><h2>Základní tvar</h2>
        <fieldset><legend className="sr-only">Vyberte siluetu</legend>{(Object.keys(presetLabels) as ShapeId[]).map(id =>
          <label className={`preset ${shape === id ? 'selected' : ''}`} key={id}>
            <input type="radio" name="shape" value={id} checked={shape === id} onChange={() => setShape(id)} />
            <span>{presetLabels[id]}</span><span className="preset-size">56 × {createPreset(id).body.heightMm} mm</span>
          </label>)}</fieldset>
        <p className="note">Rozměr siluety nezahrnuje krček. Interaktivní 3D editor bude následovat v další fázi.</p>
      </div>
      <div className="summary"><p className="eyebrow">02 / MODEL A EXPORT</p><h2>{shape === 'drop' ? 'Kapka' : `${presetLabels[shape]} baňka`}</h2>
        <dl><div><dt>Celková výška</dt><dd>{parameters.body.heightMm + parameters.neck.lengthMm}<small> mm</small></dd></div>
          <div><dt>Průměr těla</dt><dd>{parameters.body.baseDiameterMm}<small> mm</small></dd></div>
          <div><dt>Krček · průměr × délka</dt><dd>14 × 8<small> mm</small></dd></div></dl>
        <p role="status" aria-live="polite">{error || (result?.status === 'failed' ? result.error.message : validation
          ? `Geometrie ověřena · ${validation.triangles.toLocaleString('cs-CZ')} ploch v pracovním modelu · 1 uzavřená komponenta`
          : 'Přepočítávám geometrii…')}</p>
        <div className="actions"><button onClick={exportStl} disabled={!validation || exporting}>{exporting ? 'Připravuji STL…' : 'Stáhnout solid STL ↓'}</button>
          <button className="secondary" onClick={() => download(serializeSettings({ schemaVersion: 1, generatorVersion: GENERATOR_VERSION, parameters, print: defaultPrint }), `${name(parameters)}.json`, 'application/json')}>Parametry JSON</button></div>
        <p className="note">STL používá jemnější síť a před stažením prochází novou validací. Orientace pro tisk: krček dole, Z nahoru.</p>
      </div>
    </section>
    <aside><strong>Před tiskem ověřte dráhu ve sliceru.</strong><p>Analýza převisů a vrstev zatím není součástí aplikace. Nízká adheze krčku může vyžadovat brim. Uzavřený STL nezaručuje uzavřený výtisk: na špičce může zůstat otvor. Tisk ani zavěšení dosud nejsou fyzicky ověřeny.</p></aside>
    <footer><span>Lokální generování · bez účtu a serveru</span><span>Jedna stěna. Váš tvar.</span></footer>
  </main>;
}
