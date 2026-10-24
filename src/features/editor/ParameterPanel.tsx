import { useEffect, useMemo, useState, type Dispatch } from 'react';
import { Accordion, Alert, Badge, Button, Group, NumberInput, SegmentedControl, Select, Slider, Stack, Text } from '@mantine/core';
import { choicesFor, type EditorAction, type EditorState } from '../../app/editorState';
import { ornamentSchema, type ShapeId } from '../../domain/parameters';
import { presetLabels } from '../../domain/presets';
import { draftsFor, fields, type FieldSection, type TransformSection } from './fields';
import { PrintPanel } from '../printability/PrintPanel';
import { choiceOptions, choiceSections, type SurfaceChoice } from '../../domain/transformations';

const sections: { id: FieldSection; title: string; description: string }[] = [
  { id: 'body', title: 'Tělo baňky', description: 'Základní rozměry siluety před přidáním povrchu. Poloha maxima se měří od krčku směrem k zakončení.' },
  { id: 'ribs', title: 'Žebra', description: 'Podélný vzor kolem obvodu. Počet, hloubka, tvar a poloha vrcholů se nastavují nezávisle.' },
  { id: 'twist', title: 'Zkroucení', description: 'Otáčení žeber podél výšky těla. Záporný úhel obrátí směr spirály.' },
  { id: 'waves', title: 'Vodorovné vlny', description: 'Prstence po výšce těla. Fungují i bez žeber a lze je kombinovat se spirálou.' },
  { id: 'neck', title: 'Krček', description: 'Kruhová dosedací část zůstává bez žeber, vln a zkroucení.' },
  { id: 'advanced', title: 'Napojení a zakončení', description: 'Náběh plynule tlumí žebra i vlny u obou konců. Koncový otvor může po vase tisku zůstat otevřený.' },
];
const choiceLabels: Record<SurfaceChoice, string> = {
  ribShape: 'Tvar žeber', amplitudeProfile: 'Rozložení hloubky žeber', twistProfile: 'Průběh zkroucení',
};
const resetLabels: Record<TransformSection, string> = { ribs: 'Obnovit žebra', twist: 'Obnovit zkroucení', waves: 'Obnovit vlny' };
const isTransform = (section: FieldSection): section is TransformSection => section === 'ribs' || section === 'twist' || section === 'waves';

