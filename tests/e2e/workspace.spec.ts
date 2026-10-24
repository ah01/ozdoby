import { test, expect, type Page } from '@playwright/test';

const ready = async (page: Page) => {
  await expect(page.getByTestId('geometry-status')).toHaveAttribute('data-state', 'ready');
  await expect(page.getByTestId('analysis-status')).toHaveAttribute('data-state', 'ready');
};

test('fullscreen workspace scrolls only the left settings and keeps bottom actions in view', async ({ page }, testInfo) => {
  await page.goto('/'); await ready(page);
  await page.getByLabel('Amplituda žeber', { exact: true }).fill('1,2');
  await page.getByLabel('Celkové zkroucení', { exact: true }).fill('90'); await ready(page);
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight && document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const panel = page.getByTestId('settings-panel'), bottom = page.getByTestId('bottom-panel');
  const initial = await bottom.boundingBox();
  expect(initial).not.toBeNull();
  expect(initial!.y + initial!.height).toBeLessThanOrEqual(1081);
  const side = await panel.boundingBox();
  await page.mouse.move(side!.x + side!.width / 2, side!.y + side!.height / 2);
  await page.mouse.wheel(0, 900);
  await expect.poll(() => panel.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  expect((await bottom.boundingBox())!.y).toBe(initial!.y);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await expect(page.getByRole('button', { name: 'Stáhnout STL ↓', exact: true })).toBeInViewport();
  await page.getByTestId('analysis-details-button').click();
  const details = page.getByRole('dialog', { name: 'Podrobné výsledky analýzy', exact: true });
  await expect(details).toBeVisible();
  const bounds = await details.boundingBox();
  const anchor = await page.getByTestId('analysis-details-button').boundingBox();
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(anchor!.y + 1);
  await page.screenshot({ path: testInfo.outputPath('workspace-analysis-popover.jpg'), fullPage: true, type: 'jpeg', quality: 88 });
  await page.keyboard.press('Escape'); await expect(details).toHaveCount(0);
  await page.getByRole('heading', { name: 'Silueta a rozměry', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('workspace-fullscreen.jpg'), fullPage: true, type: 'jpeg', quality: 88 });
});

test('small screens use a left settings drawer while bottom summary and exports stay visible', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/'); await ready(page);
  await expect(page.getByTestId('settings-panel')).toHaveCount(0);
  await page.getByRole('button', { name: 'Otevřít nastavení', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: 'Nastavení baňky', exact: true });
  await expect(drawer).toBeVisible();
  await drawer.getByLabel('Výška těla', { exact: true }).fill('100'); await ready(page);
  await page.getByRole('button', { name: 'Zavřít nastavení', exact: true }).click();
  await expect(drawer).toHaveCount(0);
  await expect(page.getByTestId('actual-dimensions')).toHaveText('56 × 56 × 108 mm');
  await expect(page.getByRole('button', { name: 'Stáhnout STL ↓', exact: true })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true);
  await page.getByTestId('analysis-details-button').click();
  const details = page.getByRole('dialog', { name: 'Podrobné výsledky analýzy', exact: true });
  await expect(details).toBeVisible();
  const rect = await details.boundingBox();
  expect(rect!.x).toBeGreaterThanOrEqual(0); expect(rect!.x + rect!.width).toBeLessThanOrEqual(390);
});
