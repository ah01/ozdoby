import type { OrnamentParameters, PrintAssumptions } from '../domain/parameters';
import { GeometryError } from '../geometry/mesh';
import { ribPhase, surfaceAmplitude, surfaceRadius } from '../geometry/surface';
import { angularSecondBound, derivativeBounds, surfaceKnots } from '../geometry/surfaceBounds';
import { ribDerivatives } from '../domain/shapeMath';
import { localDerivativeBounds } from '../geometry/localBounds';
import { SegmentIndex } from './segmentIndex';
import { defaultAnalysisOptions, type AnalysisOptions, type LayerBand, type LayerReport, type RiskCode } from './types';

export interface AnalysisSurface {
  heightMm: number; radius: (theta: number, z: number) => number; circular: boolean;
  angularSecondBound: number; zSecondBound: number; minimumAngles: number; knots: number[];
  zSecondBoundOn?: (lo: number, hi: number) => number;
  curvatureRadius?: (theta: number, z: number) => number;
}
export function ornamentSurface(p: OrnamentParameters): AnalysisSurface {
  const h = p.body.heightMm, n = p.neck.lengthMm;
  const a = p.surface.amplitudeMm, k = p.surface.ribs;
  const knots = surfaceKnots(p);
  const zSecondBound = Math.max(...knots.slice(1).map((hi, i) => derivativeBounds(p, knots[i]!, hi)[2]));
  return { heightMm: n + h, radius: (theta, z) => surfaceRadius(p, theta, z), circular: a === 0,
    angularSecondBound: angularSecondBound(p),
    zSecondBound,
    zSecondBoundOn: (lo, hi) => {
      const cuts = [lo, ...knots.filter(z => z > lo && z < hi), hi];
      return Math.max(...cuts.slice(1).map((upper, i) => localDerivativeBounds(p, cuts[i]!, upper)[2]));
    },
    minimumAngles: Math.max(128, 16 * k), knots,
    curvatureRadius: a === 0 ? undefined : (theta, z) => {
      const amplitude = surfaceAmplitude(p, z);
      if (amplitude < 1e-8) return Infinity;
      const [waveFirst, waveSecond] = ribDerivatives(p, ribPhase(p, theta, z));
      const radius = surfaceRadius(p, theta, z), first = amplitude * k * waveFirst, second = amplitude * k * k * waveSecond;
      const curvature = Math.abs(radius ** 2 + 2 * first ** 2 - radius * second) / (radius ** 2 + first ** 2) ** 1.5;
      return curvature > 1e-12 ? 1 / curvature : Infinity;
    },
  };
}
export const overlapEstimate = (distance: number, width: number): number => Math.max(0, Math.min(1, 1 - distance / width));

