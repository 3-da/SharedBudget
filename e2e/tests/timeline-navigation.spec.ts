import { test, expect } from '../fixtures/auth.fixture';
import { Page } from '@playwright/test';

/**
 * Month Picker Navigation E2E Tests.
 *
 * The MonthPickerComponent provides a +/- 12 month range from today's date.
 * Today is dynamically determined, so tests compute expected labels relative
 * to the current date to avoid hard-coding month names.
 *
 * Component DOM structure (app-month-picker):
 *   .month-picker-inline
 *     button[mat-icon-button] (prev)  — chevron_left, disabled at -12 boundary
 *     button.month-label              — displays "Month Year", opens overlay
 *     button[mat-icon-button] (next)  — chevron_right, disabled at +12 boundary
 *
 *   Overlay (.month-overlay):
 *     .overlay-header
 *       button[mat-icon-button] (prev year)
 *       span.year-label
 *       button[mat-icon-button] (next year)
 *     .month-grid
 *       12x button.month-cell (Jan..Dec)
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the locator for the inline prev-month button inside the month picker.
 * It is the first child button within .month-picker-inline.
 */
function prevMonthButton(page: Page) {
  return page.locator('app-month-picker .month-picker-inline > button:first-child');
}

/**
 * Returns the locator for the inline next-month button inside the month picker.
 * It is the last child button within .month-picker-inline.
 */
function nextMonthButton(page: Page) {
  return page.locator('app-month-picker .month-picker-inline > button:last-child');
}

/**
 * Returns the locator for the clickable month/year label (e.g., "February 2026").
 */
function monthLabel(page: Page) {
  return page.locator('app-month-picker .month-label');
}

/**
 * Returns the locator for the overlay container that appears when the label is clicked.
 */
function monthOverlay(page: Page) {
  return page.locator('.month-overlay');
}

/**
 * Returns the locator for the year label inside the overlay header.
 */
function overlayYearLabel(page: Page) {
  return page.locator('.month-overlay .year-label');
}

/**
 * Returns the locator for the prev-year button inside the overlay header.
 */
function overlayPrevYearButton(page: Page) {
  return page.locator('.month-overlay .overlay-header > button:first-child');
}

/**
 * Returns the locator for the next-year button inside the overlay header.
 */
function overlayNextYearButton(page: Page) {
  return page.locator('.month-overlay .overlay-header > button:last-child');
}

/**
 * Returns the locator for a specific month cell in the overlay grid.
 * @param shortName - The short month name, e.g., "Jan", "Feb", "Jun".
 */
function overlayMonthCell(page: Page, shortName: string) {
  return page.locator('.month-overlay .month-cell', { hasText: new RegExp(`^${shortName}$`) });
}

/**
 * Computes the expected month label string (e.g., "March 2026") for a date
 * that is `offset` months from today.
 */
