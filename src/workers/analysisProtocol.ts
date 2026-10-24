import type { OrnamentParameters, PrintAssumptions } from '../domain/parameters';
import type { MeshData } from '../geometry/mesh';
import type { RequestIdentity } from './protocol';
import { ANALYSIS_VERSION, type AnalysisReport } from '../analysis/types';
import { hashInput } from '../io/preset';

export interface AnalysisRequest extends RequestIdentity<'analysis'> {
  parameters: OrnamentParameters; print: PrintAssumptions; mesh: MeshData;
}
export type AnalysisResponse = RequestIdentity<'analysis'> & (
  | { status: 'ready'; report: AnalysisReport }
  | { status: 'failed'; error: { code: string; message: string } }
);
export const analysisHash = (parameters: OrnamentParameters, print: PrintAssumptions): string =>
  hashInput({ algorithm: ANALYSIS_VERSION, parameters, print });