export function analyseLayers(surface: AnalysisSurface, print: PrintAssumptions, options: AnalysisOptions = defaultAnalysisOptions): LayerReport {
  const tolerance = Math.min(options.contourToleranceMm, print.extrusionWidthMm * 0.02);
  const angles = surface.circular ? 0 : Math.ceil(Math.max(surface.minimumAngles,
    2 * Math.PI * Math.sqrt(surface.angularSecondBound / (8 * tolerance))) / 4) * 4;
  const bottom = print.firstLayerHeightMm + (print.bottomSolidLayers - 1) * print.layerHeightMm;
  const bands: LayerBand[] = [];
  let comparedSections = 0, distanceQueries = 0, minCurvature = Infinity;
  const contour = (z: number) => {
    const xy = new Float64Array(angles * 2), radii = new Float64Array(angles);
    for (let i = 0; i < angles; i++) {
      const theta = i * 2 * Math.PI / angles, radius = surface.radius(theta, z);
      radii[i] = radius; xy[i * 2] = radius * Math.cos(theta); xy[i * 2 + 1] = radius * Math.sin(theta);
      if (surface.curvatureRadius) minCurvature = Math.min(minCurvature, surface.curvatureRadius(theta, z));
    }
    return { xy, radii, index: new SegmentIndex(xy) };
  };
  let lower = angles ? contour(bottom) : null;
  for (let layer = 0; bottom + layer * print.layerHeightMm < surface.heightMm - 1e-9; layer++) {
    const z0 = bottom + layer * print.layerHeightMm, z1 = Math.min(surface.heightMm, bottom + (layer + 1) * print.layerHeightMm);
    const secondBound = surface.zSecondBoundOn?.(z0, z1) ?? surface.zSecondBound;
    const subdivisions = Math.max(2, Math.ceil((z1 - z0) * Math.sqrt(secondBound / (8 * tolerance))));
    if (subdivisions > options.maxSubdivisionsPerLayer) throw new GeometryError('ANALYSIS_LIMIT', 'Analýza vyžaduje příliš mnoho mezivrstvových vzorků. Snižte hloubku žeber či vln, počet vln nebo zkroucení; validní STL lze stáhnout bez dokončené analýzy.');
    const samples = [...new Set([...Array.from({ length: subdivisions }, (_, i) => z0 + (z1 - z0) * (i + 1) / subdivisions),
      ...surface.knots.filter(z => z > z0 && z < z1)])].sort((a, b) => a - b);
    let upperDistanceMm = 0, lowerDistanceMm = 0, expanding = false, contracting = false;
    let lastContour = lower;
    for (const z of samples) {
      comparedSections++;
      if (surface.circular) {
        const delta = surface.radius(0, z) - surface.radius(0, z0);
        upperDistanceMm = Math.max(upperDistanceMm, Math.abs(delta)); lowerDistanceMm = Math.max(lowerDistanceMm, Math.abs(delta));
        expanding ||= delta > 1e-7; contracting ||= delta < -1e-7;
      } else {
        distanceQueries += 2 * angles;
        if (distanceQueries > options.maxDistanceQueries) throw new GeometryError('ANALYSIS_LIMIT', 'Analýza překročila limit vzorkování. Snižte hloubku či počet žeber a vln nebo zkroucení, nebo stáhněte STL bez dokončené analýzy.');
        const upper = contour(z); lastContour = upper;
        for (let i = 0; i < angles; i++) {
          upperDistanceMm = Math.max(upperDistanceMm, lower!.index.distance(upper.xy[2 * i]!, upper.xy[2 * i + 1]!, i));
          lowerDistanceMm = Math.max(lowerDistanceMm, upper.index.distance(lower!.xy[2 * i]!, lower!.xy[2 * i + 1]!, i));
          const delta = upper.radii[i]! - lower!.radii[i]!;
          expanding ||= delta > 1e-7; contracting ||= delta < -1e-7;
        }
      }
    }
    lower = lastContour;
    const upperOverlap = overlapEstimate(upperDistanceMm, print.extrusionWidthMm), lowerOverlap = overlapEstimate(lowerDistanceMm, print.extrusionWidthMm);
    const distance = Math.max(upperDistanceMm, lowerDistanceMm);
    const risk: RiskCode = distance >= print.extrusionWidthMm - 1e-9 ? 2 : Math.min(upperOverlap, lowerOverlap) < print.minOverlapRatio ? 1 : 0;
    bands.push({ zMinMm: z0, zMaxMm: z1, upperDistanceMm, lowerDistanceMm, upperOverlap, lowerOverlap, risk,
      trend: expanding && contracting ? 'mixed' : expanding ? 'expanding' : contracting ? 'contracting' : 'steady' });
  }
  return { bands, maxUpperDistanceMm: Math.max(0, ...bands.map(b => b.upperDistanceMm)),
    maxLowerDistanceMm: Math.max(0, ...bands.map(b => b.lowerDistanceMm)), minUpperOverlap: Math.min(1, ...bands.map(b => b.upperOverlap)),
    minLowerOverlap: Math.min(1, ...bands.map(b => b.lowerOverlap)), contourAngles: angles, comparedSections, distanceQueries,
    minCurvatureRadiusMm: Number.isFinite(minCurvature) ? minCurvature : null };
}
