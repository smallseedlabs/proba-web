import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { GOAL_IDS, openGoal, signIn } from './support/app';

async function expectNoViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  const summary = results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`);
  expect(summary).toEqual([]);
}

test.describe('Accessibility (WCAG 2.2 AA)', () => {
  // Contrast is measured on settled UI, not mid-animation.
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('sign-in screen, including the error state', async ({ page }) => {
    await page.goto('/');
    await expectNoViolations(page);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByText('Enter your password.')).toBeVisible();
    await expectNoViolations(page);
  });

  test('every section of the signed-in app', async ({ page }) => {
    await signIn(page);
    await openGoal(page, GOAL_IDS.boot);
    await expect(page.getByRole('heading', { name: 'Move more daily budget to variant B' })).toBeVisible();
    await expectNoViolations(page);

    await openGoal(page, GOAL_IDS.jacket);
    await expect(page.getByText('Who should see the first wave of ads?')).toBeVisible();
    await expectNoViolations(page);

    for (const [hash, heading] of [
      ['#/approvals', 'Approvals'],
      ['#/activity', 'Activity'],
      ['#/campaigns', 'Campaigns'],
      ['#/settings', 'Settings'],
    ]) {
      await page.evaluate((h) => (window.location.hash = h), hash);
      await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible();
      await expectNoViolations(page);
    }

    await page.evaluate((id) => (window.location.hash = `#/campaigns/${id}`), GOAL_IDS.boot);
    await expect(page.getByRole('heading', { name: 'Daily conversions' })).toBeVisible();
    await expectNoViolations(page);

    await page.getByRole('button', { name: 'Emergency stop: halt all campaigns' }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await expectNoViolations(page);
  });

  test('skip link moves focus to the main content', async ({ page }) => {
    await signIn(page);
    // Reload so focus starts at the top of the document, as on a fresh visit.
    await page.reload();
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to main content' });
    await expect(skip).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main-content')).toBeFocused();
  });
});
