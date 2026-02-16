import { test, expect } from '../fixtures/auth.fixture';
import { apiCall, ApprovalResponse, UserProfile } from '../fixtures/test-data';
import { Page } from '@playwright/test';

/**
 * Dashboard and Settlement E2E tests.
 *
 * These tests exercise the dashboard overview cards and the settlement workflow
 * between two authenticated household members (Alex = owner, Sam = member).
 * Data is seeded via the API to keep tests fast and deterministic.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Navigate to the dashboard page and wait for it to load. */
async function goToDashboard(page: Page): Promise<void> {
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 10_000 });
}

/** Navigate to the household page and wait for it to load. */
async function goToHousehold(page: Page): Promise<void> {
  await page.goto('/household');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('app-settlement-summary')).toBeVisible({ timeout: 10_000 });
}

/** Get the current user's profile. */
async function getUserProfile(token: string): Promise<UserProfile> {
  const res = await apiCall<UserProfile>('GET', '/users/me', token);
  expect(res.status).toBe(200);
  return res.body;
}

/** Propose a shared expense via API and return the response. */
async function proposeSharedExpense(
  token: string,
  overrides: Record<string, unknown> = {},
): Promise<{ status: number; body: ApprovalResponse }> {
  return apiCall<ApprovalResponse>('POST', '/expenses/shared', token, {
    name: 'E2E Settlement Test',
    amount: 600,
    category: 'RECURRING',
    frequency: 'MONTHLY',
    ...overrides,
  });
}

/** Get pending approvals via API. */
async function getPendingApprovals(token: string): Promise<ApprovalResponse[]> {
  const res = await apiCall<ApprovalResponse[]>('GET', '/approvals', token);
  return res.body;
}

/** Accept an approval via API. */
async function acceptApproval(
  token: string,
  approvalId: string,
): Promise<{ status: number; body: ApprovalResponse }> {
  return apiCall<ApprovalResponse>('PUT', `/approvals/${approvalId}/accept`, token, {});
}

/** Cancel an approval via API (by the original requester). */
async function cancelApproval(
  token: string,
  approvalId: string,
): Promise<void> {
  await apiCall('PUT', `/approvals/${approvalId}/cancel`, token);
}

/**
 * Clean up all pending approvals to prevent test interference.
 * Alex cancels any they requested; accepts any Sam requested.
 */
async function cleanupPendingApprovals(
  alexToken: string,
  samToken: string,
): Promise<void> {
  const pending = await getPendingApprovals(alexToken);
  for (const approval of pending) {
    if (approval.requestedBy?.firstName === 'Alex') {
      await cancelApproval(alexToken, approval.id);
    } else {
      await acceptApproval(alexToken, approval.id);
    }
  }
}

/**
 * Computes the expected month label for the current month, matching the
 * format used by DashboardComponent.monthLabel() — en-US long month + year.
 */
function currentMonthLabel(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth()).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Tests: Dashboard overview cards
// ---------------------------------------------------------------------------

test.describe('Dashboard overview cards', () => {
  test('all four summary cards are visible', async ({ alexPage }) => {
    await goToDashboard(alexPage);

    await expect(alexPage.getByText('Income', { exact: true })).toBeVisible();
    await expect(alexPage.getByText('Expenses', { exact: true })).toBeVisible();
    await expect(alexPage.locator('app-savings-card')).toBeVisible();
    await expect(alexPage.getByText('Settlement', { exact: true })).toBeVisible();
  });

  test('subtitle shows the current month and year', async ({ alexPage }) => {
    await goToDashboard(alexPage);

    const expected = currentMonthLabel();
    await expect(alexPage.getByText(expected)).toBeVisible();
  });

  test('income card shows member names and total', async ({ alexPage }) => {
    await goToDashboard(alexPage);

    const incomeCard = alexPage.locator('app-income-summary-card');
    await expect(incomeCard).toBeVisible();
    await expect(incomeCard.getByText('Alex TestOwner')).toBeVisible();
    await expect(incomeCard.getByText('Sam TestMember')).toBeVisible();
    await expect(incomeCard.getByText('Total')).toBeVisible();
  });

  test('expense card shows personal and shared expense rows', async ({ alexPage }) => {
    await goToDashboard(alexPage);

    const expenseCard = alexPage.locator('app-expense-summary-card');
    await expect(expenseCard).toBeVisible();
    await expect(expenseCard.getByText('Shared expenses')).toBeVisible();
    await expect(expenseCard.getByText('Grand Total')).toBeVisible();
  });

  test('dashboard API responds within 2 seconds', async ({ alexPage }) => {
    const responsePromise = alexPage.waitForResponse((res) =>
      res.url().includes('/dashboard') && res.status() === 200,
    );
    await alexPage.goto('/dashboard');
    const response = await responsePromise;
    const timing = response.timing();
    expect(timing.responseEnd).toBeLessThan(2000);
  });
});

