import { test, expect } from '@playwright/test';
import { USER } from './support/app';

const FORBIDDEN = /\b(mock|fixture|dev login|alpha|beta|prototype|test data)\b/i;

test.describe('Sign in', () => {
  test('shows a branded sign-in screen with no development wording', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('Proba');
    await expect(page.getByRole('heading', { name: 'Sign in to Proba' })).toBeVisible();
    await expect(page.getByLabel('Work email')).toBeFocused();
    await expect(page.locator('body')).not.toContainText(FORBIDDEN);
  });

  test('validates input before signing in', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByText('Enter your work email address.')).toBeVisible();
    await expect(page.getByText('Enter your password.')).toBeVisible();

    await page.getByLabel('Work email').fill('alex.morgan');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByText(/Enter a valid email address/)).toBeVisible();
  });

  test('shows an error for rejected credentials', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Work email').fill(USER.email);
    await page.getByLabel('Password', { exact: true }).fill('short');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Signing in…' })).toBeDisabled();
    await expect(page.getByRole('alert')).toContainText('The email or password you entered is incorrect.');
  });

  test('signs in with the keyboard, then signs out', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByLabel('Work email')).toBeFocused();
    await page.keyboard.type(USER.email);
    await page.keyboard.press('Tab');
    await page.keyboard.type(USER.password);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
    await expect(page.locator('body')).not.toContainText(FORBIDDEN);

    await page.getByRole('button', { name: /Alex Morgan.*account menu/ }).click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await expect(page.getByRole('heading', { name: 'Sign in to Proba' })).toBeVisible();
    await expect(page.getByText('You have been signed out.')).toBeVisible();
  });
});
