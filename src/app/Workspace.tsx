import { lazy, Suspense, useState, type Dispatch } from 'react';
import { Alert, Button, Drawer, Group, Paper, Popover, Select, Stack, Text, Title } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import type { EditorAction, EditorState } from './editorState';
import type { useGeometry } from './useGeometry';
import type { useAnalysis } from './useAnalysis';
import { ParameterPanel } from '../features/editor/ParameterPanel';
import { download, modelName, type useExport } from '../features/export/useExport';
import { AnalysisPanel, type FocusRegion } from '../features/printability/AnalysisPanel';
import { riskLabels } from '../analysis/types';
import { GENERATOR_VERSION, serializeSettings } from '../io/preset';
import { stlDetails, type StlDetail } from '../domain/stlDetail';

const Preview = lazy(() => import('../features/preview/Preview'));
const number = (n: number) => n.toLocaleString('cs-CZ', { maximumFractionDigits: 2 });
interface WorkspaceProps {
  state: EditorState; dispatch: Dispatch<EditorAction>; geometry: ReturnType<typeof useGeometry>;
  analysis: ReturnType<typeof useAnalysis>; exporter: ReturnType<typeof useExport>; valid: boolean;
  saving: boolean; storageNotice: string; showMap: boolean; onMapChange: (value: boolean) => void;
  focused: FocusRegion | null; onFocus: (value: FocusRegion | null) => void; onHelp: () => void;
}

