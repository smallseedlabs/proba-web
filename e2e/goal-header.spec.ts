import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GOAL_IDS, openGoal, signIn } from './support/app';

const SHOT_DIR = resolve(fileURLToPath(new URL('.', import.meta.url)), '../artifacts/ui-fix2');

function shotPath(name: string): string {
  mkdirSync(SHOT_DIR, { recursive: true });
  return resolve(SHOT_DIR, name);
}

test.describe('Goal header and thread height', () => {
  test('collapses the header at 1024x593 so the thread gets most of the height', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 593 });
    await signIn(page);
    await openGoal(page, GOAL_IDS.boot);
    await expect(page.getByRole('heading', { name: 'Validate UK demand for the Trailhead 2 boot' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Show details' })).toBeVisible();
    const header = page.getByTestId('goal-header');
    const scroller = page.getByTestId('goal-thread-scroller');
    const headerBox = await header.boundingBox();
    const threadBox = await scroller.boundingBox();
    expect(headerBox?.height ?? 0).toBeLessThan(160);
    expect(threadBox?.height ?? 0).toBeGreaterThan(headerBox?.height ?? 0);
    expect(threadBox?.height ?? 0).toBeGreaterThan(200);
    await expect(page.getByRole('list', { name: 'Conversation' })).toBeVisible();
    // Document scroll stays clipped; only the thread pane scrolls.
    const overflow = await page.evaluate(() => ({
      rootFixed: getComputedStyle(document.getElementById('root')!).position === 'fixed',
      docOverflow: getComputedStyle(document.documentElement).overflow,
      threadOverflow: getComputedStyle(document.querySelector('[data-testid="goal-thread-scroller"]')!).overflowY,
    }));
    expect(overflow.rootFixed).toBe(true);
    expect(overflow.docOverflow).toMatch(/clip|hidden/);
    expect(overflow.threadOverflow).toMatch(/auto|scroll/);
    await page.screenshot({ path: shotPath('goal-thread-1024x593.png'), fullPage: false });
  });

  test('keeps the full header on a tall 1440x900 window', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page);
    await openGoal(page, GOAL_IDS.boot);
    await expect(page.getByRole('heading', { name: 'Validate UK demand for the Trailhead 2 boot' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Show details' })).toHaveCount(0);
    const header = page.getByTestId('goal-header');
    await expect(header.getByText('Spend').or(header.getByText('Progress')).first()).toBeVisible();
    const overflow = await page.evaluate(() => ({
      rootFixed: getComputedStyle(document.getElementById('root')!).position === 'fixed',
      threadOverflow: getComputedStyle(document.querySelector('[data-testid="goal-thread-scroller"]')!).overflowY,
    }));
    expect(overflow.rootFixed).toBe(true);
    expect(overflow.threadOverflow).toMatch(/auto|scroll/);
    await page.screenshot({ path: shotPath('goal-thread-1440x900.png'), fullPage: false });
  });
});
