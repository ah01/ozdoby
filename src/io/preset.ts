import { z } from 'zod';
import { ornamentSchema, printSchema, validateBottom } from '../domain/parameters';

export const GENERATOR_VERSION = '0.1.0';
export const settingsSchema = z.object({
  schemaVersion: z.literal(1), generatorVersion: z.string().min(1).max(80),
  parameters: ornamentSchema, print: printSchema,
}).strict().superRefine((value, context) => {
  const error = validateBottom(value.parameters, value.print);
  if (error) context.addIssue({ code: 'custom', path: ['print', 'bottomSolidLayers'], message: error });
});
export type Settings = z.infer<typeof settingsSchema>;
export function parseSettings(json: string): Settings { return settingsSchema.parse(JSON.parse(json)); }
export function serializeSettings(settings: Settings): string { return JSON.stringify(settingsSchema.parse(settings), null, 2) + '\n'; }

/** Stable key ordering; hash is a cache/revision identity, not a security primitive. */
export function hashInput(input: unknown): string {
  const canonical = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonical);
    if (value !== null && typeof value === 'object')
      return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => [k, canonical(v)]));
    return value;
  };
  let hash = 0x811c9dc5;
  for (const c of JSON.stringify(canonical(input))) { hash ^= c.charCodeAt(0); hash = Math.imul(hash, 0x01000193); }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