export function Workspace({ state, dispatch, geometry, analysis, exporter, valid, saving, storageNotice, showMap, onMapChange, focused, onFocus, onHelp }: WorkspaceProps) {
  const mobile = useMediaQuery('(max-width: 760px)');
  const [settingsOpened, setSettingsOpened] = useState(false), [detailsOpened, setDetailsOpened] = useState(false);
  const current = geometry.current, report = analysis.report;
  const geometryLabel = { ready: 'Geometrie ověřena', pending: 'Přepočítávám geometrii', invalid: 'Neplatný tvar', failed: 'Výpočet selhal' }[geometry.status];
  const assessment = report ? riskLabels[report.risk] : analysis.status === 'pending' ? 'Vyhodnocuji · nevyhodnoceno' : 'Nevyhodnoceno';
  const riskColor = report?.risk === 'high' ? 'red' : report?.risk === 'warning' ? 'yellow' : report ? 'pine' : 'gray';
  const settings = <>
    {storageNotice && <Alert color="yellow" m="sm" title="Místní nastavení">{storageNotice}</Alert>}
    <ParameterPanel state={state} dispatch={dispatch} />
  </>;

  return <main className="workspace-shell" data-testid="editor" data-valid={valid}>
    <header className="workspace-header">
      <Group gap="sm" wrap="nowrap">{mobile && <Button aria-label="Otevřít nastavení" size="compact-sm" variant="default" onClick={() => setSettingsOpened(true)}>☰</Button>}
        <a className="brand" href="./">baňka<span> / </span>studio</a><Title order={1} className="workspace-title">Editor vánočních ozdob</Title></Group>
      <Group gap="sm" wrap="nowrap"><Text size="xs" c="dimmed" className="save-indicator">{storageNotice ? 'Místní ukládání není dostupné' : !valid ? 'Rozepsané změny nejsou uložené' : saving ? 'Ukládám nastavení…' : 'Nastavení uloženo v tomto prohlížeči'}</Text>
        <Button variant="subtle" size="xs" onClick={onHelp}>Jak tisknout</Button></Group>
    </header>

    <div className="workspace-body">
      {!mobile && <aside className="workspace-settings" aria-label="Nastavení modelu" data-testid="settings-panel">{settings}</aside>}
      <Suspense fallback={<Paper className="preview-loading">Načítám 3D náhled…</Paper>}>
        <Preview result={geometry.last} stale={!current} status={geometry.status}
          showMap={showMap} onMapChange={onMapChange} analysisStatus={analysis.status}
          riskMap={showMap && report ? { key: analysis.inputHash, colors: report.colors } : null}
          focused={showMap && report ? focused : null} />
      </Suspense>
    </div>

    <section className="workspace-bottom" aria-label="Výsledek a stažení" data-testid="bottom-panel">
      <div className="bottom-model"><Text size="xs" c="dimmed">Rozměry · X × Y × Z</Text>
        <Text size="sm" fw={600} data-testid="actual-dimensions">{current ? `${current.validation.bounds.size.map(number).join(' × ')} mm` : 'Čeká na platný výpočet'}</Text>
        <div data-testid="geometry-status" data-state={geometry.status} data-revision={state.revision} role="status" aria-live="polite">
          <Text size="xs" c={geometry.status === 'ready' ? 'pine' : geometry.status === 'pending' ? 'dimmed' : 'red'}>{geometryLabel}</Text>
        </div>
      </div>

      <div className="bottom-analysis" data-testid="analysis-status" data-state={analysis.status} data-input-hash={analysis.inputHash} data-revision={state.revision} role="status" aria-live="polite">
        {/* Use the stable heading as the dialog name, not the changing risk label. */}
        <Popover opened={detailsOpened} onChange={setDetailsOpened} position="top" withArrow shadow="lg" width={560} trapFocus returnFocus withinPortal withRoles={false}>
          <Popover.Target><Button variant="light" color={riskColor} className="analysis-summary-button" size="md"
            aria-label={`Podrobnosti analýzy: ${assessment}`} aria-haspopup="dialog" aria-expanded={detailsOpened} aria-controls="analysis-details-content"
            data-testid="analysis-details-button" onClick={() => setDetailsOpened(value => !value)}>
            <span className="analysis-summary-text"><span>{assessment} <span aria-hidden="true">⌃</span></span>
              <span className="analysis-summary-metrics">{report ? `Převis ${number(report.overhang.maxAngleDeg)}° · opora ${number(report.layers.minUpperOverlap * 100)} %` : analysis.status === 'failed' ? 'Výpočet nedokončen · zobrazit důvod' : 'Podrobné výsledky analýzy'}</span>
            </span>
          </Button></Popover.Target>
          <Popover.Dropdown className="analysis-popover" id="analysis-details-content" role="dialog" aria-labelledby="analysis-details-title">
            <Group justify="space-between" className="analysis-popover-heading"><Title order={2} size="h4" id="analysis-details-title">Podrobné výsledky analýzy</Title>
              <Button size="compact-xs" variant="subtle" color="gray" aria-label="Zavřít podrobnosti analýzy" onClick={() => setDetailsOpened(false)}>×</Button></Group>
            <AnalysisPanel analysis={analysis} revision={state.revision} showMap={showMap} onMapChange={onMapChange} focused={focused} detailsOnly
              onFocus={region => { onFocus(region); setDetailsOpened(false); }} />
          </Popover.Dropdown>
        </Popover>
      </div>

      <Group className="bottom-downloads" gap="xs" wrap="wrap" justify="flex-end">
        {exporter.exportRevision !== null && <Button variant="subtle" color="gray" size="xs" onClick={exporter.cancel}>Zrušit export</Button>}
        <Button variant="default" disabled={!valid} aria-label="Uložit parametry JSON"
          onClick={() => download(serializeSettings({ schemaVersion: 1, generatorVersion: GENERATOR_VERSION, parameters: state.parameters, print: state.print }), `${modelName(state.parameters)}.json`, 'application/json')}>JSON</Button>
        <Popover position="top" withArrow shadow="md" width={300} withinPortal>
          <Popover.Target><Button variant="default" size="compact-sm" aria-label="Nastavení detailu STL">Detail · {number(stlDetails[exporter.detail].toleranceMm)} mm</Button></Popover.Target>
          <Popover.Dropdown className="stl-detail-popover"><Stack gap="sm">
            <Select label="Přesnost STL" value={exporter.detail} allowDeselect={false} comboboxProps={{ withinPortal: false }}
              data={Object.entries(stlDetails).map(([value, option]) => ({ value, label: option.label }))}
              onChange={value => { if (value && Object.hasOwn(stlDetails, value)) exporter.setDetail(value as StlDetail); }} />
            <Text size="xs" c="dimmed">Maximální odchylka sítě od povrchu. Hrubší STL má méně trojúhelníků a menší soubor; jemné lépe zachová žebra. Limit je 2 miliony trojúhelníků (STL až 100 MB). Náhled se nemění.</Text>
            <Text size="xs" c="dimmed">Volba platí pro příští export. Probíhající export používá nastavení z okamžiku spuštění.</Text>
          </Stack></Popover.Dropdown>
        </Popover>
        <Button disabled={!valid || exporter.exportRevision !== null} onClick={() => exporter.start(state.parameters, state.print, state.revision)}>
          {exporter.exportRevision !== null ? 'Připravuji STL…' : 'Stáhnout STL ↓'}</Button>
      </Group>
      {(geometry.status === 'failed' || exporter.error || exporter.notice) && <Text size="xs" className="bottom-notice" c={exporter.error || (geometry.status === 'failed' && !exporter.notice) ? 'red' : 'dimmed'} role={exporter.error ? 'alert' : 'status'}>
        {exporter.error || exporter.notice || geometry.error}
      </Text>}
    </section>

    {mobile && <Drawer opened={settingsOpened} onClose={() => setSettingsOpened(false)} title="Nastavení baňky" position="left" size={320} padding={0} closeButtonProps={{ 'aria-label': 'Zavřít nastavení' }}
      styles={{ body: { height: 'calc(100dvh - 64px)', overflowY: 'auto', overscrollBehavior: 'contain' } }}>{settings}</Drawer>}
  </main>;
}
