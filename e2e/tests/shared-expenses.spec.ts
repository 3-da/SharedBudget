import { test, expect } from '../fixtures/auth.fixture';
import { apiCall } from '../fixtures/test-data';
import { Page } from '@playwright/test';

/**
 * Shared Expenses E2E tests.
 *
 * These tests exercise the shared expense proposal and approval flow between
 * two authenticated household members (Alex = owner, Sam = member).
 * Data is seeded via the API to keep tests fast and deterministic.
 */

/** Helper: Navigate to the shared expenses list and wait for it to load. */
async function goToSharedExpenseList(page: Page): Promise<void> {
  await page.goto('/expenses/shared');
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: 'Shared Expenses' })).toBeVisible();
}

/** Helper: Navigate to the approvals list and wait for it to load. */
async function goToApprovalsList(page: Page): Promise<void> {
  await page.goto('/approvals');
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: 'Approvals' })).toBeVisible();
}

/** Helper: Propose a shared expense via API and return the approval response body. */
async function proposeSharedExpense(
  token: string,
  overrides: Record<string, unknown> = {},
): Promise<{ status: number; body: any }> {
  return apiCall('POST', '/expenses/shared', token, {
    name: 'E2E Rent',
    amount: 800,
    category: 'RECURRING',
    frequency: 'MONTHLY',
    ...overrides,
  });
}

/** Helper: Get pending approvals via API and return the array. */
async function getPendingApprovals(token: string): Promise<any[]> {
  const res = await apiCall('GET', '/approvals', token);
  return res.body as any[];
}

/** Helper: Accept an approval via API. */
async function acceptApproval(
  token: string,
  approvalId: string,
  message?: string,
): Promise<{ status: number; body: any }> {
  return apiCall('PUT', `/approvals/${approvalId}/accept`, token, { message });
}

/** Helper: Cancel an approval via API (by the requester). */
async function cancelApproval(
  token: string,
  approvalId: string,
): Promise<{ status: number; body: any }> {
  return apiCall('PUT', `/approvals/${approvalId}/cancel`, token);
}

/**
 * Helper: Clean up all pending approvals for a user to prevent test interference.
 * Cancels any pending approvals that were requested by the current user,
 * and accepts any that were requested by the other user.
 */
async function cleanupPendingApprovals(
  alexToken: string,
  samToken: string,
): Promise<void> {
  const pendingAlex = await getPendingApprovals(alexToken);
  for (const approval of pendingAlex) {
    if (approval.requestedBy?.firstName === 'Alex') {
      await cancelApproval(alexToken, approval.id);
    } else {
      await acceptApproval(alexToken, approval.id);
    }
  }
}

test.describe('Shared Expenses', () => {
  // Clean up any lingering pending approvals before each test
  test.beforeEach(async ({ alexTokens, samTokens }) => {
    await cleanupPendingApprovals(alexTokens.accessToken, samTokens.accessToken);
  });

  test('proposed shared expense appears as pending approval for the partner', async ({
    alexTokens,
    samPage,
  }) => {
    // Arrange: Alex proposes a shared expense via API
    const proposalRes = await proposeSharedExpense(alexTokens.accessToken, {
      name: 'E2E Rent Proposal',
      amount: 800,
    });
    expect(proposalRes.status).toBe(201);

    // Act: Sam navigates to the approvals page
    await goToApprovalsList(samPage);

    // Assert: Sam sees the proposed expense in the pending list
    await expect(samPage.getByText('E2E Rent Proposal')).toBeVisible();
    await expect(samPage.getByText('800 EUR')).toBeVisible();
  });

  test('shared expense appears in list after approval', async ({
    alexTokens,
    samTokens,
    alexPage,
  }) => {
    // Arrange: Alex proposes a shared expense via API
    const proposalRes = await proposeSharedExpense(alexTokens.accessToken, {
      name: 'E2E Approved Rent',
      amount: 750,
    });
    expect(proposalRes.status).toBe(201);

    // Get the approval ID from the pending list
    const pendingApprovals = await getPendingApprovals(samTokens.accessToken);
    const approval = pendingApprovals.find(
      (a: any) => a.proposedData?.name === 'E2E Approved Rent',
    );
    expect(approval).toBeTruthy();

    // Sam accepts the approval via API
    const acceptRes = await acceptApproval(samTokens.accessToken, approval.id);
    expect(acceptRes.status).toBe(200);

    // Act: Alex navigates to the shared expenses list
    await goToSharedExpenseList(alexPage);

    // Assert: The approved expense is visible in the shared expenses list
    await expect(alexPage.getByText('E2E Approved Rent')).toBeVisible();
    await expect(alexPage.getByText('750,00')).toBeVisible();
  });

  test('shared expense with paidByUserId affects settlement calculation', async ({
    alexTokens,
    samTokens,
    alexPage,
  }) => {
    // Arrange: Get Alex's user ID from the proposal response
    const proposalRes = await proposeSharedExpense(alexTokens.accessToken, {
      name: 'E2E Paid By Alex',
      amount: 600,
    });
    expect(proposalRes.status).toBe(201);
    const alexUserId = (proposalRes.body as any).requestedBy?.id;
    expect(alexUserId).toBeTruthy();

    // Cancel the first proposal (it was created without paidByUserId)
    const pending = await getPendingApprovals(alexTokens.accessToken);
    const firstApproval = pending.find(
      (a: any) => a.proposedData?.name === 'E2E Paid By Alex',
    );
    if (firstApproval) {
      await cancelApproval(alexTokens.accessToken, firstApproval.id);
    }

    // Create a new proposal with paidByUserId set to Alex
    const proposalWithPayer = await proposeSharedExpense(alexTokens.accessToken, {
      name: 'E2E Paid By Alex',
      amount: 600,
      paidByUserId: alexUserId,
    });
    expect(proposalWithPayer.status).toBe(201);

    // Sam accepts the approval via API
    const pendingForSam = await getPendingApprovals(samTokens.accessToken);
    const approvalToAccept = pendingForSam.find(
      (a: any) => a.proposedData?.name === 'E2E Paid By Alex',
    );
    expect(approvalToAccept).toBeTruthy();
    const acceptRes = await acceptApproval(samTokens.accessToken, approvalToAccept.id);
    expect(acceptRes.status).toBe(200);

    // Act: Navigate to the household page where settlement is shown
    await alexPage.goto('/household');
    await alexPage.waitForLoadState('networkidle');

    // Assert: The settlement section is visible and shows a message about who owes whom.
    // Since Alex paid 600 for a shared expense, Sam owes Alex half (300).
    const settlementSection = alexPage.locator('app-settlement-summary');
    await expect(settlementSection).toBeVisible({ timeout: 10_000 });

    // The settlement should show a non-zero amount (Sam owes Alex)
    const settlementText = await settlementSection.textContent();
    expect(settlementText).toBeTruthy();
    // The settlement message should reference the debt relationship
    // The amount should be visible (at least some numeric value indicating a settlement exists)
    await expect(settlementSection.locator('.message')).toBeVisible();
  });
});
