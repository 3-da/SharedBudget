import { test, expect } from '../fixtures/auth.fixture';
import { Page } from '@playwright/test';

/**
 * Savings E2E tests.
 *
 * These tests exercise the savings overview page where users can set
 * personal and shared savings amounts. Alex (owner) is authenticated
 * via the auth fixture.
 */

/** Helper: Navigate to the savings page and wait for it to load. */
async function goToSavings(page: Page): Promise<void> {
  await page.goto('/savings');
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: 'Savings' })).toBeVisible({ timeout: 10_000 });
}

test.describe('Savings', () => {
  test.describe.configure({ mode: 'serial' });

  test('savings page loads with all cards visible', async ({ alexPage }) => {
    await goToSavings(alexPage);

    // Personal Savings card
    await expect(alexPage.getByText('Personal Savings', { exact: true })).toBeVisible();

    // Shared Savings card ('Shared Savings' also appears lowercase in the
    // history subtitle, so match the card title exactly)
    await expect(alexPage.getByText('Shared Savings', { exact: true })).toBeVisible();
    await expect(alexPage.getByText('Household pool')).toBeVisible();
    await expect(alexPage.getByText('Household total')).toBeVisible();

    // Per-member breakdown card
    await expect(alexPage.getByText('Per-Member Breakdown')).toBeVisible();
  });

  test('set personal savings and verify amount updates', async ({ alexPage }) => {
    await goToSavings(alexPage);

    // Find the Personal Savings card and fill the form
    const personalCard = alexPage.locator('mat-card', { hasText: 'Personal Savings' });
    await expect(personalCard).toBeVisible();

    // Fill the amount input
    const amountInput = personalCard.locator('input[type="number"]');
    await amountInput.fill('500');

    // Click the Add button (savings are cumulative; total starts at 0 this month)
    await personalCard.getByRole('button', { name: 'Add', exact: true }).click();

    // Wait for the save to complete
    await alexPage.waitForLoadState('networkidle');

    // Verify the current amount displays 500,00 (de-DE format)
    await expect(personalCard.locator('.current-amount').first()).toContainText('500,00');
  });

  test('set shared savings and verify amount updates', async ({ alexPage }) => {
    await goToSavings(alexPage);

    // Find the Shared Savings card and fill the form
    const sharedCard = alexPage.locator('mat-card', { hasText: 'Shared Savings' }).first();
    await expect(sharedCard).toBeVisible();

    // Fill the amount input
    const amountInput = sharedCard.locator('input[type="number"]');
    await amountInput.fill('300');

    // Click the Add button
    await sharedCard.getByRole('button', { name: 'Add', exact: true }).click();

    // Wait for the save to complete
    await alexPage.waitForLoadState('networkidle');

    // Verify "Your contribution" (the first amount) displays 300,00
    await expect(sharedCard.locator('.current-amount').first()).toContainText('300,00');
  });

  test('household total reflects combined savings', async ({ alexPage }) => {
    await goToSavings(alexPage);

    // "Household total" is shown inside the Shared Savings card
    const sharedCard = alexPage.locator('mat-card', { hasText: 'Shared Savings' }).first();
    await expect(sharedCard.getByText('Household total')).toBeVisible();

    // Its amount (the last of the three shared amounts) should be present
    const totalAmount = sharedCard.locator('.current-amount').last();
    await expect(totalAmount).toBeVisible();
    const text = await totalAmount.textContent();
    expect(text).toBeTruthy();
  });

  test('per-member breakdown shows member name and amounts', async ({ alexPage }) => {
    await goToSavings(alexPage);

    // The Per-Member Breakdown card should be visible
    const breakdownCard = alexPage.locator('mat-card', { hasText: 'Per-Member Breakdown' });
    await expect(breakdownCard).toBeVisible();

    // Should show Alex's name
    await expect(breakdownCard.getByText('Alex TestOwner')).toBeVisible();

    // Should show Personal and Shared labels (one pair per household member,
    // so scope to the first)
    await expect(breakdownCard.getByText(/Personal:/).first()).toBeVisible();
    await expect(breakdownCard.getByText(/Shared:/).first()).toBeVisible();
  });

  test('savings history chart is visible', async ({ alexPage }) => {
    await goToSavings(alexPage);

    // The savings history chart component should be present
    const chart = alexPage.locator('app-savings-history-chart');
    await expect(chart).toBeVisible();
  });
});
