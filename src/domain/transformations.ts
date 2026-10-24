export const amplitudeProfiles = { uniform: 'Celá výška', middle: 'Střed těla', neck: 'U krčku' } as const;
export const twistProfiles = { smooth: 'Plynulé', linear: 'Rovnoměrné', reverse: 'Tam a zpět' } as const;
export type SurfaceChoice = 'amplitudeProfile' | 'twistProfile';
