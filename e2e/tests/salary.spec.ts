import { test, expect } from '../fixtures/auth.fixture';
import { Page } from '@playwright/test';

/**
 * Salary E2E tests.
 *
 * These tests exercise the salary overview page where users can set
 * their default and current salary. Alex (owner) is authenticated
 * via the auth fixture.
 */

/** Helper: Navigate to the salary page and wait for it to load. */
async function goToSalary(page: Page): Promise<void> {
  await page.goto('/salary');
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: 'Salary' })).toBeVisible({ timeout: 10_000 });
}

/** Helper: Navigate to the dashboard and wait for it to load. */
async function goToDashboard(page: Page): Promise<void> {
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 10_000 });
}

test.describe('Salary', () => {
  test.describe.configure({ mode: 'serial' });

  test('salary page loads with form visible', async ({ alexPage }) => {
    await goToSalary(alexPage);

    // My Salary card should be visible
    await expect(alexPage.getByText('My Salary')).toBeVisible();

    // Form fields should be present
    await expect(alexPage.getByLabel('Default Salary (EUR)')).toBeVisible();
    await expect(alexPage.getByLabel('Current Salary (EUR)')).toBeVisible();

    // Save button should be present
    await expect(alexPage.getByRole('button', { name: 'Save Salary' })).toBeVisible();
  });

  test('set salary and verify it is saved', async ({ alexPage }) => {
    await goToSalary(alexPage);

    // Fill the salary form
    await alexPage.getByLabel('Default Salary (EUR)').fill('3000');
    await alexPage.getByLabel('Current Salary (EUR)').fill('3500');

    // Submit the form
    await alexPage.getByRole('button', { name: 'Save Salary' }).click();

    // Wait for the save to complete
    await alexPage.waitForLoadState('networkidle');

    // Verify the form still shows the values (they persist after save)
    await expect(alexPage.getByLabel('Default Salary (EUR)')).toHaveValue('3000');
    await expect(alexPage.getByLabel('Current Salary (EUR)')).toHaveValue('3500');
  });

  test('salary reflected in dashboard income card', async ({ alexPage }) => {
    await goToDashboard(alexPage);

    // The income card should show Alex's salary
    const incomeCard = alexPage.locator('app-income-summary-card');
    await expect(incomeCard).toBeVisible();

    // Alex's name and salary should be shown
    await expect(incomeCard.getByText('Alex TestOwner')).toBeVisible();

    // The salary amount should be non-zero (3500 from previous test)
    // de-DE format: 3.500,00
    await expect(incomeCard.getByText('3.500,00')).toBeVisible();
  });

  test('year navigation works on salary page', async ({ alexPage }) => {
    await goToSalary(alexPage);

    const currentYear = new Date().getFullYear();

    // The year label should show the current year
    await expect(alexPage.getByText(currentYear.toString())).toBeVisible();

    // Click the left arrow (prev year)
    const yearNav = alexPage.locator('.year-nav');
    await yearNav.locator('button').first().click();

    // Wait for data reload
    await alexPage.waitForLoadState('networkidle');

    // The year label should now show the previous year
    const prevYear = currentYear - 1;
    await expect(alexPage.getByText(prevYear.toString())).toBeVisible();

    // Click the right arrow (next year) to go back
    await yearNav.locator('button').last().click();
    await alexPage.waitForLoadState('networkidle');

    // Should be back to the current year
    await expect(alexPage.getByText(currentYear.toString())).toBeVisible();
  });

  test('yearly statistics show after salary is set', async ({ alexPage }) => {
    await goToSalary(alexPage);

    // The yearly stats section should be visible
    await expect(alexPage.getByText('Yearly Total')).toBeVisible();
    await expect(alexPage.getByText('Monthly Avg')).toBeVisible();

    // The salary chart component should be present
    const chart = alexPage.locator('app-salary-chart');
    await expect(chart).toBeVisible();
  });
});
