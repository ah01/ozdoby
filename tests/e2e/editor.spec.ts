import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { readStl } from '../helpers/read-stl';
import { validateMesh } from '../../src/geometry/validate';
import { parseSettings } from '../../src/io/preset';

const ready = (page: Page) => expect(page.getByTestId('geometry-status')).toHaveAttribute('data-state', 'ready');
const field = (page: Page, label: string) => page.getByLabel(label, { exact: true });

test('Mantine fields preserve invalid drafts, sliders work by keyboard, and settings survive reload', async ({ page }) => {
  await page.goto('/'); await ready(page);
  const height = field(page, 'Výška těla');
  await height.fill('');
  await expect(height).toHaveValue('');
  await expect(page.getByTestId('geometry-status')).toHaveAttribute('data-state', 'invalid');
  await expect(page.getByRole('button', { name: 'Stáhnout STL ↓', exact: true })).toBeDisabled();
  await expect(page.getByText('Neplatný vstup · poslední platný náhled', { exact: true })).toBeVisible();
  await height.fill('95'); await ready(page);
  const slider = page.getByRole('slider', { name: 'Průměr těla – posuvník', exact: true });
  await slider.focus(); await slider.press('ArrowRight'); await ready(page);
  await expect(field(page, 'Průměr těla')).toHaveValue('57 mm');
  await expect(page.getByText('Nastavení uloženo v tomto prohlížeči', { exact: true })).toBeVisible();
  await page.reload(); await ready(page);
  await expect(field(page, 'Výška těla')).toHaveValue('95 mm');
  await expect(page.getByTestId('actual-dimensions')).toHaveText('57 × 57 × 103 mm');
});

test('STL export freezes its revision and hanging view leaves the same export geometry', async ({ page }, testInfo) => {
  await page.goto('/'); await ready(page);
  await field(page, 'Průměr těla').fill('64');
  await field(page, 'Amplituda žeber').fill('1');
  await field(page, 'Celkové zkroucení').fill('60'); await ready(page);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Stáhnout STL ↓', exact: true }).click();
  await field(page, 'Výška těla').fill('95');
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/x96-neck14\.stl$/);
  const path = testInfo.outputPath('frozen.stl'); await download.saveAs(path);
  const bytes = new Uint8Array(await readFile(path));
  const validation = validateMesh(readStl(bytes.buffer));
  expect(validation.valid).toBe(true); expect(validation.bounds.size[2]).toBe(96); expect(validation.bounds.size[0]).toBeGreaterThan(64);
  await field(page, 'Výška těla').fill('88'); await ready(page);
  await page.getByText('Zavěšená', { exact: true }).click();
  await expect(page.getByText('ZAVĚŠENÝ POHLED · POUZE NÁHLED', { exact: true })).toBeVisible();
  const secondPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Stáhnout STL ↓', exact: true }).click();
  const secondPath = testInfo.outputPath('hanging.stl'); await (await secondPromise).saveAs(secondPath);
  expect(new Uint8Array(await readFile(secondPath))).toEqual(bytes);
  const jsonPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Uložit parametry JSON', exact: true }).click();
  const jsonPath = testInfo.outputPath('settings.json'); await (await jsonPromise).saveAs(jsonPath);
  const settings = parseSettings(await readFile(jsonPath, 'utf8'));
  expect(settings.parameters.surface.twistDeg).toBe(60); expect(settings.parameters.body.heightMm).toBe(88);
});

test('missing WebGL and blocked storage keep parameter editing and solid STL export working', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { value(this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      if (/webgl/i.test(type)) return null;
      return (original as (...args: unknown[]) => unknown).call(this, type, ...args);
    } });
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } });
  });
  await page.goto('/'); await ready(page);
  await expect(page.getByText('3D náhled není dostupný', { exact: true })).toBeVisible();
  await expect(page.getByText('Místní nastavení', { exact: true })).toBeVisible();
  await field(page, 'Výška těla').fill('100'); await ready(page);
  const promise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Stáhnout STL ↓', exact: true }).click();
  const path = testInfo.outputPath('without-webgl.stl'); await (await promise).saveAs(path);
  const decoded = validateMesh(readStl(new Uint8Array(await readFile(path)).buffer));
  expect(decoded.valid).toBe(true); expect(decoded.bounds.size[2]).toBe(108);
});

test('100 completed revisions preserve camera and do not accumulate live render resources', async ({ page }) => {
  test.setTimeout(180_000);
  // Keep the software-rendered pixel workload fixed; this audits resource
  // lifetime, while dedicated layout tests cover the 1440px fullscreen view.
  await page.setViewportSize({ width: 1024, height: 768 });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/'); await ready(page);
  await page.waitForFunction(() => (window.__bulbPreview?.().geometries ?? 0) > 0);
  const before = await page.evaluate(() => window.__bulbPreview!());
  for (let i = 0; i < 100; i++) {
    await field(page, 'Výška těla').fill(String(40 + i % 95)); await ready(page);
    const revision = Number(await page.getByTestId('geometry-status').getAttribute('data-revision'));
    await page.waitForFunction(rev => window.__bulbPreview?.().revision === rev, revision);
  }
  await expect.poll(async () => (await page.evaluate(() => window.__bulbPreview!())).geometries).toBeLessThanOrEqual(before.geometries + 1);
  const after = await page.evaluate(() => window.__bulbPreview!());
  expect(after.materials).toBe(before.materials);
  expect(after.programs).toBeLessThanOrEqual(before.programs + 1);
  after.camera.forEach((value, i) => expect(value).toBeCloseTo(before.camera[i]!, 8));
  expect(after.target).toEqual(before.target);
  expect(errors).toEqual([]);
  await page.getByRole('button', { name: 'Reset kamery ↺', exact: true }).click();
  await expect.poll(async () => (await page.evaluate(() => window.__bulbPreview!())).target[2]).toBe(26);
  console.log('PREVIEW_RESOURCES', JSON.stringify({ edits: 100, before, after }));
});

test('mobile layout fits the viewport and print instructions work with the keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/'); await ready(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const help = page.getByRole('button', { name: 'Jak tisknout', exact: true });
  await help.focus(); await help.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Tisk v režimu spiral vase', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('rapid edits show the final revision and preset reset restores the surface', async ({ page }, testInfo) => {
  await page.goto('/'); await ready(page);
  await field(page, 'Amplituda žeber').fill('');
  await field(page, 'Amplituda žeber').pressSequentially('1.2');
  await expect(field(page, 'Amplituda žeber')).toHaveValue('1,2 mm');
  await field(page, 'Celkové zkroucení').fill('90');
  for (const height of ['90', '93', '96']) await field(page, 'Výška těla').fill(height);
  await ready(page);
  await expect(page.getByTestId('actual-dimensions')).toHaveText(/ × 104 mm$/);
  const revision = Number(await page.getByTestId('geometry-status').getAttribute('data-revision'));
  await page.waitForFunction(rev => window.__bulbPreview?.().revision === rev, revision);
  await page.getByRole('heading', { name: 'Silueta a rozměry', exact: true }).scrollIntoViewIfNeeded();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.screenshot({ path: testInfo.outputPath('editor-desktop.jpg'), fullPage: true, type: 'jpeg', quality: 88 });
  await page.getByRole('button', { name: 'Obnovit výchozí tvar', exact: true }).click(); await ready(page);
  await expect(field(page, 'Amplituda žeber')).toHaveValue('0 mm');
  await expect(field(page, 'Celkové zkroucení')).toHaveValue('0 °');
  await expect(field(page, 'Výška těla')).toHaveValue('88 mm');
});
