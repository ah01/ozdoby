import type { Dispatch } from 'react';
import { Accordion, Alert, NumberInput, Stack, Text } from '@mantine/core';
import type { EditorAction, EditorState } from '../../app/editorState';
import { printFields } from './fields';

export function PrintPanel({ state, dispatch }: { state: EditorState; dispatch: Dispatch<EditorAction> }) {
  const invalid = Object.keys(state.printErrors).length > 0;
  return <section className="print-panel" aria-label="Tiskové předpoklady">
    <Accordion variant="separated" defaultValue={invalid ? 'print' : null}>
      <Accordion.Item value="print"><Accordion.Control>Tiskové předpoklady</Accordion.Control><Accordion.Panel>
        <Stack gap="sm">{printFields.map(field => <NumberInput key={field.id} label={field.label}
          value={state.printDrafts[field.id]} valueIsNumericString clampBehavior="none"
          onChange={value => dispatch({ type: 'printField', id: field.id, value: String(value) })}
          min={field.min} max={field.max} step={field.step} decimalSeparator="," allowedDecimalSeparators={['.', ',']}
          suffix={field.unit ? ` ${field.unit}` : undefined} error={state.printErrors[field.id]} aria-invalid={!!state.printErrors[field.id]} />)}</Stack>
        <Text size="xs" c="dimmed" mt="md">Odhad pro tuto kombinaci vrstvy a extruze. Nenahrazuje profil tiskárny, chlazení, rychlost ani skutečný slicing.</Text>
      </Accordion.Panel></Accordion.Item>
    </Accordion>
    {invalid && <Alert color="red" title="Zkontrolujte tiskové vstupy" mt="sm" role="alert">
      Analýza i export čekají na platné hodnoty. Geometrický náhled můžete dál upravovat.
    </Alert>}
  </section>;
}
