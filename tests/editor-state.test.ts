import { expect, it } from 'vitest';
import { defaultPrint } from '../src/domain/parameters';
import { createPreset } from '../src/domain/presets';
import { editorReducer, initialEditor } from '../src/app/editorState';
import { readSavedSettings, saveSettings } from '../src/app/storage';
import { GENERATOR_VERSION, parseSettings } from '../src/io/preset';
import { generateMesh, FaceRegion } from '../src/geometry/mesh';
import { createRenderData } from '../src/features/preview/renderData';

it('keeps empty, incomplete, out-of-range and fractional drafts out of geometry', () => {
  const state = initialEditor(createPreset(), defaultPrint);
  for (const value of ['', '-', 'Infinity', 'NaN', '141']) {
    const next = editorReducer(state, { type: 'field', id: 'body.heightMm', value });
    expect(next.drafts['body.heightMm']).toBe(value);
    expect(next.errors['body.heightMm']).toBeTruthy();
    expect(next.parameters).toBe(state.parameters); expect(next.revision).toBe(0);
  }
  expect(editorReducer(state, { type: 'field', id: 'surface.ribs', value: '4.5' }).errors['surface.ribs']).toContain('celé');
});

it('resolves interdependent drafts together and changes revision only for a new valid model', () => {
  const parameters = createPreset(); parameters.surface.blendLengthMm = 20;
  const initial = initialEditor(parameters, defaultPrint);
  const invalid = editorReducer(initial, { type: 'field', id: 'body.heightMm', value: '35' });
  expect(invalid.errors['surface.blendLengthMm']).toBeTruthy(); expect(invalid.parameters.body.heightMm).toBe(88);
  const fixed = editorReducer(invalid, { type: 'field', id: 'surface.blendLengthMm', value: '4' });
  expect(fixed.errors).toEqual({}); expect(fixed.parameters.body.heightMm).toBe(35); expect(fixed.revision).toBe(1);
  const formatted = editorReducer(fixed, { type: 'field', id: 'body.heightMm', value: '35.0' });
  expect(formatted.revision).toBe(1);
  const comma = editorReducer(formatted, { type: 'field', id: 'surface.amplitudeMm', value: '0,5' });
  expect(comma.parameters.surface.amplitudeMm).toBe(0.5);
});

it('presets and reset restore canonical profile values and clear invalid drafts', () => {
  let state = initialEditor(createPreset(), defaultPrint);
  state = editorReducer(state, { type: 'field', id: 'body.heightMm', value: '' });
  state = editorReducer(state, { type: 'preset', shape: 'drop' });
  expect(state.errors).toEqual({}); expect(state.parameters.body.maxRadiusAt).toBe(0.65);
  state = editorReducer(state, { type: 'field', id: 'surface.amplitudeMm', value: '1' });
  expect(editorReducer(state, { type: 'reset' }).parameters).toEqual(createPreset('drop'));
});

it('edits peak position in percent, revises transformations and resets their defaults', () => {
  let state = initialEditor(createPreset('egg'), defaultPrint);
  expect(state.drafts['body.maxRadiusAt']).toBe('58');
  state = editorReducer(state, { type: 'field', id: 'body.maxRadiusAt', value: '42' });
  expect(state.parameters.body.maxRadiusAt).toBe(0.42);
  state = editorReducer(state, { type: 'surfaceChoice', id: 'amplitudeProfile', value: 'middle' });
  state = editorReducer(state, { type: 'surfaceChoice', id: 'twistProfile', value: 'reverse' });
  expect(state.revision).toBe(3); expect(state.parameters.surface.twistProfile).toBe('reverse');
  const reset = editorReducer(state, { type: 'reset' });
  expect(reset.parameters).toEqual(createPreset('egg')); expect(reset.errors).toEqual({});
});

it('resets each transformation independently and preserves unrelated dimensions and choices', () => {
  let state = initialEditor(createPreset('diamond'), defaultPrint);
  for (const [id, value] of [['body.heightMm', '110'], ['surface.amplitudeMm', '0.8'], ['surface.twistDeg', '60'], ['surface.waveAmplitudeMm', '0.4']] as const)
    state = editorReducer(state, { type: 'field', id, value });
  state = editorReducer(state, { type: 'surfaceChoice', id: 'ribShape', value: 'broad' });
  state = editorReducer(state, { type: 'resetSection', section: 'waves' });
  expect(state.parameters.surface.waveAmplitudeMm).toBe(0); expect(state.parameters.surface.amplitudeMm).toBe(0.8);
  expect(state.parameters.surface.twistDeg).toBe(60); expect(state.parameters.body.heightMm).toBe(110);
  state = editorReducer(state, { type: 'resetSection', section: 'twist' });
  expect(state.parameters.surface.twistDeg).toBe(0); expect(state.parameters.surface.ribShape).toBe('broad');
  state = editorReducer(state, { type: 'resetSection', section: 'ribs' });
  expect(state.parameters.surface.ribShape).toBe('rounded'); expect(state.parameters.surface.amplitudeMm).toBe(0);
  expect(state.parameters.body.heightMm).toBe(110);
});

