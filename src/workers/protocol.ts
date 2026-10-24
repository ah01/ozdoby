import type { OrnamentParameters } from '../domain/parameters';
import type { MeshResult } from '../geometry/mesh';
import type { MeshValidation } from '../geometry/validate';
import { hashInput } from '../io/preset';

export interface RequestIdentity { requestId: number; revision: number; kind: 'mesh' | 'stl'; inputHash: string }
export interface GeometryRequest extends RequestIdentity { parameters: OrnamentParameters }
export type GeometryResponse = RequestIdentity & (
  | { status: 'ready'; mesh: MeshResult; validation: MeshValidation; stl?: ArrayBuffer }
  | { status: 'failed'; error: { code: string; message: string } }
);
export const requestHash = (parameters: OrnamentParameters, kind: GeometryRequest['kind']): string =>
  hashInput({ generator: '0.1.0', kind, parameters });

export function isCurrentResponse(response: RequestIdentity, current: RequestIdentity): boolean {
  return response.requestId === current.requestId && response.revision === current.revision
    && response.kind === current.kind && response.inputHash === current.inputHash;
}
