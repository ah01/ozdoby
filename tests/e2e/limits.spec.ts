import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { denseParameters } from '../helpers/dense-parameters';
import { defaultPrint } from '../../src/domain/parameters';
import { GENERATOR_VERSION } from '../../src/io/preset';
import { STORAGE_KEY } from '../../src/app/storage';
import { readStl } from '../helpers/read-stl';
import { validateMesh } from '../../src/geometry/validate';

test('5 mm neck exports on mobile and the risk switch works without opening analysis details', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Otevřít nastavení', exact: true }).click();
  await page.getByLabel('Průměr krčku', { exact: true }).fill('5');
  await page.getByRole('button', { name: 'Zavřít nastavení', exact: true }).click();
  await expect(page.getByTestId('geometry-status')).toHaveAttribute('data-state', 'ready');
  await expect(page.getByTestId('analysis-status')).toHaveAttribute('data-state', 'ready');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByLabel('Mapa rizik', { exact: true })).toBeInViewport();
  await page.getByLabel('Mapa rizik', { exact: true }).check();
  const hash = await page.getByTestId('analysis-status').getAttribute('data-input-hash');
  await expect(page.getByTestId('preview')).toHaveAttribute('data-risk-map', hash!);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Stáhnout STL ↓', exact: true }).click();
  const path = testInfo.outputPath('neck-5.stl'); await (await pending).saveAs(path);
  const mesh = readStl(new Uint8Array(await readFile(path)).buffer);
  expect(validateMesh(mesh).valid).toBe(true);
  for (let i = 0; i < mesh.positions.length; i += 3) if (mesh.positions[i + 2] === 0)
    expect(Math.hypot(mesh.positions[i]!, mesh.positions[i + 1]!)).toBeLessThanOrEqual(2.500001);
  await page.screenshot({ path: testInfo.outputPath('risk-map-mobile.jpg') });
});

test('dense ribs, waves and reverse twist complete geometry and current risk analysis', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1024, height: 768 });
  const parameters = denseParameters(); parameters.neck.diameterMm = 5;
  await page.addInitScript(({ key, settings }) => localStorage.setItem(key, JSON.stringify(settings)), {
    key: STORAGE_KEY, settings: { schemaVersion: 1, generatorVersion: GENERATOR_VERSION, parameters, print: defaultPrint },
  });
  await page.goto('/');
  await expect(page.getByLabel('Průměr krčku', { exact: true })).toHaveValue('5 mm');
  await expect(page.getByTestId('geometry-status')).toHaveAttribute('data-state', 'ready', { timeout: 60_000 });
  await expect(page.getByTestId('analysis-status')).toHaveAttribute('data-state', 'ready', { timeout: 120_000 });
  await page.getByLabel('Mapa rizik', { exact: true }).check();
  const hash = await page.getByTestId('analysis-status').getAttribute('data-input-hash');
  await expect(page.getByTestId('preview')).toHaveAttribute('data-risk-map', hash!);
  await expect(page.getByRole('button', { name: 'Stáhnout STL ↓', exact: true })).toBeEnabled();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('dense-risk-map.jpg') });
});
