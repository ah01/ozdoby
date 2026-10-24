import { z } from 'zod';

const mm = (min: number, max: number) => z.number().finite().min(min).max(max);

export const ornamentSchema = z.object({
  schemaVersion: z.literal(1),
  shape: z.enum(['round', 'elongated', 'drop']),
  body: z.object({
    baseDiameterMm: mm(30, 100), heightMm: mm(35, 140),
    maxRadiusAt: mm(0.3, 0.7), tipRadiusMm: mm(0.8, 3),
  }).strict(),
  neck: z.object({ diameterMm: mm(10, 24), lengthMm: mm(5, 16) }).strict(),
  surface: z.object({
    ribs: z.number().int().min(3).max(24), amplitudeMm: mm(0, 4),
    twistDeg: mm(-180, 180), blendLengthMm: mm(4, 20),
  }).strict(),
}).strict().superRefine((p, context) => {
  if (p.neck.diameterMm >= p.body.baseDiameterMm)
    context.addIssue({ code: 'custom', path: ['neck', 'diameterMm'], message: 'Krček musí být užší než tělo.' });
  if (p.body.tipRadiusMm >= p.body.baseDiameterMm / 2)
    context.addIssue({ code: 'custom', path: ['body', 'tipRadiusMm'], message: 'Zakončení musí být užší než tělo.' });
  if (p.surface.blendLengthMm > p.body.heightMm / 2)
    context.addIssue({ code: 'custom', path: ['surface', 'blendLengthMm'], message: 'Náběh smí zabírat nejvýše polovinu výšky těla.' });
  // Analytic lower envelope: r0 >= min(Rn, Rt); |A E cos| <= A.
  // The blend further protects both interfaces, but this conservative test is sufficient.
  if (p.surface.amplitudeMm >= Math.min(p.neck.diameterMm / 2, p.body.tipRadiusMm)) {
    // On each smoothstep interval, check a rigorous interval bound instead of vertices.
    // The sharper envelope is implemented without depending on the mesh resolution.
    const h = p.body.heightMm, peak = p.body.maxRadiusAt;
    const s = (t: number) => { const x = Math.max(0, Math.min(1, t)); return x * x * (3 - 2 * x); };
    const radius = (u: number) => u <= peak
      ? p.neck.diameterMm / 2 + (p.body.baseDiameterMm / 2 - p.neck.diameterMm / 2) * s(u / peak)
      : p.body.baseDiameterMm / 2 + (p.body.tipRadiusMm - p.body.baseDiameterMm / 2) * s((u - peak) / (1 - peak));
    const cuts = [...new Set([0, peak, p.surface.blendLengthMm / h, 1 - p.surface.blendLengthMm / h, 1])].sort((a, b) => a - b);
    let positive = true;
    const check = (lo: number, hi: number, depth: number): void => {
      const minBase = Math.min(radius(lo), radius(hi));
      const maxEnvelope = s(hi * h / p.surface.blendLengthMm) * s((1 - lo) * h / p.surface.blendLengthMm);
      if (minBase - p.surface.amplitudeMm * maxEnvelope > 1e-6) return;
      if (depth === 16) { positive = false; return; }
      const mid = (lo + hi) / 2;
      check(lo, mid, depth + 1); check(mid, hi, depth + 1);
    };
    for (let i = 1; i < cuts.length; i++) check(cuts[i - 1]!, cuts[i]!, 0);
    if (!positive) context.addIssue({ code: 'custom', path: ['surface', 'amplitudeMm'], message: 'Nelze zaručit kladný poloměr deformační obálky.' });
  }
});

export const printSchema = z.object({
  nozzleDiameterMm: mm(0.1, 2), extrusionWidthMm: mm(0.1, 3),
  layerHeightMm: mm(0.05, 1), firstLayerHeightMm: mm(0.05, 1),
  bottomSolidLayers: z.number().int().min(1).max(100),
  maxOverhangFromVerticalDeg: mm(0, 89), minOverlapRatio: mm(0, 1),
}).strict();

export type OrnamentParameters = z.infer<typeof ornamentSchema>;
export type ShapeId = OrnamentParameters['shape'];
export type PrintAssumptions = z.infer<typeof printSchema>;
export const defaultPrint: PrintAssumptions = {
  nozzleDiameterMm: 0.4, extrusionWidthMm: 0.45, layerHeightMm: 0.2,
  firstLayerHeightMm: 0.2, bottomSolidLayers: 3,
  maxOverhangFromVerticalDeg: 45, minOverlapRatio: 0.35,
};

export function validateBottom(p: OrnamentParameters, print: PrintAssumptions): string | null {
  const height = print.firstLayerHeightMm + (print.bottomSolidLayers - 1) * print.layerHeightMm;
  return height + print.layerHeightMm > p.neck.lengthMm
    ? 'Spodní plné vrstvy včetně rezervy jedné vrstvy musí zůstat uvnitř přímého krčku.' : null;
}
