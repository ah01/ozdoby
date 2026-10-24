import type { OrnamentParameters, ShapeId } from './parameters';

export const presetLabels: Record<ShapeId, string> = {
  round: 'Zaoblená', elongated: 'Protáhlá', drop: 'Kapka', egg: 'Vejce', diamond: 'Diamant',
};

export function createPreset(shape: ShapeId = 'elongated'): OrnamentParameters {
  return {
    schemaVersion: 1, shape,
    body: { baseDiameterMm: 56, heightMm: shape === 'round' ? 60 : shape === 'drop' ? 84 : shape === 'egg' ? 76 : shape === 'diamond' ? 90 : 88,
      maxRadiusAt: shape === 'drop' ? 0.65 : shape === 'egg' ? 0.58 : 0.5, tipRadiusMm: 1.2 },
    neck: { diameterMm: 14, lengthMm: 8 },
    surface: { ribs: 12, amplitudeMm: 0, twistDeg: 0, blendLengthMm: 8, amplitudeProfile: 'uniform', twistProfile: 'smooth' },
  };
}
