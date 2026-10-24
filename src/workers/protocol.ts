import { defaultPrint, type OrnamentParameters, type PrintAssumptions } from '../domain/parameters';
import type { MeshResult } from '../geometry/mesh';
import type { MeshValidation } from '../geometry/validate';
import { hashInput } from '../io/preset';
import type { RenderData } from '../features/preview/renderData';
import type { AnalysisReport } from '../analysis/types';
import { defaultStlDetail, type StlDetail } from '../domain/stlDetail';

export interface RequestIdentity<K extends string = 'mesh' | 'stl'> { requestId: number; revision: number; kind: K; inputHash: string }
export interface GeometryRequest extends RequestIdentity { parameters: OrnamentParameters; print?: PrintAssumptions; stlDetail?: StlDetail }
export type GeometryResponse = RequestIdentity & (
  | { status: 'ready'; mesh: MeshResult; validation: MeshValidation; render?: RenderData; stl?: ArrayBuffer;
      analysis?: { status: 'ready'; report: AnalysisReport } | { status: 'failed'; message: string } }
  | { status: 'failed'; error: { code: string; message: string } }
);
export const requestHash = (parameters: OrnamentParameters, kind: GeometryRequest['kind'], print: PrintAssumptions = defaultPrint, stlDetail: StlDetail = defaultStlDetail): string =>
  hashInput({ generator: '0.1.0', kind, parameters, ...(kind === 'stl' ? { print, stlDetail } : {}) });

export function isCurrentResponse(response: RequestIdentity<string>, current: RequestIdentity<string>): boolean {
  return response.requestId === current.requestId && response.revision === current.revision
    && response.kind === current.kind && response.inputHash === current.inputHash;
}
