import { ornamentSchema, type OrnamentParameters, type PrintAssumptions, type ShapeId } from '../domain/parameters';
import { createPreset } from '../domain/presets';
import { draftsFor, fields, setField, type DraftValues, type FieldErrors, type FieldId } from '../features/editor/fields';
import { hashInput } from '../io/preset';
import { printDraftsFor, resolvePrint, type PrintDrafts, type PrintErrors, type PrintFieldId } from '../features/printability/fields';

export interface EditorState {
  parameters: OrnamentParameters;
  print: PrintAssumptions;
  drafts: DraftValues;
  errors: FieldErrors;
  revision: number;
  printDrafts: PrintDrafts;
  printErrors: PrintErrors;
  printRevision: number;
}
export type EditorAction = { type: 'field'; id: FieldId; value: string }
  | { type: 'printField'; id: PrintFieldId; value: string }
  | { type: 'preset'; shape: ShapeId } | { type: 'reset' };

export function initialEditor(parameters: OrnamentParameters, print: PrintAssumptions): EditorState {
  const printDrafts = printDraftsFor(print);
  return { parameters, print, drafts: draftsFor(parameters), errors: {}, revision: 0,
    printDrafts, printErrors: resolvePrint(parameters, printDrafts).errors, printRevision: 0 };
}

function resolveDrafts(base: OrnamentParameters, drafts: DraftValues): { parameters?: OrnamentParameters; errors: FieldErrors } {
  const candidate = structuredClone(base), errors: FieldErrors = {};
  for (const field of fields) {
    const text = drafts[field.id].trim().replace(',', '.');
    const number = Number(text);
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text) || !Number.isFinite(number)) {
      errors[field.id] = 'Zadejte konečné číslo.';
    } else if (number < field.min || number > field.max) {
      errors[field.id] = `Rozsah je ${field.min} až ${field.max}${field.unit ? ` ${field.unit}` : ''}.`;
    } else if ('integer' in field && field.integer && !Number.isInteger(number)) {
      errors[field.id] = 'Počet žeber musí být celé číslo.';
    } else setField(candidate, field.id, number);
  }
  if (Object.keys(errors).length) return { errors };
  const validated = ornamentSchema.safeParse(candidate);
  if (!validated.success) {
    for (const issue of validated.error.issues) {
      const id = issue.path.join('.') as FieldId;
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
    return { ...state, parameters, drafts: draftsFor(parameters), errors: {},
      ...withPrint(state, parameters, state.printDrafts), revision: state.revision + 1 };
  }
  if (action.type === 'printField') return { ...state, ...withPrint(state, state.parameters, { ...state.printDrafts, [action.id]: action.value }) };
  const drafts = { ...state.drafts, [action.id]: action.value };
  const resolved = resolveDrafts(state.parameters, drafts);
  if (!resolved.parameters) return { ...state, drafts, errors: resolved.errors };
  const changed = hashInput(resolved.parameters) !== hashInput(state.parameters);
  return { ...state, drafts, errors: {}, parameters: changed ? resolved.parameters : state.parameters,
    ...withPrint(state, resolved.parameters, state.printDrafts), revision: state.revision + (changed ? 1 : 0) };
}
