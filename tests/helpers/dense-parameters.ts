import { createPreset } from '../../src/domain/presets';

export function denseParameters() {
  const p = createPreset('elongated');
  Object.assign(p.body, { baseDiameterMm: 100, heightMm: 140, tipRadiusMm: 3 });
  Object.assign(p.surface, { blendLengthMm: 20, ribs: 24, amplitudeMm: 3, waveAmplitudeMm: 1,
    waveCount: 8, twistDeg: 180, twistProfile: 'reverse', ribShape: 'narrow' });
  return p;
}
