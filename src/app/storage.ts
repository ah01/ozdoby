import { defaultPrint } from '../domain/parameters';
import { createPreset } from '../domain/presets';
import { GENERATOR_VERSION, parseSettings, serializeSettings, type Settings } from '../io/preset';

export const STORAGE_KEY = 'bulb-studio:settings:v1';
export function readSavedSettings(storage: Pick<Storage, 'getItem'>): { settings: Settings; notice: string } {
  const defaults: Settings = { schemaVersion: 1, generatorVersion: GENERATOR_VERSION, parameters: createPreset(), print: { ...defaultPrint } };
  try {
    const json = storage.getItem(STORAGE_KEY);
    return { settings: json ? parseSettings(json) : defaults, notice: '' };
  } catch {
    return { settings: defaults, notice: 'Uložené nastavení nelze načíst. Používáme výchozí tvar; STL a JSON můžete dál stahovat.' };
  }
}
export function saveSettings(storage: Pick<Storage, 'setItem'>, settings: Settings): string {
  try { storage.setItem(STORAGE_KEY, serializeSettings(settings)); return ''; }
  catch { return 'Nastavení nelze uložit v tomto prohlížeči. Pro uchování použijte export JSON.'; }
}
