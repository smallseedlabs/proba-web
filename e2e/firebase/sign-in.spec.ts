import { test, expect, type Page } from '@playwright/test';
import { ACCOUNT, mockBackends, type MockState } from './mock';

/**
 * The production build with the real Firebase JS SDK. Firebase Authentication
 * and proba-hub are mocked at the network level (see mock.ts).
 */
const FORBIDDEN = /\b(mock|fixture|dev login|alpha|beta|prototype|test data)\b/i;

let hub: MockState;

test.beforeEach(async ({ page }) => {
  hub = await mockBackends(page);
});

async function signIn(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Sign in to Proba' })).toBeVisible();
  await page.getByLabel('Work email').fill(ACCOUNT.email);
  await page.getByLabel('Password', { exact: true }).fill(ACCOUNT.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
}

const sessionCalls = () => hub.calls.filter((c) => c.name === 'hub:session');

test('signs in with Firebase email/password and exchanges the ID token for a Hub session', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
  await expect(page.locator('body')).not.toContainText(FORBIDDEN);

  await signIn(page);

  const firebase = hub.calls.find((c) => c.name === 'firebase:signInWithPassword');
  expect(firebase?.body).toMatchObject({ email: ACCOUNT.email, password: ACCOUNT.password });
  expect(sessionCalls()).toHaveLength(1);
  const idToken = (sessionCalls()[0].body as { idToken: string }).idToken;
  expect(idToken.split('.')).toHaveLength(3);

  // The app talks to the Hub with the Hub session token, never the ID token.
  await expect.poll(() => hub.calls.some((c) => c.name === 'hub:events' && c.token === 'hub-session-1')).toBe(true);
  expect(hub.calls.some((c) => c.token === idToken)).toBe(false);
  await expect(page.locator('body')).not.toContainText(FORBIDDEN);
});

test('shows Firebase credential errors without calling the Hub', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Work email').fill(ACCOUNT.email);
  await page.getByLabel('Password', { exact: true }).fill('not-the-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('The email or password you entered is incorrect.');
  expect(sessionCalls()).toHaveLength(0);
});

test('sends a Firebase password reset email', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Forgot password?' }).click();
  await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible();
  await page.getByLabel('Work email').fill(ACCOUNT.email);
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.getByRole('status')).toContainText(`If an account exists for ${ACCOUNT.email}`);
  const reset = hub.calls.find((c) => c.name === 'firebase:sendOobCode');
  expect(reset?.body).toMatchObject({ requestType: 'PASSWORD_RESET', email: ACCOUNT.email });

  await page.getByRole('button', { name: 'Back to sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in to Proba' })).toBeVisible();
});

test('signs out of the Hub and Firebase', async ({ page }) => {
  await signIn(page);
  await page.getByRole('button', { name: /Alex Morgan.*account menu/ }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in to Proba' })).toBeVisible();
  await expect(page.getByText('You have been signed out.')).toBeVisible();

  await expect.poll(() => hub.calls.find((c) => c.name === 'hub:logout')?.token).toBe('hub-session-1');
  await expect
    .poll(() => page.evaluate(() => Object.keys(sessionStorage).filter((k) => k.startsWith('firebase:authUser'))))
    .toEqual([]);

  // A reload does not sign back in.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Sign in to Proba' })).toBeVisible();
  expect(sessionCalls()).toHaveLength(1);
});

test('resumes the Firebase sign-in after a reload', async ({ page }) => {
  await signIn(page);
  await page.evaluate(() => sessionStorage.removeItem('proba.session'));
  await page.reload();
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
  expect(sessionCalls()).toHaveLength(2);
});

test('gets a new Hub session when the Hub revokes the current one', async ({ page }) => {
  await signIn(page);
  hub.validHubTokens.delete('hub-session-1');

  await expect.poll(() => sessionCalls().length, { timeout: 15_000 }).toBe(2);
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
  await expect
    .poll(() => hub.calls.some((c) => c.name === 'hub:events' && c.token === 'hub-session-2'), { timeout: 15_000 })
    .toBe(true);
});

test('returns to sign-in when the Firebase session has expired, without retrying forever', async ({ page }) => {
  await signIn(page);
  hub.validHubTokens.clear();
  hub.hubRejectsIdTokens = true;
  hub.refreshRevoked = true;

  await expect(page.getByRole('heading', { name: 'Sign in to Proba' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Your session has expired. Please sign in again.')).toBeVisible();

  const settled = { session: sessionCalls().length, refresh: hub.count('firebase:refresh'), events: hub.count('hub:events') };
  expect(settled.session).toBeLessThanOrEqual(2);
  await page.waitForTimeout(3_000);
  expect(sessionCalls().length).toBe(settled.session);
  expect(hub.count('firebase:refresh')).toBe(settled.refresh);
  expect(hub.count('hub:events')).toBe(settled.events);
});
