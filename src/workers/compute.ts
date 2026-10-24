import { GeometryError, generateMesh } from '../geometry/mesh';
import { validateMesh } from '../geometry/validate';
import { encodeStl } from '../io/stl';
import { requestHash, type GeometryRequest, type GeometryResponse } from './protocol';
import { createRenderData } from '../features/preview/renderData';
import { analyse } from '../analysis/report';
import { defaultPrint, printSchema, validateBottom } from '../domain/parameters';

export function compute(request: GeometryRequest): GeometryResponse {
  const identity = { requestId: request.requestId, revision: request.revision, kind: request.kind, inputHash: request.inputHash };
  try {
    if (!['mesh', 'stl'].includes(request.kind) || request.inputHash !== requestHash(request.parameters, request.kind, request.print))
      throw new GeometryError('INVALID_REQUEST', 'Nesouhlasí druh úlohy nebo hash vstupů.');
    const mesh = generateMesh(request.parameters, request.kind === 'stl' ? 'export' : 'preview');
    const validation = validateMesh(mesh);
    if (!validation.valid) throw new GeometryError('INVALID_MESH', validation.issues.map(i => i.message).join(' '));
    const print = request.kind === 'stl' ? printSchema.parse(request.print ?? defaultPrint) : defaultPrint;
    const bottomError = request.kind === 'stl' ? validateBottom(request.parameters, print) : null;
    if (bottomError) throw new GeometryError('INVALID_PRINT_INPUT', bottomError);
    const stl = request.kind === 'stl' ? encodeStl(mesh) : undefined;
    let analysis: Extract<GeometryResponse, { status: 'ready' }>['analysis'];
    if (request.kind === 'stl') {
      try { analysis = { status: 'ready', report: analyse(request.parameters, print, mesh) }; }
      catch (error) { analysis = { status: 'failed', message: error instanceof Error ? error.message : 'Finální analýza selhala.' }; }
    }
    const render = request.kind === 'mesh' ? createRenderData(mesh) : undefined;
    return { ...identity, status: 'ready', mesh, validation, render, stl, analysis };
  } catch (error) {
    return { ...identity, status: 'failed', error: {
      code: error instanceof GeometryError ? error.code : 'COMPUTATION_FAILED',
      message: error instanceof Error ? error.message : 'Výpočet selhal.',
    } };
  }
}
