export const stlDetails = {
  coarse: { label: 'Hrubší · 0,15 mm', toleranceMm: 0.15 },
  standard: { label: 'Standardní · 0,05 mm', toleranceMm: 0.05 },
  fine: { label: 'Jemné · 0,02 mm', toleranceMm: 0.02 },
} as const;
export type StlDetail = keyof typeof stlDetails;
export const defaultStlDetail: StlDetail = 'standard';
export const EXPORT_TRIANGLE_LIMIT = 2_000_000;
export const PREVIEW_TRIANGLE_LIMIT = 600_000;