export function ParameterPanel({ state, dispatch }: { state: EditorState; dispatch: Dispatch<EditorAction> }) {
  const parameters = useMemo(() => ornamentSchema.parse(state.parameters), [state.parameters]);
  const drafts = { ...draftsFor(parameters), ...state.drafts }, choices = { ...choicesFor(parameters), ...state.choices };
  const [opened, setOpened] = useState<string[]>(['body', 'neck', 'ribs', 'twist']);
  useEffect(() => {
    const invalidSections = sections.filter(section => fields.some(field => field.section === section.id && state.errors[field.id])
      || (Object.keys(choiceSections) as SurfaceChoice[]).some(id => choiceSections[id] === section.id && state.errors[`surface.${id}`])).map(section => section.id);
    if (invalidSections.length) setOpened(current => [...new Set([...current, ...invalidSections])]);
  }, [state.errors]);
  const number = (id: keyof typeof drafts) => Number(drafts[id].replace(',', '.'));
  const summary = (section: TransformSection): { text: string; color: string } => {
    if (fields.some(field => field.section === section && state.errors[field.id])
      || (Object.keys(choiceSections) as SurfaceChoice[]).some(id => choiceSections[id] === section && state.errors[`surface.${id}`])) return { text: 'Neplatný vstup', color: 'red' };
    if (section === 'ribs') return number('surface.amplitudeMm') === 0 ? { text: 'Vypnuto', color: 'gray' }
      : { text: `${drafts['surface.ribs']} × ${drafts['surface.amplitudeMm'].replace('.', ',')} mm`, color: 'pine' };
    if (section === 'waves') return number('surface.waveAmplitudeMm') === 0 ? { text: 'Vypnuto', color: 'gray' }
      : { text: `${drafts['surface.waveCount']} × ${drafts['surface.waveAmplitudeMm'].replace('.', ',')} mm`, color: 'pine' };
    return number('surface.amplitudeMm') === 0 ? { text: 'Bez žeber', color: 'gray' } : number('surface.twistDeg') === 0 ? { text: 'Bez zkroucení', color: 'gray' }
      : { text: `${drafts['surface.twistDeg']}°`, color: 'pine' };
  };
  return <section className="parameter-panel" aria-label="Nastavení baňky">
    <div className="panel-heading"><Text className="eyebrow">01 / VÁŠ TVAR</Text><Text component="h2">Silueta a rozměry</Text></div>
    <SegmentedControl fullWidth orientation="vertical" size="xs" aria-label="Silueta" value={parameters.shape}
      onChange={value => dispatch({ type: 'preset', shape: value as ShapeId })}
      data={Object.entries(presetLabels).map(([value, label]) => ({ value, label }))} />
    <Text size="xs" c="dimmed" mt="sm" mb="lg">Výběr siluety obnoví její výchozí rozměry i povrch.</Text>
    <Accordion multiple variant="separated" value={opened} onChange={setOpened}>
      {sections.map(({ id: section, title, description }) => {
        const status = isTransform(section) ? summary(section) : null;
        return <Accordion.Item key={section} value={section}>
          <Accordion.Control><Group justify="space-between" gap="xs" wrap="nowrap"><span>{title}</span>
            {status && <Badge size="xs" variant="light" color={status.color}>{status.text}</Badge>}
          </Group></Accordion.Control>
          <Accordion.Panel><Text size="xs" c="dimmed" mb="md">{description}</Text>
            <Stack gap="lg">{fields.filter(field => field.section === section).map(field => {
              const parsed = Number(drafts[field.id].replace(',', '.'));
              const max = field.id === 'surface.blendLengthMm' ? Math.min(field.max, parameters.body.heightMm / 2) : field.max;
              const sliderValue = Math.max(field.min, Math.min(max, Number.isFinite(parsed) && drafts[field.id] !== '' ? parsed : field.min));
              const label = field.id === 'surface.twistDeg' && choices.twistProfile === 'reverse' ? 'Rozsah zkroucení' : field.label;
              return <div key={field.id} className="parameter-field">
                <NumberInput id={field.id.replace('.', '-')} label={label} description={'description' in field ? field.description : undefined}
                  value={drafts[field.id]} onChange={value => dispatch({ type: 'field', id: field.id, value: String(value) })}
                  min={field.min} max={field.max} step={field.step} clampBehavior="none"
                  decimalSeparator="," allowedDecimalSeparators={['.', ',']} valueIsNumericString allowNegative
                  suffix={field.unit ? ` ${field.unit}` : undefined} error={state.errors[field.id]}
                  aria-invalid={!!state.errors[field.id]} size="sm" />
                <Slider mt="sm" thumbLabel={`${label} – posuvník`} min={field.min} max={max}
                  step={field.step} value={sliderValue} label={value => `${value.toLocaleString('cs-CZ')} ${field.unit}`}
                  onChange={value => dispatch({ type: 'field', id: field.id, value: String(value) })} />
              </div>;
            })}
            {(Object.keys(choiceOptions) as SurfaceChoice[]).filter(id => choiceSections[id] === section).map(id =>
              <Select key={id} label={choiceLabels[id]} value={choices[id]} allowDeselect={false} error={state.errors[`surface.${id}`]}
                data={Object.entries(choiceOptions[id]).map(([value, label]) => ({ value, label }))}
                onChange={value => { if (value && Object.hasOwn(choiceOptions[id], value)) dispatch({ type: 'surfaceChoice', id, value }); }} />)}
            </Stack>
            {section === 'ribs' && <Text size="xs" c="dimmed" mt="md">{choices.ribShape === 'narrow' ? 'Úzké vrcholy zvýrazní jednotlivá žebra.' : choices.ribShape === 'broad' ? 'Široké vrcholy tvoří plnější, plošší hřebeny.' : 'Oblá žebra tvoří plynulý sinusový vzor.'}</Text>}
            {section === 'twist' && <Text size="xs" c="dimmed" mt="md">{number('surface.amplitudeMm') === 0 ? 'Při nulové amplitudě zkroucení nemění tvar. Pro zatočená žebra nejprve zvyšte amplitudu.'
              : choices.twistProfile === 'reverse' ? 'Žebra se do poloviny těla otočí o zadaný úhel a pak se vrátí. Zadaný rozsah je maximální otočení.'
              : choices.twistProfile === 'linear' ? 'Úhel se mění rovnoměrně po celé výšce těla.' : 'Otáčení se rozbíhá a zpomaluje plynule u konců těla.'}</Text>}
            {isTransform(section) && <Button fullWidth variant="subtle" size="xs" mt="md" onClick={() => dispatch({ type: 'resetSection', section })}>{resetLabels[section]}</Button>}
          </Accordion.Panel></Accordion.Item>;
      })}
    </Accordion>
    <Button fullWidth variant="subtle" mt="md" onClick={() => dispatch({ type: 'reset' })}>Obnovit výchozí tvar</Button>
    <PrintPanel state={state} dispatch={dispatch} />
    {Object.keys(state.errors).length > 0 && <Alert color="red" mt="sm" title="Zkontrolujte hodnoty" role="alert">
      Opravte zvýrazněné vstupy. Náhled ukazuje poslední platný tvar a export je pozastavený.
    </Alert>}
  </section>;
}
