import { test, expect } from '@playwright/test';
import { GOAL_IDS, openGoal, signIn } from './support/app';

test.describe('Tablet layout', () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  test('uses a compact navigation rail and keeps the safety controls reachable', async ({ page }) => {
    await signIn(page);
    const nav = page.getByRole('navigation', { name: 'Main' });
    await expect(nav.getByRole('link', { name: /^Goals/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pause all activity' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Emergency stop: halt all campaigns' })).toBeVisible();

    const box = await nav.boundingBox();
    expect(box?.width ?? 0).toBeLessThan(100);
  });

  test('shows a goal full-width with a way back to the list', async ({ page }) => {
    await signIn(page);
    await openGoal(page, GOAL_IDS.boot);
    await expect(page.getByRole('heading', { name: 'Validate UK demand for the Trailhead 2 boot' })).toBeVisible();
    await page.getByRole('link', { name: 'All goals' }).click();
    await expect(page.getByRole('heading', { name: 'Goals', level: 1 })).toBeVisible();
  });

  test('has no horizontal overflow on the campaign view', async ({ page }) => {
    await signIn(page);
    await page.evaluate((id) => (window.location.hash = `#/campaigns/${id}`), GOAL_IDS.boot);
    await expect(page.getByRole('heading', { name: 'Daily conversions' })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
