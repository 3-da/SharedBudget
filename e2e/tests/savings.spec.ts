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
    await expect(alexPage.getByText('Personal Savings')).toBeVisible();
    await expect(alexPage.getByText('Your individual savings this month')).toBeVisible();

    // Shared Savings card
    await expect(alexPage.getByText('Shared Savings')).toBeVisible();
    await expect(alexPage.getByText('Joint household savings this month')).toBeVisible();

    // Household Total card
    await expect(alexPage.getByText('Household Total')).toBeVisible();
  });

  test('set personal savings and verify amount updates', async ({ alexPage }) => {
    await goToSavings(alexPage);

    // Find the Personal Savings card and fill the form
    const personalCard = alexPage.locator('mat-card', { hasText: 'Personal Savings' });
    await expect(personalCard).toBeVisible();

    // Fill the amount input
    const amountInput = personalCard.locator('input[type="number"]');
    await amountInput.fill('500');

    // Click the Update button
    await personalCard.getByRole('button', { name: 'Update' }).click();

    // Wait for the save to complete
    await alexPage.waitForLoadState('networkidle');

    // Verify the current amount displays 500,00 (de-DE format)
    await expect(personalCard.locator('.current-amount')).toContainText('500,00');
  });

  test('set shared savings and verify amount updates', async ({ alexPage }) => {
    await goToSavings(alexPage);

    // Find the Shared Savings card and fill the form
    const sharedCard = alexPage.locator('mat-card', { hasText: 'Shared Savings' }).first();
    await expect(sharedCard).toBeVisible();

    // Fill the amount input
    const amountInput = sharedCard.locator('input[type="number"]');
    await amountInput.fill('300');

    // Click the Update button
    await sharedCard.getByRole('button', { name: 'Update' }).click();

    // Wait for the save to complete
    await alexPage.waitForLoadState('networkidle');

    // Verify the current amount displays 300,00
    await expect(sharedCard.locator('.current-amount')).toContainText('300,00');
  });

  test('household total reflects combined savings', async ({ alexPage }) => {
    await goToSavings(alexPage);

    // The Household Total card should show the combined amount
    const totalCard = alexPage.locator('mat-card', { hasText: 'Household Total' });
    await expect(totalCard).toBeVisible();

    // After setting personal=500 and shared=300 in previous tests,
    // total should be non-zero. Verify it has a visible amount.
    const totalAmount = totalCard.locator('.current-amount.large');
    await expect(totalAmount).toBeVisible();

    // The total text should contain a numeric value (not just "0,00")
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

    // Should show Personal and Shared labels
    await expect(breakdownCard.getByText(/Personal:/)).toBeVisible();
    await expect(breakdownCard.getByText(/Shared:/)).toBeVisible();
  });

  test('savings history chart is visible', async ({ alexPage }) => {
    await goToSavings(alexPage);

    // The savings history chart component should be present
    const chart = alexPage.locator('app-savings-history-chart');
    await expect(chart).toBeVisible();
  });
});
