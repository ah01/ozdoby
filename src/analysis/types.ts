import type { PrintAssumptions } from '../domain/parameters';

export const ANALYSIS_VERSION = '1.1.0';
export type RiskLevel = 'low' | 'warning' | 'high';
export type RiskCode = 0 | 1 | 2;
export interface AnalysisMessage {
  code: string; severity: 'info' | 'warning' | 'high'; title: string; detail: string; recommendation: string;
  zMinMm?: number; zMaxMm?: number; measured?: number; limit?: number;
}
export interface LayerBand {
  zMinMm: number; zMaxMm: number; upperDistanceMm: number; lowerDistanceMm: number;
  upperOverlap: number; lowerOverlap: number; risk: RiskCode;
  trend: 'expanding' | 'contracting' | 'mixed' | 'steady';
}
export interface LayerReport {
  bands: LayerBand[]; maxUpperDistanceMm: number; maxLowerDistanceMm: number;
  minUpperOverlap: number; minLowerOverlap: number; contourAngles: number;
  comparedSections: number; distanceQueries: number; minCurvatureRadiusMm: number | null;
}
export interface OverhangReport {
  anglesDeg: Float32Array; maxAngleDeg: number; riskyAreaMm2: number;
  evaluatedAreaMm2: number; riskyAreaFraction: number; riskyFaces: number;
  zMinMm: number | null; zMaxMm: number | null;
}
export interface AnalysisReport {
  algorithmVersion: string; assumptions: PrintAssumptions; risk: RiskLevel;
  messages: AnalysisMessage[]; overhang: OverhangReport; layers: LayerReport;
  tip: { diameterMm: number; smallContourLimitMm: number; risk: RiskCode };
  faceRisks: Uint8Array; colors: Float32Array;
}
export const riskLabels: Record<RiskLevel, string> = {
  low: 'Nízké geometrické riziko', warning: 'Geometrická varování', high: 'Vysoké geometrické riziko',
};

export interface AnalysisOptions {
  contourToleranceMm: number; maxDistanceQueries: number; maxSubdivisionsPerLayer: number;
  smallTipWidthMultiples: number; highOverhangExtraDeg: number; detailWidthMultiples: number;
}
export const defaultAnalysisOptions: AnalysisOptions = {
  contourToleranceMm: 0.005, maxDistanceQueries: 3_000_000, maxSubdivisionsPerLayer: 32,
  smallTipWidthMultiples: 6, highOverhangExtraDeg: 15, detailWidthMultiples: 1,
};
