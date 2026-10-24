import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { parseSettings } from '../../src/io/preset';
import { readStl } from '../helpers/read-stl';
import { validateMesh } from '../../src/geometry/validate';

for (const mobile of [false, true]) test(`zero-radius point edits, persists and downloads on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }, testInfo) => {
  if (mobile) await page.setViewportSize({ width: 390, height: 844 });
  const ready = async () => {
    await expect(page.getByTestId('geometry-status')).toHaveAttribute('data-state', 'ready');
    await expect(page.getByTestId('analysis-status')).toHaveAttribute('data-state', 'ready');
  };
  await page.goto('/'); await ready();
  if (mobile) await page.getByRole('button', { name: 'Otevřít nastavení', exact: true }).click();
  await page.getByText('Diamant', { exact: true }).click();
  await page.getByLabel('Amplituda žeber', { exact: true }).fill('0,5');
  await page.getByLabel('Celkové zkroucení', { exact: true }).fill('60');
  await page.getByRole('button', { name: /^Vodorovné vlny/ }).click();
  await page.getByLabel('Hloubka vln', { exact: true }).fill('0,2');
  await page.getByRole('button', { name: 'Napojení a zakončení', exact: true }).click();
  await page.getByLabel('Poloměr zakončení', { exact: true }).fill('0,1'); await ready();
  const slider = page.getByRole('slider', { name: 'Poloměr zakončení – posuvník', exact: true });
  await slider.focus(); await slider.press('ArrowLeft');
  await expect(page.getByLabel('Poloměr zakončení', { exact: true })).toHaveValue('0 mm'); await ready();
  if (mobile) await page.getByRole('button', { name: 'Zavřít nastavení', exact: true }).click();
  await page.getByLabel('Mapa rizik', { exact: true }).check();
  await expect(page.getByTestId('preview')).not.toHaveAttribute('data-risk-map', 'off');
  const jsonPending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Uložit parametry JSON', exact: true }).click();
  const jsonPath = testInfo.outputPath('point.json'); await (await jsonPending).saveAs(jsonPath);
  expect(parseSettings(await readFile(jsonPath, 'utf8')).parameters.body.tipRadiusMm).toBe(0);
  const stlPending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Stáhnout STL ↓', exact: true }).click();
  const stlPath = testInfo.outputPath('point.stl'); await (await stlPending).saveAs(stlPath);
  const mesh = readStl(new Uint8Array(await readFile(stlPath)).buffer), validation = validateMesh(mesh);
  expect(validation.issues).toEqual([]); expect(validation.bounds.size[2]).toBe(98);
  const tips = Array.from({ length: mesh.positions.length / 3 }, (_, i) => i).filter(i => mesh.positions[3 * i + 2] === 98);
  expect(tips).toHaveLength(1);
  expect([...mesh.positions.slice(3 * tips[0]!, 3 * tips[0]! + 3)]).toEqual([0, 0, 98]);
  await page.getByTestId('analysis-details-button').click();
  await expect(page.getByText('Uzavření špičky ověřte ve sliceru', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByText('Nastavení uloženo v tomto prohlížeči', { exact: true })).toBeAttached();
  await page.reload(); await ready();
  if (mobile) await page.getByRole('button', { name: 'Otevřít nastavení', exact: true }).click();
  await page.getByRole('button', { name: 'Napojení a zakončení', exact: true }).click();
  await expect(page.getByLabel('Poloměr zakončení', { exact: true })).toHaveValue('0 mm');
  await page.getByLabel('Poloměr zakončení', { exact: true }).scrollIntoViewIfNeeded();
  if (mobile) {
    await page.getByRole('button', { name: 'Zavřít nastavení', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Nastavení baňky', exact: true })).toHaveCount(0);
  }
  await page.screenshot({ path: testInfo.outputPath(`pointed-${mobile ? 'mobile' : 'desktop'}.jpg`) });
});
