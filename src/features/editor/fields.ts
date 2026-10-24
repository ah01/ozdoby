import type { OrnamentParameters } from '../../domain/parameters';

export const fields = [
  { id: 'body.baseDiameterMm', label: 'Průměr těla', min: 30, max: 100, step: 1, unit: 'mm', section: 'body' },
  { id: 'body.heightMm', label: 'Výška těla', min: 35, max: 140, step: 1, unit: 'mm', section: 'body' },
  { id: 'body.maxRadiusAt', label: 'Poloha nejširšího místa', min: 30, max: 70, step: 1, unit: '%', section: 'body', scale: 100 },
  { id: 'neck.diameterMm', label: 'Průměr krčku', min: 10, max: 24, step: 0.5, unit: 'mm', section: 'neck' },
  { id: 'neck.lengthMm', label: 'Délka krčku', min: 5, max: 16, step: 0.5, unit: 'mm', section: 'neck' },
  { id: 'surface.ribs', label: 'Počet žeber', min: 3, max: 24, step: 1, unit: '', section: 'surface', integer: true },
  { id: 'surface.amplitudeMm', label: 'Amplituda žeber', min: 0, max: 4, step: 0.1, unit: 'mm', section: 'surface' },
  { id: 'surface.twistDeg', label: 'Celkové zkroucení', min: -180, max: 180, step: 5, unit: '°', section: 'surface' },
  { id: 'surface.blendLengthMm', label: 'Délka náběhu', min: 4, max: 20, step: 0.5, unit: 'mm', section: 'advanced' },
  { id: 'body.tipRadiusMm', label: 'Poloměr zakončení', min: 0.8, max: 3, step: 0.1, unit: 'mm', section: 'advanced' },
] as const;
export type FieldId = typeof fields[number]['id'];
export type DraftValues = Record<FieldId, string>;
export type FieldErrors = Partial<Record<FieldId, string>>;

export function getField(p: OrnamentParameters, id: FieldId): number {
  const [group, property] = id.split('.') as [keyof Pick<OrnamentParameters, 'body' | 'neck' | 'surface'>, string];
  return (p[group] as unknown as Record<string, number>)[property]!;
}
export function setField(p: OrnamentParameters, id: FieldId, value: number): void {
  const [group, property] = id.split('.') as [keyof Pick<OrnamentParameters, 'body' | 'neck' | 'surface'>, string];
  (p[group] as unknown as Record<string, number>)[property] = value;
}
export function draftsFor(p: OrnamentParameters): DraftValues {
  return Object.fromEntries(fields.map(field => [field.id, String('scale' in field
    ? Number((getField(p, field.id) * field.scale).toFixed(10)) : getField(p, field.id))])) as DraftValues;
}
