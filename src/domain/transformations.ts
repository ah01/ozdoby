export const amplitudeProfiles = { uniform: 'Celá výška', middle: 'Střed těla', neck: 'U krčku' } as const;
export const twistProfiles = { smooth: 'Plynulé', linear: 'Rovnoměrné', reverse: 'Tam a zpět' } as const;
export const ribShapes = { rounded: 'Oblé', narrow: 'Úzké vrcholy', broad: 'Široké vrcholy' } as const;
export const choiceOptions = { amplitudeProfile: amplitudeProfiles, twistProfile: twistProfiles, ribShape: ribShapes };
export type SurfaceChoice = keyof typeof choiceOptions;
export type ChoiceDrafts = Record<SurfaceChoice, string>;
export const choiceSections = { amplitudeProfile: 'ribs', twistProfile: 'twist', ribShape: 'ribs' } as const;
