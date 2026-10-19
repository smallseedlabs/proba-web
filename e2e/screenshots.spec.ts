import { test } from '@playwright/test';
import * as path from 'path';

test.describe('Screenshots', () => {
  test('capture workspace and chat screenshots', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Continue with Mock Data/i }).click();

    await page.waitForTimeout(1500);

    await page.screenshot({ 
      path: path.join(process.cwd(), 'artifacts/workspace-view.png'),
      fullPage: true
    });

    await page.getByText('Active users (logged in last 30 days)').click();
    await page.waitForTimeout(1000);

    await page.screenshot({ 
      path: path.join(process.cwd(), 'artifacts/approval-card.png'),
      fullPage: true
    });

    const approveButton = page.getByRole('button', { name: /Approve Plan/i });
    await approveButton.click();
    await page.waitForTimeout(1000);

    await page.screenshot({ 
      path: path.join(process.cwd(), 'artifacts/clarify-question.png'),
      fullPage: true
    });
  });
});