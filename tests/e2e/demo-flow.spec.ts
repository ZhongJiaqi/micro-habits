/**
 * E2E tests for Becoming app — logged-in UI flows.
 *
 * Uses ?demo=1 mode to bypass Firebase Auth (which requires authorized domains
 * not configured for localhost). This validates that the post-login UI renders,
 * tab navigation works, and interactive states fire — without needing the
 * Firebase Auth Emulator.
 *
 * Limitation: this does NOT verify the Firebase Auth chain (signInWithGoogle
 * popup/redirect/token exchange) or real Firestore reads/writes. Those remain
 * covered by manual + iOS smoke testing. Full Auth Emulator setup is deferred.
 */
import { test, expect } from '@playwright/test';

const DEMO_URL = 'http://localhost:4173/?demo=1';

test.describe('Demo mode (logged-in UI surrogate)', () => {
  test('Today shows 2 affirmations + 2 habits sections', async ({ page }) => {
    await page.goto(DEMO_URL);
    await page.waitForSelector('h1', { timeout: 15000 });

    // Brand visible in header
    await expect(page.locator('h1').first()).toContainText('Becoming');

    // Two section labels rendered
    await expect(page.getByText('Affirmations', { exact: true })).toBeVisible();
    await expect(page.getByText('Habits', { exact: true })).toBeVisible();

    // Preset content present
    await expect(page.getByText('I am enough.')).toBeVisible();
    await expect(page.getByText('Today, I choose calm.')).toBeVisible();
    await expect(page.getByText('散步 30 分钟')).toBeVisible();
    await expect(page.getByText('读书 20 页')).toBeVisible();
  });

  test('Toggling a task checkbox flips its completed state', async ({ page }) => {
    await page.goto(DEMO_URL);
    await page.waitForSelector('h1', { timeout: 15000 });

    const firstAffirmationToggle = page.getByRole('button', { name: 'Mark complete' }).first();
    await firstAffirmationToggle.click();

    // After click, the same row's button label flips to "Mark incomplete"
    await expect(
      page.getByRole('button', { name: 'Mark incomplete' }).first(),
    ).toBeVisible({ timeout: 3000 });
  });

  test('Practice tab shows Will Durant tagline', async ({ page }) => {
    await page.goto(DEMO_URL);
    await page.waitForSelector('h1', { timeout: 15000 });

    // Bottom-nav PRACTICE tab
    await page.getByRole('button', { name: /PRACTICE/i }).click();

    await expect(page.getByText('You are what you repeatedly do.')).toBeVisible({
      timeout: 3000,
    });
  });

  test('History tab renders Active Practices stat', async ({ page }) => {
    await page.goto(DEMO_URL);
    await page.waitForSelector('h1', { timeout: 15000 });

    await page.getByRole('button', { name: /HISTORY/i }).click();

    // The History tab shows the "Active Practices" stat label.
    // The label is rendered as <span>Active<br/>Practices</span>, so its
    // textContent collapses to "ActivePractices" — match by regex substring.
    await expect(page.locator('span').filter({ hasText: /Practices/ }).first()).toBeVisible({
      timeout: 5000,
    });
  });

  test('Exit Demo button returns to login page', async ({ page }) => {
    await page.goto(DEMO_URL);
    await page.waitForSelector('h1', { timeout: 15000 });

    await page.getByRole('button', { name: 'Exit Demo' }).click();

    // After exit, login button (Continue with Google) becomes visible
    await expect(page.getByRole('button', { name: /Continue with Google/i })).toBeVisible({
      timeout: 5000,
    });
  });
});
