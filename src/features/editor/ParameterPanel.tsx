import { useEffect, useState, type Dispatch } from 'react';
import { Accordion, Alert, Button, NumberInput, SegmentedControl, Select, Slider, Stack, Text } from '@mantine/core';
import type { EditorAction, EditorState } from '../../app/editorState';
import type { ShapeId } from '../../domain/parameters';
import { presetLabels } from '../../domain/presets';
import { fields, getField } from './fields';
import { PrintPanel } from '../printability/PrintPanel';
import { amplitudeProfiles, twistProfiles } from '../../domain/transformations';

export function ParameterPanel({ state, dispatch }: { state: EditorState; dispatch: Dispatch<EditorAction> }) {
  const [opened, setOpened] = useState<string[]>(['body', 'neck', 'surface']);
  useEffect(() => {
    if (state.errors['surface.blendLengthMm'] || state.errors['body.tipRadiusMm'])
      setOpened(current => current.includes('advanced') ? current : [...current, 'advanced']);
  }, [state.errors]);
  return <section className="parameter-panel" aria-label="Nastavení baňky">
    <div className="panel-heading"><Text className="eyebrow">01 / VÁŠ TVAR</Text><Text component="h2">Silueta a rozměry</Text></div>
    <SegmentedControl fullWidth orientation="vertical" size="xs" aria-label="Silueta" value={state.parameters.shape}
      onChange={value => dispatch({ type: 'preset', shape: value as ShapeId })}
      data={Object.entries(presetLabels).map(([value, label]) => ({ value, label }))} />
    <Text size="xs" c="dimmed" mt="sm" mb="lg">Výběr siluety obnoví její výchozí rozměry i povrch.</Text>
    <Accordion multiple variant="separated" value={opened} onChange={setOpened}>
      {([{ section: 'body', title: 'Tělo baňky' }, { section: 'neck', title: 'Krček' },
        { section: 'surface', title: 'Žebrování a zkroucení' }, { section: 'advanced', title: 'Pokročilé nastavení' }] as const).map(({ section, title }) =>
        <Accordion.Item key={section} value={section}><Accordion.Control>{title}</Accordion.Control>
          <Accordion.Panel><Stack gap="lg">{fields.filter(field => field.section === section).map(field => {
            const parsed = Number(state.drafts[field.id].replace(',', '.'));
            const max = field.id === 'surface.blendLengthMm' ? Math.min(field.max, state.parameters.body.heightMm / 2) : field.max;
            const sliderValue = Math.max(field.min, Math.min(max, Number.isFinite(parsed) && state.drafts[field.id] !== '' ? parsed : getField(state.parameters, field.id) * ('scale' in field ? field.scale : 1)));
            const label = field.id === 'surface.twistDeg' && state.parameters.surface.twistProfile === 'reverse' ? 'Rozsah zkroucení' : field.label;
            return <div key={field.id} className="parameter-field">
              <NumberInput id={field.id.replace('.', '-')} label={label}
                value={state.drafts[field.id]} onChange={value => dispatch({ type: 'field', id: field.id, value: String(value) })}
                min={field.min} max={field.max} step={field.step} clampBehavior="none"
                decimalSeparator="," allowedDecimalSeparators={['.', ',']} valueIsNumericString allowNegative
                suffix={field.unit ? ` ${field.unit}` : undefined} error={state.errors[field.id]}
                aria-invalid={!!state.errors[field.id]} size="sm" />
              <Slider mt="sm" thumbLabel={`${label} – posuvník`} min={field.min} max={max}
                step={field.step} value={sliderValue} label={value => `${value.toLocaleString('cs-CZ')} ${field.unit}`}
                onChange={value => dispatch({ type: 'field', id: field.id, value: String(value) })} />
            </div>;
          })}</Stack>
          {section === 'neck' && <Text size="xs" c="dimmed" mt="md">Kruhová dosedací část zůstává bez žeber a zkroucení.</Text>}
          {section === 'body' && <Text size="xs" c="dimmed" mt="md">Poloha maxima se měří od krčku směrem k zakončení.</Text>}
          {section === 'surface' && <Stack gap="md" mt="lg">
            <Select label="Rozložení hloubky žeber" value={state.parameters.surface.amplitudeProfile} allowDeselect={false}
              data={Object.entries(amplitudeProfiles).map(([value, label]) => ({ value, label }))}
              onChange={value => { if (value && Object.hasOwn(amplitudeProfiles, value)) dispatch({ type: 'surfaceChoice', id: 'amplitudeProfile', value }); }} />
            <Select label="Průběh zkroucení" value={state.parameters.surface.twistProfile} allowDeselect={false}
              data={Object.entries(twistProfiles).map(([value, label]) => ({ value, label }))}
              onChange={value => { if (value && Object.hasOwn(twistProfiles, value)) dispatch({ type: 'surfaceChoice', id: 'twistProfile', value }); }} />
            {state.parameters.surface.twistProfile === 'reverse' && <Text size="xs" c="dimmed">Žebra se do poloviny těla otočí o zadaný úhel a pak se vrátí. Zadaný rozsah je maximální otočení.</Text>}
          </Stack>}
          {section === 'surface' && state.parameters.surface.amplitudeMm === 0 && <Text size="xs" c="dimmed" mt="md">Při nulové amplitudě zkroucení nemění tvar. Pro zatočená žebra nejprve zvyšte amplitudu.</Text>}
          {section === 'advanced' && <Text size="xs" c="dimmed" mt="md">Náběh může zabírat nejvýše polovinu výšky těla. Zakončení může po vase tisku zůstat otevřené.</Text>}
          </Accordion.Panel></Accordion.Item>)}
    </Accordion>
    <Button fullWidth variant="subtle" mt="md" onClick={() => dispatch({ type: 'reset' })}>Obnovit výchozí tvar</Button>
    <PrintPanel state={state} dispatch={dispatch} />
    {Object.keys(state.errors).length > 0 && <Alert color="red" mt="sm" title="Zkontrolujte hodnoty" role="alert">
      Opravte zvýrazněné vstupy. Náhled ukazuje poslední platný tvar a export je pozastavený.
    </Alert>}
  </section>;
}
