import { expect, type Page } from '@playwright/test';

export const USER = { email: 'alex.morgan@northwindoutdoor.com', password: 'correct-horse-battery' };

export const GOAL_IDS = {
  boot: '9d4b1f60-1c2e-4a7b-8f3d-2e5a6b7c8d01',
  jacket: '9d4b1f60-1c2e-4a7b-8f3d-2e5a6b7c8d02',
  holiday: '9d4b1f60-1c2e-4a7b-8f3d-2e5a6b7c8d03',
};

export async function signIn(page: Page, path = '/') {
  await page.goto(path);
  await expect(page.getByRole('heading', { name: 'Sign in to Proba' })).toBeVisible();
  await page.getByLabel('Work email').fill(USER.email);
  await page.getByLabel('Password', { exact: true }).fill(USER.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
  await expect(page.getByText('Connection status: Live')).toBeVisible();
}

export async function openGoal(page: Page, goalId: string) {
  await page.evaluate((id) => (window.location.hash = `#/goals/${id}`), goalId);
}
