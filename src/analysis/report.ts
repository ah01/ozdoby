import { ornamentSchema, printSchema, validateBottom, type OrnamentParameters, type PrintAssumptions } from '../domain/parameters';
import { FaceRegion, GeometryError, type MeshData } from '../geometry/mesh';
import { analyseLayers, ornamentSurface } from './layerSupport';
import { analyseOverhang } from './overhang';
import { ANALYSIS_VERSION, defaultAnalysisOptions, type AnalysisMessage, type AnalysisOptions, type AnalysisReport, type RiskCode } from './types';

export function analyse(p: OrnamentParameters, print: PrintAssumptions, mesh: MeshData, options: AnalysisOptions = defaultAnalysisOptions): AnalysisReport {
  ornamentSchema.parse(p); printSchema.parse(print);
  const bottomError = validateBottom(p, print);
  if (bottomError) throw new GeometryError('INVALID_PRINT_INPUT', bottomError);
  const overhang = analyseOverhang(mesh, print.maxOverhangFromVerticalDeg);
  const layers = analyseLayers(ornamentSurface(p), print, options);
  const total = p.neck.lengthMm + p.body.heightMm;
  const tip = { diameterMm: 2 * p.body.tipRadiusMm, smallContourLimitMm: options.smallTipWidthMultiples * print.extrusionWidthMm,
    risk: (2 * p.body.tipRadiusMm < print.extrusionWidthMm * 2 ? 2
      : 2 * p.body.tipRadiusMm < options.smallTipWidthMultiples * print.extrusionWidthMm ? 1 : 0) as RiskCode };
  const messages: AnalysisMessage[] = [];
  if (overhang.riskyFaces) messages.push({ code: 'NORMAL_OVERHANG', severity: overhang.maxAngleDeg > print.maxOverhangFromVerticalDeg + options.highOverhangExtraDeg ? 'high' : 'warning',
    title: 'Rychlé rozšiřování povrchu', detail: 'Vnější normály ukazují rozšiřování nad zadaný limit od svislé stěny.',
    recommendation: 'Zvětšete výšku těla či délku náběhu, případně snižte hloubku žeber nebo vln.',
    zMinMm: overhang.zMinMm!, zMaxMm: overhang.zMaxMm!, measured: overhang.maxAngleDeg, limit: print.maxOverhangFromVerticalDeg });
  for (const direction of ['upper', 'lower'] as const) {
    const affected = layers.bands.filter(b => b[`${direction}Overlap`] < print.minOverlapRatio || b[`${direction}DistanceMm`] >= print.extrusionWidthMm - 1e-9);
    if (!affected.length) continue;
    const maxDistance = Math.max(...affected.map(b => b[`${direction}DistanceMm`]));
    const trends = [...new Set(affected.map(b => b.trend))];
    const trend = trends.includes('mixed') || trends.length > 1 ? 'Rozšiřování, zužování nebo twist mění obrys v obou směrech.'
      : trends[0] === 'contracting' ? 'Tělo se v této oblasti prudce zužuje.' : 'Tělo se v této oblasti rozšiřuje.';
    messages.push({ code: direction === 'upper' ? 'UPPER_SUPPORT' : 'LOWER_RETREAT', severity: maxDistance >= print.extrusionWidthMm - 1e-9 ? 'high' : 'warning',
      title: direction === 'upper' ? 'Nízký odhad opory nové vrstvy' : 'Prudká změna předchozího obrysu',
      detail: `${trend} ${direction === 'upper' ? 'Body vyššího obrysu jsou daleko od úseček nižšího.' : 'Body nižšího obrysu jsou daleko od úseček vyššího; mohou zanikat detaily.'}`,
      recommendation: 'Snižte vrstvu, hloubku žeber či vln nebo zkroucení; případně zvětšete výšku těla či délku náběhu.',
      zMinMm: Math.min(...affected.map(b => b.zMinMm)), zMaxMm: Math.max(...affected.map(b => b.zMaxMm)), measured: maxDistance,
      limit: print.extrusionWidthMm * (1 - print.minOverlapRatio) });
  }
  if (layers.minCurvatureRadiusMm !== null && layers.minCurvatureRadiusMm < print.extrusionWidthMm * options.detailWidthMultiples)
    messages.push({ code: 'FINE_DETAIL', severity: 'warning', title: 'Žebra mohou být příliš jemná',
      detail: 'Lokální poloměr křivosti obrysu je menší než řád šířky extruze. Offset ve sliceru může detail vyhladit nebo odstranit.',
      recommendation: 'Snižte počet žeber nebo amplitudu a zkontrolujte skutečnou dráhu ve sliceru.',
      zMinMm: p.neck.lengthMm, zMaxMm: total, measured: layers.minCurvatureRadiusMm, limit: print.extrusionWidthMm * options.detailWidthMultiples });
  messages.push({ code: 'OPEN_TIP', severity: 'info', title: p.body.tipRadiusMm === 0 ? 'Uzavření špičky ověřte ve sliceru' : 'Zakončení může zůstat otevřené',
    detail: p.body.tipRadiusMm === 0 ? 'STL končí v jediném vrcholu. Vase dráha může skončit dříve a na výtisku zanechat drobný otvor.'
      : 'Uzavírací disk STL není víčko vase výtisku. Ve vase režimu může na konci zůstat otvor přibližně podle posledního průřezu.',
    recommendation: 'Ověřte poslední obvody ve sliceru a otvor změřte na výtisku.', zMinMm: total - print.layerHeightMm * 2, zMaxMm: total, measured: tip.diameterMm });
  if (tip.risk) messages.push({ code: 'SMALL_TIP', severity: tip.risk === 2 ? 'high' : 'warning', title: 'Malý koncový obrys',
    detail: 'Koncový průměr je malý vůči šířce extruze. Jde o heuristiku rizika přehřívání či vynechání detailu, nikoli fyzikální záruku.',
    recommendation: 'Zvažte větší poloměr zakončení a ověřte chlazení a poslední dráhu ve sliceru.',
    zMinMm: Math.max(p.neck.lengthMm, total - Math.max(1, print.layerHeightMm * 4)), zMaxMm: total, measured: tip.diameterMm, limit: tip.smallContourLimitMm });
  messages.push({ code: 'BED_ADHESION', severity: 'info', title: 'Adheze kruhového krčku',
    detail: `Základna má průměr ${p.neck.diameterMm} mm. Samotná geometrie nepotvrzuje přilnavost k podložce.`,
    recommendation: 'Zvažte brim ve sliceru a ověřte první vrstvy.', zMinMm: 0, zMaxMm: p.neck.lengthMm });
  if (print.layerHeightMm > print.nozzleDiameterMm * 0.8 || print.firstLayerHeightMm > print.nozzleDiameterMm * 0.8
    || print.extrusionWidthMm < print.nozzleDiameterMm * 0.9 || print.extrusionWidthMm > print.nozzleDiameterMm * 2.5
    || print.layerHeightMm >= print.extrusionWidthMm)
    messages.push({ code: 'PRINT_PROPORTIONS', severity: 'warning', title: 'Prověřte tiskové předpoklady',
      detail: 'Poměr vrstvy, extruze a trysky je mimo orientační běžné meze. Z průměru trysky nelze odvodit univerzální tisknutelnost.',
      recommendation: 'Ověřte skutečnou výšku vrstvy a šířku extruze v profilu konkrétní tiskárny.' });
  messages.sort((a, b) => ({ high: 2, warning: 1, info: 0 }[b.severity] - { high: 2, warning: 1, info: 0 }[a.severity]));

  const faceRisks = new Uint8Array(mesh.indices.length / 3), colors = new Float32Array(mesh.indices.length * 3);
  const palette = [[0.15, 0.4, 0.24], [0.75, 0.4, 0.06], [0.65, 0.06, 0.04]];
  for (let f = 0; f < faceRisks.length; f++) {
    const zs = [0, 1, 2].map(corner => mesh.positions[mesh.indices[f * 3 + corner]! * 3 + 2]!);
    const zMin = Math.min(...zs), zMax = Math.max(...zs);
    let risk: number = overhang.anglesDeg[f]! > print.maxOverhangFromVerticalDeg + options.highOverhangExtraDeg ? 2
      : overhang.anglesDeg[f]! > print.maxOverhangFromVerticalDeg + 1e-6 ? 1 : 0;
    if (zMax > 1e-8 && mesh.faceRegions[f] !== FaceRegion.baseCap) {
      let lo = 0, hi = layers.bands.length;
      while (lo < hi) { const mid = (lo + hi) >>> 1; if (layers.bands[mid]!.zMaxMm < zMin) lo = mid + 1; else hi = mid; }
      for (let j = lo; j < layers.bands.length && layers.bands[j]!.zMinMm <= zMax; j++) risk = Math.max(risk, layers.bands[j]!.risk);
      if (zMax >= total - Math.max(1, print.layerHeightMm * 4)) risk = Math.max(risk, tip.risk);
    } else risk = 0;
    faceRisks[f] = risk;
    for (let corner = 0; corner < 3; corner++) colors.set(palette[risk]!, (f * 3 + corner) * 3);
  }
  return { algorithmVersion: ANALYSIS_VERSION, assumptions: { ...print },
    risk: messages.some(m => m.severity === 'high') ? 'high' : messages.some(m => m.severity === 'warning') ? 'warning' : 'low',
    messages, overhang, layers, tip, faceRisks, colors };
}
