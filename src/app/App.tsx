import { lazy, Suspense, useEffect, useReducer, useState } from 'react';
import { Alert, Badge, Button, Divider, Group, Modal, Paper, Stack, Text, Title } from '@mantine/core';
import { GENERATOR_VERSION, serializeSettings } from '../io/preset';
import { ParameterPanel } from '../features/editor/ParameterPanel';
import { download, modelName, useExport } from '../features/export/useExport';
import { editorReducer, initialEditor } from './editorState';
import { readSavedSettings, saveSettings } from './storage';
import { useGeometry } from './useGeometry';
import { useAnalysis } from './useAnalysis';
import { AnalysisPanel, type FocusRegion } from '../features/printability/AnalysisPanel';

const Preview = lazy(() => import('../features/preview/Preview'));
const mm = (n: number) => n.toLocaleString('cs-CZ', { maximumFractionDigits: 2 });
function loadSettings() {
  try { return readSavedSettings(window.localStorage); }
  catch { return readSavedSettings({ getItem: () => { throw new Error('Storage unavailable'); } }); }
}

export function App() {
  const [restored] = useState(loadSettings);
  const [state, dispatch] = useReducer(editorReducer, restored.settings, saved => initialEditor(saved.parameters, saved.print));
  const [storageNotice, setStorageNotice] = useState('');
  const [saving, setSaving] = useState(false), [help, setHelp] = useState(false);
  const [showMap, setShowMap] = useState(false), [focused, setFocused] = useState<FocusRegion | null>(null);
  const validGeometry = Object.keys(state.errors).length === 0;
  const valid = validGeometry && Object.keys(state.printErrors).length === 0;
  const geometry = useGeometry(state.parameters, state.revision, validGeometry);
  const analysis = useAnalysis(state.parameters, state.print, geometry.current, state.revision, valid);
  const exporter = useExport();
  useEffect(() => setFocused(null), [analysis.inputHash, valid]);

  useEffect(() => {
    if (!valid) { setSaving(false); return; }
    setSaving(true);
    const timer = setTimeout(() => {
      try { setStorageNotice(saveSettings(window.localStorage, { schemaVersion: 1, generatorVersion: GENERATOR_VERSION, parameters: state.parameters, print: state.print })); }
      catch { setStorageNotice('Nastavení nelze uložit v tomto prohlížeči. Pro uchování použijte export JSON.'); }
      setSaving(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [state.parameters, state.print, valid]);

  const current = geometry.current;
  const summary = { ready: 'Geometrie ověřena', pending: 'Přepočítávám', invalid: 'Neplatné vstupy', failed: 'Výpočet selhal' }[geometry.status];
  return <main className="app" data-testid="editor" data-valid={valid}>
    <header className="app-header"><a className="brand" href="./">baňka<span> / </span>studio</a>
      <Group gap="sm"><Badge variant="light" color="pine" size="sm">Vše vzniká ve vašem prohlížeči</Badge>
        <Button variant="subtle" size="xs" onClick={() => setHelp(true)}>Jak tisknout</Button></Group></header>
    <div className="editor-intro"><div><Text className="eyebrow">PARAMETRICKÉ VÁNOČNÍ OZDOBY</Text><Title order={1}>Vytvořte si vlastní baňku.</Title></div>
      <Text size="xs" c="dimmed" className="save-indicator">{storageNotice ? 'Místní ukládání není dostupné' : !valid ? 'Rozepsané změny nejsou uložené' : saving ? 'Ukládám nastavení…' : 'Nastavení uloženo v tomto prohlížeči'}</Text></div>
    {(storageNotice || restored.notice) && <Alert color="yellow" mb="md" title="Místní nastavení">{storageNotice || restored.notice}</Alert>}
    <div className="editor-grid">
      <Paper withBorder radius="lg" className="controls-card"><ParameterPanel state={state} dispatch={dispatch} /></Paper>
      <Suspense fallback={<Paper className="preview-loading" withBorder>Načítám 3D náhled…</Paper>}>
        <Preview result={geometry.last} stale={!current} status={geometry.status}
          riskMap={showMap && analysis.report ? { key: analysis.inputHash, colors: analysis.report.colors } : null}
          focused={showMap && analysis.report ? focused : null} />
      </Suspense>
      <section className="result-panel" aria-label="Rozměry a export">
        <Paper withBorder p="lg" radius="lg"><Text className="eyebrow">03 / PŘIPRAVENO PRO SLICER</Text><Title order={2} size="h3" mb="lg">Váš model</Title>
          <div data-testid="geometry-status" data-state={geometry.status} data-revision={state.revision} role="status" aria-live="polite">
            <Badge color={geometry.status === 'ready' ? 'pine' : geometry.status === 'pending' ? 'gray' : 'red'} variant="light">{summary}</Badge>
          </div>
          <dl className="dimension-summary"><div><dt>Průměr základního profilu</dt><dd>{mm(state.parameters.body.baseDiameterMm)} <small>mm</small></dd></div>
            <div><dt>Celková výška s krčkem</dt><dd>{mm(state.parameters.body.heightMm + state.parameters.neck.lengthMm)} <small>mm</small></dd></div>
            <div><dt>Krček · průměr × délka</dt><dd>{mm(state.parameters.neck.diameterMm)} × {mm(state.parameters.neck.lengthMm)} <small>mm</small></dd></div></dl>
          <Divider my="md" />
          <Text size="xs" c="dimmed">Skutečné rozměry včetně žeber · X × Y × Z</Text>
          <Text size="sm" fw={600} mt={4} data-testid="actual-dimensions">{current ? `${current.validation.bounds.size.map(mm).join(' × ')} mm` : 'Čeká na platný výpočet'}</Text>
          <Text size="xs" c="dimmed" mt="sm">{current ? `${current.validation.triangles.toLocaleString('cs-CZ')} ploch v pracovním náhledu · jeden uzavřený solid` : geometry.status === 'failed' ? 'Upravte parametry a výpočet se zopakuje.' : 'Rozměry náhledu se aktualizují po výpočtu.'}</Text>
          {geometry.status === 'failed' && <Alert color="red" mt="md" role="alert">{geometry.error}</Alert>}
        </Paper>
        <AnalysisPanel analysis={analysis} revision={state.revision} showMap={showMap} onMapChange={setShowMap} focused={focused} onFocus={setFocused} />
        <Paper withBorder p="lg" radius="lg"><Title order={2} size="h4" mb="sm">Z modelu k výtisku</Title>
          <Text size="xs" c="dimmed" mb="md">STL je v milimetrech, s krčkem na podložce. Pro export vytvoříme jemnější síť a znovu ji ověříme.</Text>
          <Stack gap="sm"><Button fullWidth disabled={!valid || !current || exporter.exportRevision !== null} onClick={() => exporter.start(state.parameters, state.print, state.revision)}>
            {exporter.exportRevision !== null ? 'Připravuji jemné STL…' : 'Stáhnout STL ↓'}</Button>
            {exporter.exportRevision !== null && <><Text size="xs" c="dimmed">Exportuji revizi {exporter.exportRevision}. Další úpravy tento soubor nezmění.</Text><Button variant="subtle" color="gray" size="xs" onClick={exporter.cancel}>Zrušit export</Button></>}
            <Button fullWidth variant="default" disabled={!valid} onClick={() => download(serializeSettings({ schemaVersion: 1, generatorVersion: GENERATOR_VERSION, parameters: state.parameters, print: state.print }), `${modelName(state.parameters)}.json`, 'application/json')}>Uložit parametry JSON</Button>
          </Stack>
          {exporter.error && <Alert color="red" mt="md" role="alert">{exporter.error}</Alert>}
          {exporter.notice && <Alert color="blue" mt="md" role="status">{exporter.notice}</Alert>}
          <Alert color={analysis.report?.risk === 'high' ? 'red' : 'yellow'} variant="light" mt="lg"
            title={analysis.report ? 'Varování neblokuje solid STL' : 'STL bez dokončené analýzy'}>
            {analysis.report ? 'Tiskové riziko není chyba topologie. Varování si přečtěte a před tiskem ověřte dráhu ve sliceru.' : 'Geometricky validní STL lze stáhnout. Export se pokusí o finální analýzu; případné selhání výslovně oznámí.'}
          </Alert>
        </Paper>
      </section>
    </div>
    <footer className="app-footer"><Text size="xs" c="dimmed">Solid STL → jedna stěna ve spiral vase režimu. Na konci může zůstat otvor.</Text><Text size="xs" c="dimmed">Bez backendu · fyzický tisk dosud neověřen</Text></footer>
    <Modal opened={help} onClose={() => setHelp(false)} title="Tisk v režimu spiral vase" centered size="lg">
      <Stack gap="md"><Text size="sm">Stáhněte solid STL a ve sliceru zachovejte milimetry a krček dole. Soubor obsahuje pouze tělo baňky.</Text>
        <ol className="print-instructions"><li>Zapněte skutečný spiral vase režim: jeden perimetr, nulová výplň a nulové horní vrstvy.</li>
          <li>Začněte bez podpěr. Počet spodních plných vrstev ověřte tak, aby zůstaly v přímém krčku.</li>
          <li>Prohlédněte spirálovou dráhu od krčku přes rameno až k poslednímu obvodu. Nízká adheze krčku může vyžadovat brim.</li>
          <li>Zkontrolujte koncový otvor. Uzavřený solid STL neznamená uzavřený vase výtisk.</li></ol>
        <Alert color="yellow">Výchozí předpoklady: tryska {mm(state.print.nozzleDiameterMm)} mm, extruze {mm(state.print.extrusionWidthMm)} mm, vrstva {mm(state.print.layerHeightMm)} mm. Skutečný profil tiskárny a materiálu je nutné ověřit. Generátor zatím nepotvrzuje fyzickou tisknutelnost.</Alert>
      </Stack>
    </Modal>
  </main>;
}
