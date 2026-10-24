import type { OrnamentParameters } from '../../domain/parameters';
import type { SurfaceChoice } from '../../domain/transformations';

export const fields = [
  { id: 'body.baseDiameterMm', label: 'Průměr těla', min: 30, max: 100, step: 1, unit: 'mm', section: 'body' },
  { id: 'body.heightMm', label: 'Výška těla', min: 35, max: 140, step: 1, unit: 'mm', section: 'body' },
  { id: 'body.maxRadiusAt', label: 'Poloha nejširšího místa', min: 30, max: 70, step: 1, unit: '%', section: 'body', scale: 100 },
  { id: 'neck.diameterMm', label: 'Průměr krčku', min: 5, max: 24, step: 0.5, unit: 'mm', section: 'neck' },
  { id: 'neck.lengthMm', label: 'Délka krčku', min: 5, max: 16, step: 0.5, unit: 'mm', section: 'neck' },
  { id: 'surface.ribs', label: 'Počet žeber', min: 3, max: 24, step: 1, unit: '', section: 'ribs', integer: true },
  { id: 'surface.amplitudeMm', label: 'Amplituda žeber', min: 0, max: 4, step: 0.1, unit: 'mm', section: 'ribs', description: 'Hloubka žeber v poloměru. Nula žebra vypne.' },
  { id: 'surface.ribRotationDeg', label: 'Pootočení žeber', min: 0, max: 360, step: 5, unit: '°', section: 'ribs', description: 'Otočí celý vzor kolem osy. Nemění jeho zkroucení po výšce.' },
  { id: 'surface.twistDeg', label: 'Celkové zkroucení', min: -180, max: 180, step: 5, unit: '°', section: 'twist' },
  { id: 'surface.waveAmplitudeMm', label: 'Hloubka vln', min: 0, max: 2, step: 0.1, unit: 'mm', section: 'waves', description: 'Odchylka poloměru od siluety. Nula vlny vypne.' },
  { id: 'surface.waveCount', label: 'Počet vln po výšce', min: 1, max: 12, step: 1, unit: '', section: 'waves', integer: true },
  { id: 'surface.waveShiftPercent', label: 'Posun vln', min: 0, max: 100, step: 1, unit: '%', section: 'waves', description: 'Posune hřebeny o část jedné vlny. 100 % vrátí výchozí polohu.' },
  { id: 'surface.blendLengthMm', label: 'Délka náběhu', min: 4, max: 20, step: 0.5, unit: 'mm', section: 'advanced' },
  { id: 'body.tipRadiusMm', label: 'Poloměr zakončení', min: 0, max: 3, step: 0.1, unit: 'mm', section: 'advanced', description: 'Nula uzavře STL do špičky. Skutečné uzavření vase výtisku ověřte ve sliceru.' },
] as const;
export type FieldId = typeof fields[number]['id'];
export type FieldSection = typeof fields[number]['section'];
export type TransformSection = Extract<FieldSection, 'ribs' | 'twist' | 'waves'>;
export type DraftValues = Record<FieldId, string>;
export type ErrorField = FieldId | `surface.${SurfaceChoice}`;
export type FieldErrors = Partial<Record<ErrorField, string>>;

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
