import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { readStl } from '../helpers/read-stl';
import { validateMesh } from '../../src/geometry/validate';

const ready = async (page: Page) => {
  await expect(page.getByTestId('geometry-status')).toHaveAttribute('data-state', 'ready');
  await expect(page.getByTestId('analysis-status')).toHaveAttribute('data-state', 'ready');
};

test('print-only edits replace the report without changing geometry revision or STL bytes', async ({ page }, testInfo) => {
  await page.goto('/'); await ready(page);
  const oldHash = await page.getByTestId('analysis-status').getAttribute('data-input-hash');
  const revision = await page.getByTestId('geometry-status').getAttribute('data-revision');
  const first = page.waitForEvent('download'); await page.getByRole('button', { name: 'Stáhnout STL ↓', exact: true }).click();
  const a = testInfo.outputPath('before.stl'); await (await first).saveAs(a);
  await page.getByRole('button', { name: 'Tiskové předpoklady', exact: true }).click();
  await page.getByLabel('Šířka extruze', { exact: true }).fill('0,65'); await ready(page);
  await expect(page.getByTestId('analysis-status')).not.toHaveAttribute('data-input-hash', oldHash!);
  await expect(page.getByTestId('geometry-status')).toHaveAttribute('data-revision', revision!);
  const second = page.waitForEvent('download'); await page.getByRole('button', { name: 'Stáhnout STL ↓', exact: true }).click();
  const b = testInfo.outputPath('after.stl'); await (await second).saveAs(b);
  expect(new Uint8Array(await readFile(a))).toEqual(new Uint8Array(await readFile(b)));
});

test('risk colors follow the latest print inputs and warning regions are localized', async ({ page }) => {
  await page.goto('/'); await ready(page);
  await page.getByLabel('Mapa rizik', { exact: true }).check();
  const initialHash = await page.getByTestId('analysis-status').getAttribute('data-input-hash');
  await expect(page.getByTestId('preview')).toHaveAttribute('data-risk-map', initialHash!);
  await page.getByRole('button', { name: 'Tiskové předpoklady', exact: true }).click();
  for (const value of ['75', '20', '35']) await page.getByLabel('Limit převisu od svislice', { exact: true }).fill(value);
  await ready(page);
  const hash = await page.getByTestId('analysis-status').getAttribute('data-input-hash');
  expect(hash).not.toBe(initialHash);
  await expect(page.getByTestId('preview')).toHaveAttribute('data-risk-map', hash!);
  await page.getByTestId('analysis-details-button').click();
  await page.getByRole('button', { name: /^Zvýraznit Z/ }).first().click();
  await expect(page.getByText(/^MAPA GEOMETRICKÝCH RIZIK · Z/)).toBeVisible();
  await page.getByLabel('Průměr těla', { exact: true }).fill('90');
  await page.getByLabel('Výška těla', { exact: true }).fill('35'); await ready(page);
  await expect(page.getByRole('button', { name: 'Podrobnosti analýzy: Vysoké geometrické riziko', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Stáhnout STL ↓', exact: true })).toBeEnabled();
});

test('a failed analysis is unassessed and keeps geometrically valid STL available', async ({ page }, testInfo) => {
  await page.route('**/analysis.worker.ts*', route => route.fulfill({ contentType: 'application/javascript', body: 'throw new Error("offline analysis worker");' }));
  await page.goto('/');
  await expect(page.getByTestId('geometry-status')).toHaveAttribute('data-state', 'ready');
  await expect(page.getByTestId('analysis-status')).toHaveAttribute('data-state', 'failed');
  await page.getByLabel('Mapa rizik', { exact: true }).check();
  await expect(page.getByTestId('preview')).toHaveAttribute('data-risk-map', 'off');
  await expect(page.getByText('MAPA NENÍ DOSTUPNÁ · ANALÝZA NEDOKONČENA', { exact: true })).toBeVisible();
  await page.getByTestId('analysis-details-button').click();
  await expect(page.getByText('Analýza nedokončena', { exact: true })).toBeVisible();
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Stáhnout STL ↓', exact: true }).click();
  const path = testInfo.outputPath('still-valid.stl'); await (await pending).saveAs(path);
  const decoded = validateMesh(readStl(new Uint8Array(await readFile(path)).buffer));
  expect(decoded.valid).toBe(true); expect(decoded.bounds.size[2]).toBe(96);
});
