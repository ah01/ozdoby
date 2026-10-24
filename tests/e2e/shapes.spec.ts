import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { parseSettings } from '../../src/io/preset';
import { generateMesh } from '../../src/geometry/mesh';
import { encodeStl } from '../../src/io/stl';
import { validateMesh } from '../../src/geometry/validate';
import { readStl } from '../helpers/read-stl';

const ready = async (page: Page) => {
  await expect(page.getByTestId('geometry-status')).toHaveAttribute('data-state', 'ready');
  await expect(page.getByTestId('analysis-status')).toHaveAttribute('data-state', 'ready');
};
const choose = async (page: Page, name: string, option: string) => {
  await page.getByRole('combobox', { name, exact: true }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
};

test('new silhouettes and transformations persist and export the same geometry as their JSON', async ({ page }, testInfo) => {
  await page.goto('/'); await ready(page);
  await page.getByText('Vejce', { exact: true }).click(); await ready(page);
  await expect(page.getByLabel('Poloha nejširšího místa', { exact: true })).toHaveValue('58 %');
  await expect(page.getByTestId('actual-dimensions')).toHaveText('56 × 56 × 84 mm');
  await page.getByLabel('Poloha nejširšího místa', { exact: true }).fill('44');
  await page.getByLabel('Počet žeber', { exact: true }).fill('8');
  await page.getByLabel('Amplituda žeber', { exact: true }).fill('0,8');
  await page.getByLabel('Celkové zkroucení', { exact: true }).fill('60');
  await choose(page, 'Rozložení hloubky žeber', 'Střed těla');
  await choose(page, 'Průběh zkroucení', 'Tam a zpět'); await ready(page);
  await expect(page.getByLabel('Rozsah zkroucení', { exact: true })).toHaveValue('60 °');
  await expect(page.getByText('Nastavení uloženo v tomto prohlížeči', { exact: true })).toBeVisible();
  await page.reload(); await ready(page);
  await expect(page.getByRole('combobox', { name: 'Průběh zkroucení', exact: true })).toHaveValue('Tam a zpět');
  await expect(page.getByRole('combobox', { name: 'Rozložení hloubky žeber', exact: true })).toHaveValue('Střed těla');
  const jsonPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Uložit parametry JSON', exact: true }).click();
  const jsonPath = testInfo.outputPath('egg.json'); await (await jsonPromise).saveAs(jsonPath);
  const settings = parseSettings(await readFile(jsonPath, 'utf8'));
  expect(settings.parameters.shape).toBe('egg'); expect(settings.parameters.body.maxRadiusAt).toBe(0.44);
  expect(settings.parameters.surface).toMatchObject({ amplitudeProfile: 'middle', twistProfile: 'reverse' });
  const stlPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Stáhnout STL ↓', exact: true }).click();
  const stlPath = testInfo.outputPath('egg.stl'); await (await stlPromise).saveAs(stlPath);
  const bytes = new Uint8Array(await readFile(stlPath));
  expect(bytes).toEqual(new Uint8Array(encodeStl(generateMesh(settings.parameters))));
  expect(validateMesh(readStl(bytes.buffer)).valid).toBe(true);
  await page.getByRole('combobox', { name: 'Průběh zkroucení', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('egg-transformations.jpg') });
  await page.getByText('Diamant', { exact: true }).click(); await ready(page);
  await expect(page.getByLabel('Poloha nejširšího místa', { exact: true })).toHaveValue('50 %');
  await expect(page.getByLabel('Amplituda žeber', { exact: true })).toHaveValue('0 mm');
  await expect(page.getByRole('combobox', { name: 'Průběh zkroucení', exact: true })).toHaveValue('Plynulé');
  await expect(page.getByTestId('actual-dimensions')).toHaveText('56 × 56 × 98 mm');
  await page.getByRole('heading', { name: 'Silueta a rozměry', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('diamond.jpg') });
});

test('new shape controls fit the mobile drawer and reset restores the selected silhouette', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/'); await ready(page);
  await page.getByRole('button', { name: 'Otevřít nastavení', exact: true }).click();
  await page.getByText('Diamant', { exact: true }).click(); await ready(page);
  await page.getByLabel('Amplituda žeber', { exact: true }).fill('0,5');
  await choose(page, 'Rozložení hloubky žeber', 'U krčku');
  await choose(page, 'Průběh zkroucení', 'Rovnoměrné'); await ready(page);
  await page.getByRole('button', { name: 'Obnovit výchozí tvar', exact: true }).click(); await ready(page);
  await expect(page.getByRole('combobox', { name: 'Rozložení hloubky žeber', exact: true })).toHaveValue('Celá výška');
  await expect(page.getByLabel('Amplituda žeber', { exact: true })).toHaveValue('0 mm');
  await page.getByRole('button', { name: 'Zavřít nastavení', exact: true }).click();
  await expect(page.getByTestId('actual-dimensions')).toHaveText('56 × 56 × 98 mm');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
