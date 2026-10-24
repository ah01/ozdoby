import { z } from 'zod';
import { bodyRadius, POINT_TIP_WEIGHT, smoothstep } from './shapeMath';

const mm = (min: number, max: number) => z.number().finite().min(min).max(max);

export const ornamentSchema = z.object({
  schemaVersion: z.literal(1),
  shape: z.enum(['round', 'elongated', 'drop', 'egg', 'diamond']),
  body: z.object({
    baseDiameterMm: mm(30, 100), heightMm: mm(35, 140),
    maxRadiusAt: mm(0.3, 0.7), tipRadiusMm: mm(0, 3),
  }).strict(),
  neck: z.object({ diameterMm: mm(5, 24), lengthMm: mm(5, 16) }).strict(),
  surface: z.object({
    ribs: z.number().int().min(3).max(24), amplitudeMm: mm(0, 4),
    twistDeg: mm(-180, 180), blendLengthMm: mm(4, 20),
    amplitudeProfile: z.enum(['uniform', 'middle', 'neck']).default('uniform'),
    twistProfile: z.enum(['smooth', 'linear', 'reverse']).default('smooth'),
    ribShape: z.enum(['rounded', 'narrow', 'broad']).default('rounded'),
    ribRotationDeg: mm(0, 360).default(0),
    waveAmplitudeMm: mm(0, 2).default(0),
    waveCount: z.number().int().min(1).max(12).default(4),
    waveShiftPercent: mm(0, 100).default(0),
  }).strict(),
}).strict().superRefine((p, context) => {
  if (p.neck.diameterMm >= p.body.baseDiameterMm)
    context.addIssue({ code: 'custom', path: ['neck', 'diameterMm'], message: 'Krček musí být užší než tělo.' });
  if (p.body.tipRadiusMm >= p.body.baseDiameterMm / 2)
    context.addIssue({ code: 'custom', path: ['body', 'tipRadiusMm'], message: 'Zakončení musí být užší než tělo.' });
  if (p.surface.blendLengthMm > p.body.heightMm / 2)
    context.addIssue({ code: 'custom', path: ['surface', 'blendLengthMm'], message: 'Náběh smí zabírat nejvýše polovinu výšky těla.' });
  // Both rib waveforms and horizontal waves stay in [-1,1]. Their combined
  // amplitude and original blend give a conservative radial lower envelope.
  // The blend further protects both interfaces, but this conservative test is sufficient.
  const combinedAmplitude = p.surface.amplitudeMm + p.surface.waveAmplitudeMm;
  if (combinedAmplitude >= Math.min(p.neck.diameterMm / 2, p.body.tipRadiusMm)) {
    // Every profile is monotone between the neck, maximum and tip. Additional
    // amplitude weights are in [0,1], so the original blend is a safe upper bound.
    // The sharper envelope is implemented without depending on the mesh resolution.
    const h = p.body.heightMm, peak = p.body.maxRadiusAt;
    const radius = (u: number) => bodyRadius(p, u);
    const cuts = [...new Set([0, peak, p.surface.blendLengthMm / h, 1 - p.surface.blendLengthMm / h, 1])].sort((a, b) => a - b);
    let positive = true;
    const check = (lo: number, hi: number, depth: number): void => {
      // The only permitted axis contact is the final point. In a terminal tail,
      // r0 >= w*R*d/L, while deformation <= 3*A*d²/b² for d <= b.
      if (p.body.tipRadiusMm === 0 && hi === 1) {
        const d = h * (1 - lo), length = h * (1 - peak), b = p.surface.blendLengthMm;
        if (d <= Math.min(b, length) && POINT_TIP_WEIGHT * p.body.baseDiameterMm / 2 / length > 3 * combinedAmplitude * d / b ** 2) return;
      }
      const minBase = Math.min(radius(lo), radius(hi));
      const maxEnvelope = smoothstep(hi * h / p.surface.blendLengthMm) * smoothstep((1 - lo) * h / p.surface.blendLengthMm);
      if (minBase - combinedAmplitude * maxEnvelope > (p.body.tipRadiusMm === 0 ? 0 : 1e-6)) return;
      if (depth === 16) { positive = false; return; }
      const mid = (lo + hi) / 2;
      check(lo, mid, depth + 1); check(mid, hi, depth + 1);
    };
    for (let i = 1; i < cuts.length; i++) check(cuts[i - 1]!, cuts[i]!, 0);
    if (!positive) for (const id of ['amplitudeMm', 'waveAmplitudeMm'] as const)
      if (p.surface[id] > 0) context.addIssue({ code: 'custom', path: ['surface', id], message: 'Součet hloubky žeber a vln je příliš velký pro tento profil. Snižte hloubku nebo prodlužte náběh.' });
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
