import { useEffect, useReducer, useState } from 'react';
import { Alert, Modal, Stack, Text } from '@mantine/core';
import { GENERATOR_VERSION } from '../io/preset';
import { useExport } from '../features/export/useExport';
import { editorReducer, initialEditor } from './editorState';
import { readSavedSettings, saveSettings } from './storage';
import { useGeometry } from './useGeometry';
import { useAnalysis } from './useAnalysis';
import type { FocusRegion } from '../features/printability/AnalysisPanel';
import { Workspace } from './Workspace';

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

  return <>
    <Workspace state={state} dispatch={dispatch} geometry={geometry} analysis={analysis} exporter={exporter} valid={valid}
      saving={saving} storageNotice={storageNotice || restored.notice} showMap={showMap} onMapChange={setShowMap}
      focused={focused} onFocus={setFocused} onHelp={() => setHelp(true)} />
    <Modal opened={help} onClose={() => setHelp(false)} title="Tisk v režimu spiral vase" centered size="lg">
      <Stack gap="md"><Text size="sm">Stáhněte solid STL a ve sliceru zachovejte milimetry a krček dole. Soubor obsahuje pouze tělo baňky.</Text>
        <ol className="print-instructions"><li>Zapněte skutečný spiral vase režim: jeden perimetr, nulová výplň a nulové horní vrstvy.</li>
          <li>Začněte bez podpěr. Počet spodních plných vrstev ověřte tak, aby zůstaly v přímém krčku.</li>
          <li>Prohlédněte spirálovou dráhu od krčku přes rameno až k poslednímu obvodu. Nízká adheze krčku může vyžadovat brim.</li>
          <li>Zkontrolujte koncový otvor. Uzavřený solid STL neznamená uzavřený vase výtisk.</li></ol>
        <Alert color="yellow">Výchozí předpoklady: tryska {mm(state.print.nozzleDiameterMm)} mm, extruze {mm(state.print.extrusionWidthMm)} mm, vrstva {mm(state.print.layerHeightMm)} mm. Skutečný profil tiskárny a materiálu je nutné ověřit. Generátor zatím nepotvrzuje fyzickou tisknutelnost.</Alert>
      </Stack>
    </Modal>
  </>;
}