// ---------------------------------------------------------------------------
// Tests: Settlement flow on household page
// ---------------------------------------------------------------------------

test.describe('Settlement on household page', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ alexTokens, samTokens }) => {
    await cleanupPendingApprovals(alexTokens.accessToken, samTokens.accessToken);
  });

  test('settlement section shows info banner', async ({ alexPage }) => {
    await goToHousehold(alexPage);

    const settlementSection = alexPage.locator('app-settlement-summary');
    await expect(settlementSection).toBeVisible();
    await expect(
      settlementSection.getByText('Calculates who owes whom based on shared expenses'),
    ).toBeVisible();
  });

  test('settlement shows who owes whom after approving a shared expense with payer', async ({
    alexTokens,
    samTokens,
    alexPage,
  }) => {
    // Get Alex's user ID to set as paidByUserId
    const alexProfile = await getUserProfile(alexTokens.accessToken);
    const alexUserId = alexProfile.id;
    expect(alexUserId).toBeTruthy();

    // Propose a shared expense where Alex is the payer
    const proposalRes = await proposeSharedExpense(alexTokens.accessToken, {
      name: 'E2E Dashboard Settlement',
      amount: 500,
      paidByUserId: alexUserId,
    });
    expect(proposalRes.status).toBe(201);

    // Sam accepts the approval
    const pendingForSam = await getPendingApprovals(samTokens.accessToken);
    const approval = pendingForSam.find(
      (a: any) => a.proposedData?.name === 'E2E Dashboard Settlement',
    );
    expect(approval).toBeTruthy();
    const acceptRes = await acceptApproval(samTokens.accessToken, approval.id);
    expect(acceptRes.status).toBe(200);

    // Navigate to the household page
    await goToHousehold(alexPage);

    // The settlement section shows a message about who owes whom
    const settlementSection = alexPage.locator('app-settlement-summary');
    await expect(settlementSection).toBeVisible();

    const messageEl = settlementSection.locator('.message');
    await expect(messageEl).toBeVisible();
    const messageText = await messageEl.textContent();
    expect(messageText).toBeTruthy();
    expect(messageText!.length).toBeGreaterThan(0);

    // The "Mark as Paid" button should be visible (not yet settled)
    await expect(
      settlementSection.getByRole('button', { name: /Mark as Paid/i }),
    ).toBeVisible();

    // No settled badge yet
    await expect(settlementSection.locator('.settled-badge')).toBeHidden();
  });

  test('clicking Mark as Paid shows the settled badge', async ({ alexPage }) => {
    await goToHousehold(alexPage);

    const settlementSection = alexPage.locator('app-settlement-summary');
    await expect(settlementSection).toBeVisible({ timeout: 10_000 });

    const markPaidButton = settlementSection.getByRole('button', { name: /Mark as Paid/i });
    await expect(markPaidButton).toBeVisible({ timeout: 10_000 });

    // Click "Mark as Paid"
    await markPaidButton.click();

    // The settled badge should appear
    const settledBadge = settlementSection.locator('.settled-badge');
    await expect(settledBadge).toBeVisible({ timeout: 10_000 });
    await expect(settledBadge.getByText('Settled')).toBeVisible();

    // The "Mark as Paid" button should no longer be visible
    await expect(markPaidButton).toBeHidden();
  });

  test('settlement card on dashboard also reflects settled status', async ({ alexPage }) => {
    await goToDashboard(alexPage);

    const settlementCard = alexPage.locator('app-settlement-card');
    await expect(settlementCard).toBeVisible();

    // The settled indicator should be visible
    await expect(settlementCard.getByText('Settled')).toBeVisible({ timeout: 10_000 });

    // The "Mark as Paid" button should NOT be visible
    await expect(
      settlementCard.getByRole('button', { name: /Mark as Paid/i }),
    ).toBeHidden();
  });
});
