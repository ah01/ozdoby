import { GeometryError, generateMesh } from '../geometry/mesh';
import { validateMesh } from '../geometry/validate';
import { encodeStl } from '../io/stl';
import { requestHash, type GeometryRequest, type GeometryResponse } from './protocol';
import { createRenderData } from '../features/preview/renderData';

export function compute(request: GeometryRequest): GeometryResponse {
  const identity = { requestId: request.requestId, revision: request.revision, kind: request.kind, inputHash: request.inputHash };
  try {
    if (!['mesh', 'stl'].includes(request.kind) || request.inputHash !== requestHash(request.parameters, request.kind))
      throw new GeometryError('INVALID_REQUEST', 'Nesouhlasí druh úlohy nebo hash vstupů.');
    const mesh = generateMesh(request.parameters, request.kind === 'stl' ? 'export' : 'preview');
    const validation = validateMesh(mesh);
    if (!validation.valid) throw new GeometryError('INVALID_MESH', validation.issues.map(i => i.message).join(' '));
    const stl = request.kind === 'stl' ? encodeStl(mesh) : undefined;
    const render = request.kind === 'mesh' ? createRenderData(mesh) : undefined;
    return { ...identity, status: 'ready', mesh, validation, render, stl };
  } catch (error) {
    return { ...identity, status: 'failed', error: {
      code: error instanceof GeometryError ? error.code : 'COMPUTATION_FAILED',
      message: error instanceof Error ? error.message : 'Výpočet selhal.',
    } };
  }
}
