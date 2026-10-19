import { test, expect } from '@playwright/test';
import { GOAL_IDS, openGoal, signIn } from './support/app';

const FORBIDDEN = /\b(mock|fixture|dev login|alpha|beta|prototype|scenario|brain|seq)\b/i;

test.describe('Workspace', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('shows the app shell with navigation, workspace switcher and safety controls', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: 'Main' });
    for (const label of ['Goals', 'Approvals', 'Activity', 'Campaigns', 'Settings']) {
      await expect(nav.getByRole('link', { name: new RegExp(`^${label}`) })).toBeVisible();
    }
    await expect(page.getByRole('button', { name: /switch workspace/ })).toContainText('Northwind Outdoor');
    await expect(page.getByRole('button', { name: 'Pause all activity' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Emergency stop: halt all campaigns' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Goals', level: 1 })).toBeVisible();
    await expect(page.locator('body')).not.toContainText(FORBIDDEN);
  });

  test('answers a clarifying question, then approves the proposed plan', async ({ page }) => {
    await openGoal(page, GOAL_IDS.jacket);
    await expect(page.getByRole('heading', { name: 'Spring launch: Ridgeline rain jacket' })).toBeVisible();
    await expect(page.getByText('Who should see the first wave of ads?')).toBeVisible();

    await page.getByText('Customers active in the last 90 days').click();
    await page.getByRole('button', { name: 'Submit answer' }).click();
    await expect(page.getByText('Answer sent. Proba is continuing with your choice.')).toBeVisible();

    const plan = page.getByRole('region', { name: /Plan awaiting approval: Ridgeline spring launch plan/ });
    await expect(plan.getByRole('heading', { name: 'Ridgeline spring launch plan' })).toBeVisible();
    await expect(plan.getByText('$5,000')).toBeVisible();
    await plan.getByRole('button', { name: 'Approve plan' }).click();
    await expect(plan.getByText('You approved this plan. Proba is proceeding.')).toBeVisible();
    await expect(page.getByText(/I am producing the three creative variants now/)).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Producing ad creative' })).toBeVisible();
  });

  test('approves a spend change from the Approvals page', async ({ page }) => {
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: /^Approvals/ }).click();
    await expect(page.getByRole('heading', { name: 'Approvals', level: 1 })).toBeVisible();
    const card = page.getByRole('region', { name: /Move more daily budget to variant B/ });
    await expect(card.getByText('$65 / day')).toBeVisible();
    await card.getByRole('button', { name: 'Approve' }).click();
    await expect(page.getByRole('region', { name: /Move more daily budget to variant B/ })).toHaveCount(0);
  });

  test('sends a message in a goal conversation', async ({ page }) => {
    await openGoal(page, GOAL_IDS.boot);
    const input = page.getByLabel('Message Proba');
    await input.fill('Please keep weekend spend below $80 per day.');
    await input.press('Enter');
    await expect(input).toHaveValue('');
    await expect(page.getByText('Please keep weekend spend below $80 per day.')).toBeVisible();
    await expect(page.getByText('Thanks, noted. I will take that into account and update you in this thread.')).toBeVisible();
  });

  test('shows campaign performance with a chart, sortable table and spend bar', async ({ page }) => {
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: /^Campaigns/ }).click();
    await page.getByRole('link', { name: /Validate UK demand for the Trailhead 2 boot/ }).click();

    await expect(page.getByRole('heading', { name: 'Daily conversions' })).toBeVisible();
    await expect(page.getByRole('progressbar', { name: /Spend vs. cap/ })).toHaveAttribute('aria-valuetext', /\$1,840 spent of \$3,000 cap/);

    const table = page.getByRole('table', { name: 'Ad variant performance' });
    const conversions = table.getByRole('columnheader', { name: /Conversions/ });
    await table.getByRole('button', { name: /^Conversions/ }).click();
    await expect(conversions).toHaveAttribute('aria-sort', 'descending');
    await expect(table.getByRole('rowheader').first()).toHaveText('B · Waterproof in any weather');
    await table.getByRole('button', { name: /^Conversions/ }).click();
    await expect(conversions).toHaveAttribute('aria-sort', 'ascending');
    await expect(table.getByRole('rowheader').first()).toHaveText('C · Lighter than you think');
  });

  test('records activity in business language', async ({ page }) => {
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: /^Activity/ }).click();
    await expect(page.getByRole('heading', { name: 'Activity', level: 1 })).toBeVisible();
    await expect(page.getByText('Variant C paused by guardrail')).toBeVisible();
    await page.getByRole('button', { name: 'Questions' }).click();
    await expect(page.getByRole('button', { name: 'Questions' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('Proba asked a question')).toBeVisible();
    await expect(page.getByText('Variant C paused by guardrail')).toHaveCount(0);
  });

  test('pauses everything and requires confirmation for the emergency stop', async ({ page }) => {
    await page.getByRole('button', { name: 'Pause all activity' }).click();
    await expect(page.getByText('All activity is paused')).toBeVisible();
    await page.getByRole('button', { name: 'Resume all activity' }).click();
    await expect(page.getByText('All activity is paused')).toHaveCount(0);

    await page.getByRole('button', { name: 'Emergency stop: halt all campaigns' }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Stop all campaigns now?' });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);

    await page.getByRole('button', { name: 'Emergency stop: halt all campaigns' }).click();
    await dialog.getByRole('button', { name: 'Stop all campaigns' }).click();
    await expect(page.getByRole('button', { name: 'Resume operations' })).toBeVisible();
  });

  test('switches to an empty workspace and creates a goal', async ({ page }) => {
    await page.getByRole('button', { name: /switch workspace/ }).click();
    await page.getByRole('menuitemradio', { name: 'Harbor & Pine' }).click();
    await expect(page.getByRole('heading', { name: 'Create your first goal' })).toBeVisible();

    await page.getByRole('button', { name: 'New goal' }).click();
    const dialog = page.getByRole('dialog', { name: 'Create a goal' });
    await dialog.getByRole('button', { name: 'Create goal' }).click();
    await expect(dialog.getByText('Describe what you want to achieve.')).toBeVisible();
    await dialog.getByLabel('Goal').fill('Test demand for the Harbor canvas tote in Germany');
    await dialog.getByLabel('Daily budget cap').fill('120');
    await dialog.getByRole('button', { name: 'Create goal' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Test demand for the Harbor canvas tote in Germany/ })).toBeVisible();
  });
});
