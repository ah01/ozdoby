import { printSchema, validateBottom, type OrnamentParameters, type PrintAssumptions } from '../../domain/parameters';

export const printFields = [
  { id: 'nozzleDiameterMm', label: 'Průměr trysky', min: 0.1, max: 2, step: 0.05, unit: 'mm', scale: 1 },
  { id: 'extrusionWidthMm', label: 'Šířka extruze', min: 0.1, max: 3, step: 0.05, unit: 'mm', scale: 1 },
  { id: 'layerHeightMm', label: 'Výška vrstvy', min: 0.05, max: 1, step: 0.05, unit: 'mm', scale: 1 },
  { id: 'firstLayerHeightMm', label: 'První vrstva', min: 0.05, max: 1, step: 0.05, unit: 'mm', scale: 1 },
  { id: 'bottomSolidLayers', label: 'Spodní plné vrstvy', min: 1, max: 100, step: 1, unit: '', scale: 1, integer: true },
  { id: 'maxOverhangFromVerticalDeg', label: 'Limit převisu od svislice', min: 0, max: 89, step: 1, unit: '°', scale: 1 },
  { id: 'minOverlapRatio', label: 'Požadovaný překryv', min: 0, max: 100, step: 5, unit: '%', scale: 100 },
] as const;
export type PrintFieldId = keyof PrintAssumptions;
export type PrintDrafts = Record<PrintFieldId, string>;
export type PrintErrors = Partial<Record<PrintFieldId, string>>;
export const printDraftsFor = (print: PrintAssumptions): PrintDrafts =>
  Object.fromEntries(printFields.map(f => [f.id, String(print[f.id] * f.scale)])) as PrintDrafts;

export function resolvePrint(p: OrnamentParameters, drafts: PrintDrafts): { print?: PrintAssumptions; errors: PrintErrors } {
  const candidate = {} as PrintAssumptions, errors: PrintErrors = {};
  for (const field of printFields) {
    const text = drafts[field.id].trim().replace(',', '.'), value = Number(text);
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text) || !Number.isFinite(value)) errors[field.id] = 'Zadejte konečné číslo.';
    else if (value < field.min || value > field.max) errors[field.id] = `Rozsah je ${field.min} až ${field.max} ${field.unit}.`;
    else if ('integer' in field && field.integer && !Number.isInteger(value)) errors[field.id] = 'Počet vrstev musí být celé číslo.';
    else candidate[field.id] = value / field.scale;
  }
  if (Object.keys(errors).length) return { errors };
  const validated = printSchema.safeParse(candidate);
  if (!validated.success) return { errors: { layerHeightMm: 'Neplatné tiskové předpoklady.' } };
  const bottomError = validateBottom(p, validated.data);
  return bottomError ? { errors: { bottomSolidLayers: bottomError } } : { print: validated.data, errors: {} };
}
