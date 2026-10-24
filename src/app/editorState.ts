import { ornamentSchema, type OrnamentParameters, type PrintAssumptions, type ShapeId } from '../domain/parameters';
import { createPreset } from '../domain/presets';
import { choiceOptions, choiceSections, type ChoiceDrafts, type SurfaceChoice } from '../domain/transformations';
import { draftsFor, fields, setField, type DraftValues, type ErrorField, type FieldErrors, type FieldId, type TransformSection } from '../features/editor/fields';
import { hashInput } from '../io/preset';
import { printDraftsFor, resolvePrint, type PrintDrafts, type PrintErrors, type PrintFieldId } from '../features/printability/fields';

export interface EditorState {
  parameters: OrnamentParameters;
  print: PrintAssumptions;
  drafts: DraftValues;
  errors: FieldErrors;
  choices: ChoiceDrafts;
  revision: number;
  printDrafts: PrintDrafts;
  printErrors: PrintErrors;
  printRevision: number;
}
export type EditorAction = { type: 'field'; id: FieldId; value: string }
  | { type: 'surfaceChoice'; id: SurfaceChoice; value: string }
  | { type: 'resetSection'; section: TransformSection }
  | { type: 'printField'; id: PrintFieldId; value: string }
  | { type: 'preset'; shape: ShapeId } | { type: 'reset' };

export function choicesFor(parameters: OrnamentParameters): ChoiceDrafts {
  return Object.fromEntries(Object.keys(choiceOptions).map(id => [id, parameters.surface[id as SurfaceChoice]])) as ChoiceDrafts;
}
export function initialEditor(input: OrnamentParameters, print: PrintAssumptions): EditorState {
  const parameters = ornamentSchema.parse(input);
  const printDrafts = printDraftsFor(print);
  return { parameters, print, drafts: draftsFor(parameters), choices: choicesFor(parameters), errors: {}, revision: 0,
    printDrafts, printErrors: resolvePrint(parameters, printDrafts).errors, printRevision: 0 };
}

function resolveDrafts(base: OrnamentParameters, drafts: DraftValues, choices: ChoiceDrafts): { parameters?: OrnamentParameters; errors: FieldErrors } {
  const candidate = structuredClone(base), errors: FieldErrors = {};
  Object.assign(candidate.surface, choices);
  for (const field of fields) {
    const text = drafts[field.id].trim().replace(',', '.');
    const number = Number(text);
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text) || !Number.isFinite(number)) {
      errors[field.id] = 'Zadejte konečné číslo.';
    } else if (number < field.min || number > field.max) {
      errors[field.id] = `Rozsah je ${field.min} až ${field.max}${field.unit ? ` ${field.unit}` : ''}.`;
    } else if ('integer' in field && field.integer && !Number.isInteger(number)) {
      errors[field.id] = `${field.label} musí být celé číslo.`;
    } else setField(candidate, field.id, number / ('scale' in field ? field.scale : 1));
  }
  if (Object.keys(errors).length) return { errors };
  const validated = ornamentSchema.safeParse(candidate);
  if (!validated.success) {
    for (const issue of validated.error.issues) {
      const id = issue.path.join('.') as ErrorField;
      errors[id] = issue.message;
    }
    return { errors };
  }
  return { parameters: validated.data, errors };
}

function withPrint(state: EditorState, parameters: OrnamentParameters, printDrafts: PrintDrafts): Pick<EditorState, 'print' | 'printDrafts' | 'printErrors' | 'printRevision'> {
  const resolved = resolvePrint(parameters, printDrafts);
  const changed = !!resolved.print && hashInput(resolved.print) !== hashInput(state.print);
  return { print: changed ? resolved.print! : state.print, printDrafts, printErrors: resolved.errors, printRevision: state.printRevision + (changed ? 1 : 0) };
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  if (action.type === 'preset' || action.type === 'reset') {
    const parameters = createPreset(action.type === 'preset' ? action.shape : state.parameters.shape);
    return { ...state, parameters, drafts: draftsFor(parameters), choices: choicesFor(parameters), errors: {},
      ...withPrint(state, parameters, state.printDrafts), revision: state.revision + 1 };
  }
  if (action.type === 'printField') return { ...state, ...withPrint(state, state.parameters, { ...state.printDrafts, [action.id]: action.value }) };
  // Fill added controls during development refreshes while preserving all drafts.
  const base = ornamentSchema.parse(state.parameters);
  const drafts = { ...draftsFor(base), ...state.drafts };
  const choices = { ...choicesFor(base), ...state.choices };
  if (action.type === 'field') drafts[action.id] = action.value;
  if (action.type === 'surfaceChoice') choices[action.id] = action.value;
  if (action.type === 'resetSection') {
    const defaults = createPreset(state.parameters.shape), defaultDrafts = draftsFor(defaults);
    for (const field of fields) if (field.section === action.section) drafts[field.id] = defaultDrafts[field.id];
    for (const id of Object.keys(choiceSections) as SurfaceChoice[])
      if (choiceSections[id] === action.section) choices[id] = defaults.surface[id];
  }
  const resolved = resolveDrafts(base, drafts, choices);
  if (!resolved.parameters) return { ...state, drafts, choices, errors: resolved.errors };
  const changed = hashInput(resolved.parameters) !== hashInput(state.parameters);
  return { ...state, drafts, choices, errors: {}, parameters: changed ? resolved.parameters : state.parameters,
    ...withPrint(state, resolved.parameters, state.printDrafts), revision: state.revision + (changed ? 1 : 0) };
}