function expectedLabelAtOffset(offset: number): string {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return target.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/**
 * Returns the short month name (e.g., "Jun") for a date that is `offset` months
 * from today.
 */
function shortMonthAtOffset(offset: number): string {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return target.toLocaleDateString('en-US', { month: 'short' });
}

/**
 * Returns the full year (number) for a date that is `offset` months from today.
 */
function yearAtOffset(offset: number): number {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return target.getFullYear();
}

/**
 * Navigate to a page and wait until the month picker is visible.
 */
async function goToPageWithMonthPicker(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
  await expect(monthLabel(page)).toBeVisible({ timeout: 10_000 });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Month Picker Navigation', () => {
  test.describe('Arrow button navigation on Personal Expenses page', () => {
    test('navigate forward one month via next arrow button', async ({ alexPage }) => {
      await goToPageWithMonthPicker(alexPage, '/expenses/personal');

      // The initial label should show the current month
      const initialLabel = expectedLabelAtOffset(0);
      await expect(monthLabel(alexPage)).toHaveText(new RegExp(initialLabel));

      // Click the next-month arrow
      await nextMonthButton(alexPage).click();

      // Verify the label updated to the next month
      const nextLabel = expectedLabelAtOffset(1);
      await expect(monthLabel(alexPage)).toHaveText(new RegExp(nextLabel));
    });

    test('navigate backward one month via prev arrow button', async ({ alexPage }) => {
      await goToPageWithMonthPicker(alexPage, '/expenses/personal');

      const initialLabel = expectedLabelAtOffset(0);
      await expect(monthLabel(alexPage)).toHaveText(new RegExp(initialLabel));

      // Click the prev-month arrow
      await prevMonthButton(alexPage).click();

      // Verify the label updated to the previous month
      const prevLabel = expectedLabelAtOffset(-1);
      await expect(monthLabel(alexPage)).toHaveText(new RegExp(prevLabel));
    });

    test('navigate forward then backward returns to current month', async ({ alexPage }) => {
      await goToPageWithMonthPicker(alexPage, '/expenses/personal');

      const initialLabel = expectedLabelAtOffset(0);
      await expect(monthLabel(alexPage)).toHaveText(new RegExp(initialLabel));

      // Go forward, then back
      await nextMonthButton(alexPage).click();
      await expect(monthLabel(alexPage)).toHaveText(new RegExp(expectedLabelAtOffset(1)));

      await prevMonthButton(alexPage).click();
      await expect(monthLabel(alexPage)).toHaveText(new RegExp(initialLabel));
    });
  });

  test.describe('Overlay month selection', () => {
    test('select a month from the overlay grid', async ({ alexPage }) => {
      await goToPageWithMonthPicker(alexPage, '/expenses/personal');

      // Open the overlay by clicking the month label
      await monthLabel(alexPage).click();
      await expect(monthOverlay(alexPage)).toBeVisible();

      // The year label in the overlay should show the current year
      const currentYear = new Date().getFullYear();
      await expect(overlayYearLabel(alexPage)).toHaveText(currentYear.toString());

      // Click a different month in the grid (pick a month that is definitely in range)
      // Use June, which is within the +/- 12 month range from any month
      const targetShort = 'Jun';
      const junCell = overlayMonthCell(alexPage, targetShort);

      // Only click if not disabled (it should be in range for the current year)
      await expect(junCell).not.toBeDisabled();
      await junCell.click();

      // Verify the overlay closed
      await expect(monthOverlay(alexPage)).toBeHidden();

      // Verify the month label now shows June of the current year
      await expect(monthLabel(alexPage)).toHaveText(new RegExp(`June ${currentYear}`));
    });

    test('overlay closes when clicking backdrop', async ({ alexPage }) => {
      await goToPageWithMonthPicker(alexPage, '/expenses/personal');

      // Open the overlay
      await monthLabel(alexPage).click();
      await expect(monthOverlay(alexPage)).toBeVisible();

      // Click the transparent backdrop to close
      // The backdrop is a CDK overlay backdrop element
      await alexPage.locator('.cdk-overlay-backdrop').click({ force: true });

      // Verify the overlay closed
      await expect(monthOverlay(alexPage)).toBeHidden();
    });
  });

  test.describe('Year navigation in overlay', () => {
    test('navigate to previous year in overlay and select a month', async ({ alexPage }) => {
      await goToPageWithMonthPicker(alexPage, '/expenses/personal');

      const currentYear = new Date().getFullYear();
      const prevYear = currentYear - 1;

      // Open the overlay
      await monthLabel(alexPage).click();
      await expect(monthOverlay(alexPage)).toBeVisible();
      await expect(overlayYearLabel(alexPage)).toHaveText(currentYear.toString());

      // Click the prev-year arrow in the overlay header
      await overlayPrevYearButton(alexPage).click();
      await expect(overlayYearLabel(alexPage)).toHaveText(prevYear.toString());

      // Select a month that is within range in the previous year.
      // Since min range is -12 months from today, months near the end of the
      // previous year should be in range.
      const targetShort = shortMonthAtOffset(-3);
      const targetYear = yearAtOffset(-3);

      // Navigate the overlay year to match the target year
      if (targetYear !== prevYear) {
        // If the target is in the current year, go back to current year
        await overlayNextYearButton(alexPage).click();
        await expect(overlayYearLabel(alexPage)).toHaveText(targetYear.toString());
      }

      const cell = overlayMonthCell(alexPage, targetShort);
      await expect(cell).not.toBeDisabled();
      await cell.click();

      // Verify the overlay closed and the label shows the selected month/year
      await expect(monthOverlay(alexPage)).toBeHidden();
      const expectedLabel = expectedLabelAtOffset(-3);
      await expect(monthLabel(alexPage)).toHaveText(new RegExp(expectedLabel));
    });

    test('navigate to next year in overlay and select a month', async ({ alexPage }) => {
      await goToPageWithMonthPicker(alexPage, '/expenses/personal');

      const currentYear = new Date().getFullYear();
      const nextYear = currentYear + 1;

      // Open the overlay
      await monthLabel(alexPage).click();
      await expect(monthOverlay(alexPage)).toBeVisible();

      // Click the next-year arrow in the overlay header
      await overlayNextYearButton(alexPage).click();
      await expect(overlayYearLabel(alexPage)).toHaveText(nextYear.toString());

      // Select a month that is within range in the next year.
      // Use a month that is +3 from today (guaranteed in range).
      const targetShort = shortMonthAtOffset(3);
      const targetYear = yearAtOffset(3);

      // Navigate overlay year to match
      if (targetYear !== nextYear) {
        await overlayPrevYearButton(alexPage).click();
        await expect(overlayYearLabel(alexPage)).toHaveText(targetYear.toString());
      }

      const cell = overlayMonthCell(alexPage, targetShort);
      await expect(cell).not.toBeDisabled();
      await cell.click();

      await expect(monthOverlay(alexPage)).toBeHidden();
      const expectedLabel = expectedLabelAtOffset(3);
      await expect(monthLabel(alexPage)).toHaveText(new RegExp(expectedLabel));
    });
  });

  test.describe('Boundary limits (+/- 12 months)', () => {
    test('next-month button is disabled after navigating to +12 boundary', async ({ alexPage }) => {
      await goToPageWithMonthPicker(alexPage, '/expenses/personal');

      // Navigate forward 12 times to reach the max boundary
      for (let i = 0; i < 12; i++) {
        await expect(nextMonthButton(alexPage)).toBeEnabled();
        await nextMonthButton(alexPage).click();
      }

      // After 12 forward clicks, we should be at +12 months from today
      const maxLabel = expectedLabelAtOffset(12);
      await expect(monthLabel(alexPage)).toHaveText(new RegExp(maxLabel));

      // The next-month button should now be disabled
      await expect(nextMonthButton(alexPage)).toBeDisabled();

      // The prev-month button should still be enabled
      await expect(prevMonthButton(alexPage)).toBeEnabled();
    });

    test('prev-month button is disabled after navigating to -12 boundary', async ({ alexPage }) => {
      await goToPageWithMonthPicker(alexPage, '/expenses/personal');

      // Navigate backward 12 times to reach the min boundary
      for (let i = 0; i < 12; i++) {
        await expect(prevMonthButton(alexPage)).toBeEnabled();
        await prevMonthButton(alexPage).click();
      }

      // After 12 backward clicks, we should be at -12 months from today
      const minLabel = expectedLabelAtOffset(-12);
      await expect(monthLabel(alexPage)).toHaveText(new RegExp(minLabel));

      // The prev-month button should now be disabled
      await expect(prevMonthButton(alexPage)).toBeDisabled();

      // The next-month button should still be enabled
      await expect(nextMonthButton(alexPage)).toBeEnabled();
    });

    test('overlay disables out-of-range months at boundary year', async ({ alexPage }) => {
      await goToPageWithMonthPicker(alexPage, '/expenses/personal');

      // Navigate to the +12 boundary via arrow
      for (let i = 0; i < 12; i++) {
        await nextMonthButton(alexPage).click();
      }

      // Open overlay at the max boundary month
      await monthLabel(alexPage).click();
      await expect(monthOverlay(alexPage)).toBeVisible();

      // Determine which month is at +12 and verify months after it are disabled
      const maxDate = new Date(new Date().getFullYear(), new Date().getMonth() + 12, 1);
      const maxMonth = maxDate.getMonth(); // 0-indexed
      const maxYear = maxDate.getFullYear();

      await expect(overlayYearLabel(alexPage)).toHaveText(maxYear.toString());

      // Months after the max month in the same year should be disabled
      const allMonthShorts = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

      for (let i = maxMonth + 1; i < 12; i++) {
        const cell = overlayMonthCell(alexPage, allMonthShorts[i]);
        await expect(cell).toBeDisabled();
      }

      // The max month itself should be enabled
      const maxCell = overlayMonthCell(alexPage, allMonthShorts[maxMonth]);
      await expect(maxCell).not.toBeDisabled();

      // Close overlay
      await alexPage.locator('.cdk-overlay-backdrop').click({ force: true });
    });

    test('overlay year navigation buttons are disabled at boundary years', async ({ alexPage }) => {
      await goToPageWithMonthPicker(alexPage, '/expenses/personal');

      // The min date is -12 months from today, the max date is +12 months.
      const now = new Date();
      const minYear = new Date(now.getFullYear(), now.getMonth() - 12, 1).getFullYear();
      const maxYear = new Date(now.getFullYear(), now.getMonth() + 12, 1).getFullYear();

      // Open overlay
      await monthLabel(alexPage).click();
      await expect(monthOverlay(alexPage)).toBeVisible();

      // Navigate to the min year
      const currentYear = now.getFullYear();
      const yearsToGoBack = currentYear - minYear;
      for (let i = 0; i < yearsToGoBack; i++) {
        await overlayPrevYearButton(alexPage).click();
      }

      await expect(overlayYearLabel(alexPage)).toHaveText(minYear.toString());

      // The prev-year button should be disabled at the min year
      await expect(overlayPrevYearButton(alexPage)).toBeDisabled();

      // Navigate to the max year
      const yearsToGoForward = maxYear - minYear;
      for (let i = 0; i < yearsToGoForward; i++) {
        await overlayNextYearButton(alexPage).click();
      }

      await expect(overlayYearLabel(alexPage)).toHaveText(maxYear.toString());

      // The next-year button should be disabled at the max year
      await expect(overlayNextYearButton(alexPage)).toBeDisabled();

      // Close overlay
      await alexPage.locator('.cdk-overlay-backdrop').click({ force: true });
    });
  });

  test.describe('Month picker on other pages', () => {
    test('month picker on household page updates displayed month', async ({ alexPage }) => {
      await goToPageWithMonthPicker(alexPage, '/household');

      const initialLabel = expectedLabelAtOffset(0);
      await expect(monthLabel(alexPage)).toHaveText(new RegExp(initialLabel));

      // Click next month
      await nextMonthButton(alexPage).click();

      // Wait for the content to potentially reload (loading spinner appears and disappears)
      // Use a short wait to allow the API call to complete
      await alexPage.waitForLoadState('networkidle');

      // Verify the month label updated
      const nextLabel = expectedLabelAtOffset(1);
      await expect(monthLabel(alexPage)).toHaveText(new RegExp(nextLabel));
    });

    test('month picker on shared expenses page works', async ({ alexPage }) => {
      await goToPageWithMonthPicker(alexPage, '/expenses/shared');

      const initialLabel = expectedLabelAtOffset(0);
      await expect(monthLabel(alexPage)).toHaveText(new RegExp(initialLabel));

      // Click next month arrow
      await nextMonthButton(alexPage).click();

      const nextLabel = expectedLabelAtOffset(1);
      await expect(monthLabel(alexPage)).toHaveText(new RegExp(nextLabel));
    });

    test('month picker on savings page works', async ({ alexPage }) => {
      await goToPageWithMonthPicker(alexPage, '/savings');

      const initialLabel = expectedLabelAtOffset(0);
      await expect(monthLabel(alexPage)).toHaveText(new RegExp(initialLabel));

      // Click next month arrow
      await nextMonthButton(alexPage).click();

      const nextLabel = expectedLabelAtOffset(1);
      await expect(monthLabel(alexPage)).toHaveText(new RegExp(nextLabel));

      // Also verify backward navigation
      await prevMonthButton(alexPage).click();
      await expect(monthLabel(alexPage)).toHaveText(new RegExp(initialLabel));
    });

    test('month picker overlay works on household page', async ({ alexPage }) => {
      await goToPageWithMonthPicker(alexPage, '/household');

      // Open the overlay
      await monthLabel(alexPage).click();
      await expect(monthOverlay(alexPage)).toBeVisible();

      // Select a month 2 months ahead
      const targetShort = shortMonthAtOffset(2);
      const targetYear = yearAtOffset(2);

      // Ensure the overlay shows the correct year
      const currentYearText = await overlayYearLabel(alexPage).textContent();
      if (currentYearText && parseInt(currentYearText, 10) !== targetYear) {
        await overlayNextYearButton(alexPage).click();
      }

      const cell = overlayMonthCell(alexPage, targetShort);
      await expect(cell).not.toBeDisabled();
      await cell.click();

      // Verify overlay closed and label updated
      await expect(monthOverlay(alexPage)).toBeHidden();
      const expectedLabel = expectedLabelAtOffset(2);
      await expect(monthLabel(alexPage)).toHaveText(new RegExp(expectedLabel));

      // Wait for data reload
      await alexPage.waitForLoadState('networkidle');
    });
  });

  test.describe('Recurring Timeline page', () => {
    /**
     * The recurring timeline at /expenses/personal/:id/timeline shows a
     * 24-month grid of payment entries. It does NOT use the MonthPickerComponent,
     * so these tests validate the timeline grid itself rather than month picker
     * interactions.
     *
     * Prerequisites: These tests assume at least one recurring expense exists
     * from the personal-expenses E2E test suite (e.g., "E2E Gym").
     */
    test('recurring timeline displays month cards with amounts', async ({ alexPage }) => {
      // First, navigate to the personal expenses list to find a recurring expense
      await goToPageWithMonthPicker(alexPage, '/expenses/personal');
      await alexPage.waitForLoadState('networkidle');

      // Look for a recurring expense card with a timeline button
      const expenseCard = alexPage.locator('app-expense-card').first();
      const timelineVisible = await expenseCard.getByRole('button', { name: /timeline/i }).isVisible().catch(() => false);

      if (!timelineVisible) {
        // No recurring expenses exist; skip this test gracefully
        test.skip();
        return;
      }

      // Click the timeline button
      await expenseCard.getByRole('button', { name: /timeline/i }).click();

      // Wait for the timeline page to load
      await alexPage.waitForLoadState('networkidle');
      await expect(alexPage.getByText(/timeline/i)).toBeVisible({ timeout: 10_000 });

      // The timeline should contain multiple mat-card elements (one per month)
      const timelineCards = alexPage.locator('.timeline mat-card');
      const cardCount = await timelineCards.count();
      expect(cardCount).toBeGreaterThan(0);

      // At least one card should have a visible amount
      const firstCardContent = timelineCards.first().locator('.amount');
      await expect(firstCardContent).toBeVisible();
    });

    test('current month card is highlighted in the timeline', async ({ alexPage }) => {
      await goToPageWithMonthPicker(alexPage, '/expenses/personal');
      await alexPage.waitForLoadState('networkidle');

      const expenseCard = alexPage.locator('app-expense-card').first();
      const timelineVisible = await expenseCard.getByRole('button', { name: /timeline/i }).isVisible().catch(() => false);

      if (!timelineVisible) {
        test.skip();
        return;
      }

      await expenseCard.getByRole('button', { name: /timeline/i }).click();
      await alexPage.waitForLoadState('networkidle');

      // The current month card should have the .current class (border highlight)
      const currentCard = alexPage.locator('.timeline mat-card.current');
      await expect(currentCard).toBeVisible({ timeout: 10_000 });
    });

    test('back button on timeline returns to expense list', async ({ alexPage }) => {
      await goToPageWithMonthPicker(alexPage, '/expenses/personal');
      await alexPage.waitForLoadState('networkidle');

      const expenseCard = alexPage.locator('app-expense-card').first();
      const timelineVisible = await expenseCard.getByRole('button', { name: /timeline/i }).isVisible().catch(() => false);

      if (!timelineVisible) {
        test.skip();
        return;
      }

      await expenseCard.getByRole('button', { name: /timeline/i }).click();
      await alexPage.waitForLoadState('networkidle');

      // Click the "Back" button
      await alexPage.getByRole('button', { name: /Back/i }).click();

      // Verify we returned to the personal expenses list
      await expect(alexPage).toHaveURL(/\/expenses\/personal$/);
      await expect(alexPage.getByRole('heading', { name: 'My Expenses' })).toBeVisible();
    });
  });
});
