import { ornamentSchema, validateBottom, type OrnamentParameters, type PrintAssumptions, type ShapeId } from '../domain/parameters';
import { createPreset } from '../domain/presets';
import { draftsFor, fields, setField, type DraftValues, type FieldErrors, type FieldId } from '../features/editor/fields';
import { hashInput } from '../io/preset';

export interface EditorState {
  parameters: OrnamentParameters;
  print: PrintAssumptions;
  drafts: DraftValues;
  errors: FieldErrors;
  revision: number;
}
export type EditorAction = { type: 'field'; id: FieldId; value: string }
  | { type: 'preset'; shape: ShapeId } | { type: 'reset' };

export function initialEditor(parameters: OrnamentParameters, print: PrintAssumptions): EditorState {
  return { parameters, print, drafts: draftsFor(parameters), errors: {}, revision: 0 };
}

function resolveDrafts(base: OrnamentParameters, drafts: DraftValues, print: PrintAssumptions): { parameters?: OrnamentParameters; errors: FieldErrors } {
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
  const bottomError = validateBottom(validated.data, print);
  if (bottomError) return { errors: { 'neck.lengthMm': bottomError } };
  return { parameters: validated.data, errors };
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  if (action.type === 'preset' || action.type === 'reset') {
    const parameters = createPreset(action.type === 'preset' ? action.shape : state.parameters.shape);
    const bottomError = validateBottom(parameters, state.print);
    return { ...initialEditor(parameters, state.print),
      errors: bottomError ? { 'neck.lengthMm': bottomError } : {}, revision: state.revision + 1 };
  }
  const drafts = { ...state.drafts, [action.id]: action.value };
  const resolved = resolveDrafts(state.parameters, drafts, state.print);
  if (!resolved.parameters) return { ...state, drafts, errors: resolved.errors };
  const changed = hashInput(resolved.parameters) !== hashInput(state.parameters);
  return { ...state, drafts, errors: {}, parameters: resolved.parameters, revision: state.revision + (changed ? 1 : 0) };
}
