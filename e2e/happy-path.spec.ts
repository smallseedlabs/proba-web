import { test, expect } from '@playwright/test';

test.describe('Proba Web E2E', () => {
  test('happy path - mock mode conversation flow', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Proba' })).toBeVisible();
    await expect(page.getByText('Mock Mode')).toBeVisible();

    await page.getByRole('button', { name: /Continue with Mock Data/i }).click();

    await expect(page.getByText('Goals')).toBeVisible();
    await expect(page.getByText('Approvals')).toBeVisible();

    await page.waitForTimeout(2000);

    const goalButton = page.getByRole('button', { name: /Launch Q4 Product Campaign/i });
    await expect(goalButton).toBeVisible({ timeout: 10000 });
    
    await goalButton.click();

    await expect(page.getByText(/Who should see these ads/i)).toBeVisible({ timeout: 5000 });

    await page.getByText('Active users').click();

    await page.waitForTimeout(1000);

    await expect(page.getByText(/Campaign Launch Plan/i)).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: /Approve Plan/i }).click();

    await page.waitForTimeout(1000);

    await expect(page.getByText(/budget/i)).toBeVisible({ timeout: 5000 });

    await page.getByText(/Pause/).click();
    await expect(page.getByText(/Resume/)).toBeVisible();
  });

  test('displays workspace sections', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Continue with Mock Data/i }).click();

    await expect(page.getByText('Goals')).toBeVisible();
    await expect(page.getByText('Approvals')).toBeVisible();
    await expect(page.getByText('Activity')).toBeVisible();
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
