import { test, expect, type Page } from '@playwright/test';
import path from 'path';
import { GOAL_IDS, USER, openGoal } from '../e2e/support/app';

const out = (name: string) => path.join(process.cwd(), 'docs/screenshots', name);

async function settle(page: Page) {
  // Notifications are transient; dismiss them so they don't cover the content.
  for (const button of await page.getByRole('button', { name: 'Dismiss notification' }).all()) {
    await button.click();
  }
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
}

test('capture product screenshots', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Sign in to Proba' })).toBeVisible();
  await settle(page);
  await page.screenshot({ path: out('01-sign-in.png') });

  await page.getByLabel('Work email').fill(USER.email);
  await page.getByLabel('Password', { exact: true }).fill(USER.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText('Connection status: Live')).toBeVisible();

  await openGoal(page, GOAL_IDS.boot);
  await expect(page.getByRole('heading', { name: 'Move more daily budget to variant B' })).toBeVisible();
  await settle(page);
  await page.screenshot({ path: out('02-workspace-active-goal.png') });

  await openGoal(page, GOAL_IDS.jacket);
  await expect(page.getByText('Who should see the first wave of ads?')).toBeVisible();
  await page.getByText('Customers active in the last 90 days').click();
  await settle(page);
  await page.screenshot({ path: out('03-clarify-question.png') });

  await page.getByRole('button', { name: 'Submit answer' }).click();
  await expect(page.getByRole('heading', { name: 'Ridgeline spring launch plan' })).toBeVisible();
  await page.getByRole('heading', { name: 'Ridgeline spring launch plan' }).scrollIntoViewIfNeeded();
  await settle(page);
  await page.screenshot({ path: out('04-plan-approval.png') });

  await page.evaluate((id) => (window.location.hash = `#/campaigns/${id}`), GOAL_IDS.boot);
  await expect(page.getByRole('heading', { name: 'Daily conversions' })).toBeVisible();
  await settle(page);
  await page.screenshot({ path: out('05-campaign-performance.png') });
  await page.locator('#main-content').evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
  await page.getByRole('button', { name: /Conversions/ }).first().click();
  await settle(page);
  await page.screenshot({ path: out('06-campaign-variants-table.png') });

  await page.evaluate(() => (window.location.hash = '#/approvals'));
  await expect(page.getByRole('heading', { name: 'Approvals', level: 1 })).toBeVisible();
  await settle(page);
  await page.screenshot({ path: out('07-approvals.png') });

  await page.getByRole('button', { name: 'Emergency stop: halt all campaigns' }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await settle(page);
  await page.screenshot({ path: out('08-emergency-stop.png') });
  await page.getByRole('button', { name: 'Cancel' }).click();

  await page.getByRole('button', { name: /switch workspace/ }).click();
  await page.getByRole('menuitemradio', { name: 'Harbor & Pine' }).click();
  await page.evaluate(() => (window.location.hash = '#/goals'));
  await expect(page.getByRole('heading', { name: 'Create your first goal' })).toBeVisible();
  await settle(page);
  await page.screenshot({ path: out('09-empty-state.png') });
});