it('keeps choice drafts while a numeric value is invalid and auto-resolves a section reset', () => {
  let state = initialEditor(createPreset(), defaultPrint);
  state = editorReducer(state, { type: 'field', id: 'surface.waveCount', value: '2.5' });
  state = editorReducer(state, { type: 'surfaceChoice', id: 'ribShape', value: 'narrow' });
  expect(state.choices.ribShape).toBe('narrow'); expect(state.parameters.surface.ribShape).toBe('rounded');
  expect(state.errors['surface.waveCount']).toContain('celé');
  state = editorReducer(state, { type: 'resetSection', section: 'waves' });
  expect(state.errors).toEqual({}); expect(state.parameters.surface.ribShape).toBe('narrow');
  expect(state.revision).toBe(1);
});

it('retains the bottom-layer clearance constraint when the neck changes', () => {
  const state = initialEditor(createPreset(), { ...defaultPrint, bottomSolidLayers: 30 });
  const next = editorReducer(state, { type: 'field', id: 'neck.lengthMm', value: '6' });
  expect(next.printErrors.bottomSolidLayers).toContain('Spodní plné vrstvy');
});

it('revalidates saved print assumptions when a preset restores a shorter neck', () => {
  const parameters = createPreset(); parameters.neck.lengthMm = 16;
  const state = initialEditor(parameters, { ...defaultPrint, bottomSolidLayers: 50 });
  const preset = editorReducer(state, { type: 'preset', shape: 'round' });
  expect(preset.printErrors.bottomSolidLayers).toContain('Spodní plné vrstvy');
  const corrected = editorReducer(preset, { type: 'field', id: 'neck.lengthMm', value: '16' });
  expect(corrected.errors).toEqual({}); expect(corrected.parameters.shape).toBe('round');
  expect(corrected.printErrors).toEqual({});
});

it('print-only changes preserve geometry identity and use independent revision and errors', () => {
  const state = initialEditor(createPreset(), defaultPrint);
  const next = editorReducer(state, { type: 'printField', id: 'extrusionWidthMm', value: '0.6' });
  expect(next.parameters).toBe(state.parameters); expect(next.revision).toBe(0); expect(next.printRevision).toBe(1);
  expect(next.print.extrusionWidthMm).toBe(0.6);
  const bad = editorReducer(next, { type: 'printField', id: 'bottomSolidLayers', value: '1.5' });
  expect(bad.printErrors.bottomSolidLayers).toContain('celé'); expect(bad.parameters).toBe(state.parameters);
});

it('handles corrupt, unknown-version and inaccessible local storage and round-trips settings', () => {
  for (const getItem of [() => '{', () => '{"schemaVersion":2}', () => { throw new Error('blocked'); }]) {
    const restored = readSavedSettings({ getItem });
    expect(restored.settings.parameters).toEqual(createPreset()); expect(restored.notice).toBeTruthy();
  }
  const settings = { schemaVersion: 1 as const, generatorVersion: GENERATOR_VERSION, parameters: createPreset('drop'), print: defaultPrint };
  let json = '';
  expect(saveSettings({ setItem: (_key, value) => { json = value; } }, settings)).toBe('');
  expect(parseSettings(json)).toEqual(settings);
  expect(saveSettings({ setItem: () => { throw new Error('Quota'); } }, settings)).toContain('JSON');
});

it('creates a render copy without changing canonical geometry, with flat caps and unit normals', () => {
  const mesh = generateMesh(createPreset(), 'preview');
  const original = mesh.positions.slice(), originalIndices = mesh.indices.slice();
  const render = createRenderData(mesh);
  expect(mesh.positions).toEqual(original); expect(mesh.indices).toEqual(originalIndices);
  expect(render.positions).toHaveLength(mesh.indices.length * 3);
  let normalError = 0;
  for (let v = 0; v < render.normals.length; v += 3)
    normalError = Math.max(normalError, Math.abs(Math.hypot(render.normals[v]!, render.normals[v + 1]!, render.normals[v + 2]!) - 1));
  expect(normalError).toBeLessThan(1e-6);
  const cap = mesh.faceRegions.findIndex(region => region === FaceRegion.baseCap);
  expect([...render.normals.slice(cap * 9, cap * 9 + 3)]).toEqual([0, 0, -1]);
});
