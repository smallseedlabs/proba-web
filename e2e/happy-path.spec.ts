import { test, expect } from '@playwright/test';

test.describe('Proba Web E2E', () => {
  test('happy path - mock mode conversation flow', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Proba' })).toBeVisible();
    await expect(page.getByText('Mock Mode')).toBeVisible();

    await page.getByRole('button', { name: /Continue with Mock Data/i }).click();

    await expect(page.getByRole('heading', { name: 'Goals' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Approvals' })).toBeVisible();

    await expect(page.getByText(/Who should see these ads/i)).toBeVisible({ timeout: 5000 });

    await page.getByText('Active users (logged in last 30 days)').click();

    await expect(page.getByRole('heading', { name: /Campaign Launch Plan/i })).toBeVisible({ timeout: 5000 });

    const approveButton = page.getByRole('button', { name: /Approve Plan/i });
    await expect(approveButton).toBeVisible();
    await approveButton.click();

    await expect(page.getByRole('heading', { name: /Daily Budget Adjustment/i })).toBeVisible({ timeout: 5000 });
  });

  test('displays workspace sections', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Continue with Mock Data/i }).click();

    await expect(page.getByRole('heading', { name: 'Goals' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Approvals' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Activity' })).toBeVisible();
  });

  test('can send messages in chat', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Continue with Mock Data/i }).click();

    const input = page.getByPlaceholder('Type a message...');
    await input.fill('Test message');
    
    await page.getByRole('button', { name: 'Send' }).click();

    await expect(input).toHaveValue('');
  });
});
