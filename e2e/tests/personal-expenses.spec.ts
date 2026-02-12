import { test, expect } from '../fixtures/auth.fixture';
import { Page } from '@playwright/test';

/**
 * Helper: Navigate to the personal expenses list and wait for the page to load.
 */
async function goToExpenseList(page: Page): Promise<void> {
  await page.goto('/expenses/personal');
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: 'My Expenses' })).toBeVisible();
}

/**
 * Helper: Navigate to the "New Personal Expense" form from the list page.
 */
async function goToCreateForm(page: Page): Promise<void> {
  await goToExpenseList(page);
  await page.getByRole('button', { name: /Add Expense/i }).click();
  await expect(page.getByText('New Personal Expense')).toBeVisible();
}

/**
 * Helper: Fill the expense name and amount fields.
 */
async function fillNameAndAmount(page: Page, name: string, amount: number): Promise<void> {
  await page.getByLabel('Name').fill(name);
  await page.getByLabel('Amount (EUR)').fill(amount.toString());
}

/**
 * Helper: Select a value from an Angular Material mat-select by its label.
 * Opens the dropdown by clicking the label, then clicks the matching option.
 */
async function selectMatOption(page: Page, label: string, optionText: string): Promise<void> {
  await page.getByLabel(label).click();
  await page.getByRole('option', { name: optionText }).click();
}

/**
 * Helper: Submit the expense form and wait for navigation back to the list.
 */
async function submitCreateForm(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Create Expense' }).click();
  await page.waitForURL('**/expenses/personal');
  await expect(page.getByRole('heading', { name: 'My Expenses' })).toBeVisible();
}

/**
 * Helper: Submit the expense edit form and wait for navigation back to the list.
 */
async function submitUpdateForm(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Update Expense' }).click();
  await page.waitForURL('**/expenses/personal');
  await expect(page.getByRole('heading', { name: 'My Expenses' })).toBeVisible();
}

test.describe('Personal Expenses', () => {
  test.describe.configure({ mode: 'serial' });

  test('create a RECURRING MONTHLY expense and verify it appears in the list', async ({ alexPage }) => {
    await goToCreateForm(alexPage);

    // Fill basic fields - Category defaults to "Recurring" and Frequency to "Monthly"
    await fillNameAndAmount(alexPage, 'E2E Gym', 49.99);

    // Verify defaults are already correct (RECURRING + MONTHLY)
    await expect(alexPage.getByLabel('Category')).toContainText('Recurring');
    await expect(alexPage.getByLabel('Frequency')).toContainText('Monthly');

    await submitCreateForm(alexPage);

    // Verify the expense appears in the list
    await expect(alexPage.getByText('E2E Gym')).toBeVisible();
    // Amount is formatted with de-DE locale: 49,99
    await expect(alexPage.getByText('49,99')).toBeVisible();
  });

  test('create a ONE_TIME FULL expense and verify it shows in the list', async ({ alexPage }) => {
    await goToCreateForm(alexPage);

    await fillNameAndAmount(alexPage, 'E2E Furniture', 500);

    // Select ONE_TIME category
    await selectMatOption(alexPage, 'Category', 'One-time');

    // When Payment Type is not set (null) or FULL, month/year fields are visible
    // The month and year default to current month/year in onSubmit, but we set them explicitly
    const now = new Date();
    const currentMonth = now.toLocaleDateString('en-US', { month: 'long' });
    const currentYear = now.getFullYear().toString();

    await selectMatOption(alexPage, 'Expense Month', currentMonth);
    await alexPage.getByLabel('Expense Year').fill(currentYear);

    await submitCreateForm(alexPage);

    // Verify the expense appears in the list
    await expect(alexPage.getByText('E2E Furniture')).toBeVisible();
    // 500 formatted as de-DE: 500,00
    await expect(alexPage.getByText('500,00')).toBeVisible();
  });

  test('create a ONE_TIME INSTALLMENTS MONTHLY expense and verify it shows in the list', async ({ alexPage }) => {
    await goToCreateForm(alexPage);

    await fillNameAndAmount(alexPage, 'E2E Laptop', 1200);

    // Select ONE_TIME category
    await selectMatOption(alexPage, 'Category', 'One-time');

    // Select Payment Type: Installments
    await selectMatOption(alexPage, 'Payment Type', 'Installments');

    // Set start month and year
    const now = new Date();
    const currentMonth = now.toLocaleDateString('en-US', { month: 'long' });
    const currentYear = now.getFullYear().toString();

    await selectMatOption(alexPage, 'Start Month', currentMonth);
    await alexPage.getByLabel('Start Year').fill(currentYear);

    // Select Installment Frequency: Monthly
    await selectMatOption(alexPage, 'Installment Frequency', 'Monthly');

    // Set duration to 2 years
    await alexPage.getByLabel('Duration (years)').fill('2');

    // Verify the installment hint calculation: 1200 / (12 * 2) = 50.00
    await expect(alexPage.getByText('Each installment: 50.00 EUR')).toBeVisible();

    await submitCreateForm(alexPage);

    // Verify the expense appears in the list
    await expect(alexPage.getByText('E2E Laptop')).toBeVisible();
    // Total amount displayed on the card: 1200 formatted as de-DE: 1.200,00
    await expect(alexPage.getByText('1.200,00')).toBeVisible();
  });

  test('edit an existing expense amount and verify the update', async ({ alexPage }) => {
    await goToExpenseList(alexPage);

    // Find the "E2E Gym" expense card and click its edit button
    const gymCard = alexPage.locator('app-expense-card', { hasText: 'E2E Gym' });
    await expect(gymCard).toBeVisible();
    await gymCard.getByRole('button', { name: 'edit' }).click();

    // Verify we are on the edit form
    await expect(alexPage.getByText('Edit Personal Expense')).toBeVisible();

    // Update the amount
    await alexPage.getByLabel('Amount (EUR)').fill('99.99');

    await submitUpdateForm(alexPage);

    // Verify the updated amount is visible (de-DE: 99,99)
    const updatedCard = alexPage.locator('app-expense-card', { hasText: 'E2E Gym' });
    await expect(updatedCard).toBeVisible();
    await expect(updatedCard.getByText('99,99')).toBeVisible();
  });

  test('delete an expense and verify it is removed from the list', async ({ alexPage }) => {
    await goToExpenseList(alexPage);

    // Verify the expense exists before deletion
    const furnitureCard = alexPage.locator('app-expense-card', { hasText: 'E2E Furniture' });
    await expect(furnitureCard).toBeVisible();

    // Click the delete button on the card
    await furnitureCard.getByRole('button', { name: 'delete' }).click();

    // Confirm the deletion in the dialog
    const dialog = alexPage.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Delete this expense permanently?')).toBeVisible();
    await dialog.getByRole('button', { name: 'Delete' }).click();

    // Wait for dialog to close
    await expect(dialog).toBeHidden();

    // Verify the expense is no longer in the list
    await expect(alexPage.locator('app-expense-card', { hasText: 'E2E Furniture' })).toBeHidden();
  });
});
