import { expect, it } from 'vitest';
import { createPreset } from '../src/domain/presets';
import { defaultPrint } from '../src/domain/parameters';
import { compute } from '../src/workers/compute';
import { isCurrentResponse, requestHash } from '../src/workers/protocol';
import { GENERATOR_VERSION, hashInput, parseSettings, serializeSettings } from '../src/io/preset';

it('rejects delayed revisions, kinds, IDs and hashes even if they arrive last', () => {
  const parameters = createPreset(), current = { requestId: 12, revision: 4, kind: 'mesh' as const, inputHash: requestHash(parameters, 'mesh') };
  expect(isCurrentResponse(current, current)).toBe(true);
  for (const old of [{ ...current, requestId: 11 }, { ...current, revision: 3 },
    { ...current, kind: 'stl' as const }, { ...current, inputHash: 'old' }])
    expect(isCurrentResponse(old, current)).toBe(false);
  const result = compute({ ...current, parameters });
  expect(result.status).toBe('ready'); expect(isCurrentResponse(result, current)).toBe(true);
});

it('returns structured failures instead of throwing across the worker boundary', () => {
  const parameters = createPreset(), request = { requestId: 1, revision: 0, kind: 'mesh' as const, inputHash: 'bad', parameters };
  expect(compute(request)).toMatchObject({ status: 'failed', error: { code: 'INVALID_REQUEST' } });
  parameters.body.heightMm = NaN; request.inputHash = requestHash(parameters, 'mesh');
  expect(compute(request)).toMatchObject({ status: 'failed', error: { code: 'INVALID_PARAMETERS' } });
});

it('restores the exact parameter and print contract and refuses unknown keys', () => {
  const settings = { schemaVersion: 1 as const, generatorVersion: GENERATOR_VERSION, parameters: createPreset(), print: defaultPrint };
  expect(parseSettings(serializeSettings(settings))).toEqual(settings);
  expect(() => parseSettings('{')).toThrow();
  expect(() => parseSettings(JSON.stringify({ ...settings, schemaVersion: 2 }))).toThrow();
  expect(() => parseSettings(JSON.stringify({ ...settings, unexpected: true }))).toThrow();
  expect(() => parseSettings(JSON.stringify({ ...settings, print: { ...defaultPrint, bottomSolidLayers: 100 } }))).toThrow();
  expect(hashInput({ b: 2, a: 1 })).toBe(hashInput({ a: 1, b: 2 }));
});
