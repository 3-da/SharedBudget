import { test, expect } from '../fixtures/auth.fixture';
import { apiCall } from '../fixtures/test-data';
import { Page } from '@playwright/test';

/**
 * Approvals E2E tests.
 *
 * These tests exercise the approval review workflow between two authenticated
 * household members (Alex = owner, Sam = member). Data is seeded via the API
 * to keep tests fast and deterministic. Each test cleans up pending approvals
 * beforehand to avoid cross-test interference.
 */

/** Helper: Navigate to the approvals page and wait for it to load. */
async function goToApprovalsList(page: Page): Promise<void> {
  await page.goto('/approvals');
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: 'Approvals' })).toBeVisible();
}

/** Helper: Propose a shared expense via API and return the response. */
async function proposeSharedExpense(
  token: string,
  name: string,
  amount: number = 500,
): Promise<{ status: number; body: any }> {
  return apiCall('POST', '/expenses/shared', token, {
    name,
    amount,
    category: 'RECURRING',
    frequency: 'MONTHLY',
  });
}

/** Helper: Get pending approvals via API. */
async function getPendingApprovals(token: string): Promise<any[]> {
  const res = await apiCall('GET', '/approvals', token);
  return res.body as any[];
}

/** Helper: Cancel an approval via API (by the original requester). */
async function cancelApproval(
  token: string,
  approvalId: string,
): Promise<void> {
  await apiCall('PUT', `/approvals/${approvalId}/cancel`, token);
}

/** Helper: Accept an approval via API. */
async function acceptApproval(
  token: string,
  approvalId: string,
): Promise<void> {
  await apiCall('PUT', `/approvals/${approvalId}/accept`, token, {});
}

/**
 * Helper: Clean up all pending approvals to prevent test interference.
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

test.describe('Approvals', () => {
  test.beforeEach(async ({ alexTokens, samTokens }) => {
    await cleanupPendingApprovals(alexTokens.accessToken, samTokens.accessToken);
  });

  test('pending approval proposed by Alex is visible to Sam', async ({
    alexTokens,
    samPage,
  }) => {
    // Arrange: Alex proposes a shared expense via API
    const res = await proposeSharedExpense(alexTokens.accessToken, 'E2E Visible Proposal');
    expect(res.status).toBe(201);

    // Act: Sam navigates to the approvals page
    await goToApprovalsList(samPage);

    // Assert: The pending approval is visible with the proposed expense name
    await expect(samPage.getByText('E2E Visible Proposal')).toBeVisible();

    // Assert: Accept and Reject buttons are visible (Sam is not the requester)
    const approvalCard = samPage.locator('app-approval-card', { hasText: 'E2E Visible Proposal' });
    await expect(approvalCard).toBeVisible();
    await expect(approvalCard.getByRole('button', { name: /Accept/i })).toBeVisible();
    await expect(approvalCard.getByRole('button', { name: /Reject/i })).toBeVisible();
  });

  test('accepting an approval via UI shows success and removes from pending', async ({
    alexTokens,
    samPage,
  }) => {
    // Arrange: Alex proposes a shared expense
    const res = await proposeSharedExpense(alexTokens.accessToken, 'E2E Accept Test');
    expect(res.status).toBe(201);

    // Act: Sam navigates to approvals and clicks Accept
    await goToApprovalsList(samPage);

    const approvalCard = samPage.locator('app-approval-card', { hasText: 'E2E Accept Test' });
    await expect(approvalCard).toBeVisible();

    await approvalCard.getByRole('button', { name: /Accept/i }).click();

    // Assert: The approval disappears from the pending list (optimistic update + reload)
    // Wait for the card to disappear from the Pending tab
    await expect(
      samPage.locator('app-approval-card', { hasText: 'E2E Accept Test' }),
    ).toBeHidden({ timeout: 10_000 });

    // Assert: Verify it now appears in the History tab as ACCEPTED
    await samPage.getByRole('tab', { name: /History/i }).click();
    await expect(samPage.getByText('E2E Accept Test')).toBeVisible({ timeout: 10_000 });
    await expect(samPage.getByText('ACCEPTED')).toBeVisible();
  });

  test('rejecting an approval requires a message and removes from pending', async ({
    alexTokens,
    samPage,
  }) => {
    // Arrange: Alex proposes a shared expense
    const res = await proposeSharedExpense(alexTokens.accessToken, 'E2E Reject Test');
    expect(res.status).toBe(201);

    // Act: Sam navigates to approvals and clicks Reject
    await goToApprovalsList(samPage);

    const approvalCard = samPage.locator('app-approval-card', { hasText: 'E2E Reject Test' });
    await expect(approvalCard).toBeVisible();

    await approvalCard.getByRole('button', { name: /Reject/i }).click();

    // Assert: The reject dialog opens
    const dialog = samPage.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Reject Approval')).toBeVisible();

    // Assert: The Reject button in the dialog is disabled when reason is empty
    const rejectButton = dialog.getByRole('button', { name: 'Reject' });
    await expect(rejectButton).toBeDisabled();

    // Act: Enter a rejection reason (must be at least 3 characters per the validator)
    await dialog.getByLabel('Reason').fill('Too expensive for this month');

    // Assert: The Reject button is now enabled
    await expect(rejectButton).toBeEnabled();

    // Act: Submit the rejection
    await rejectButton.click();

    // Assert: The dialog closes
    await expect(dialog).toBeHidden();

    // Assert: The approval is removed from the pending list
    await expect(
      samPage.locator('app-approval-card', { hasText: 'E2E Reject Test' }),
    ).toBeHidden({ timeout: 10_000 });

    // Assert: Verify it appears in the History tab as REJECTED
    await samPage.getByRole('tab', { name: /History/i }).click();
    await expect(samPage.getByText('E2E Reject Test')).toBeVisible({ timeout: 10_000 });
    await expect(samPage.getByText('REJECTED')).toBeVisible();
  });

  test('own proposals show Cancel button instead of Accept/Reject', async ({
    alexTokens,
    alexPage,
  }) => {
    // Arrange: Alex proposes a shared expense
    const res = await proposeSharedExpense(alexTokens.accessToken, 'E2E Own Proposal');
    expect(res.status).toBe(201);

    // Act: Alex navigates to the approvals page (viewing their own proposal)
    await goToApprovalsList(alexPage);

    // Assert: The approval IS visible in the pending list (backend returns all household approvals)
    const approvalCard = alexPage.locator('app-approval-card', { hasText: 'E2E Own Proposal' });
    await expect(approvalCard).toBeVisible();

    // Assert: Accept and Reject buttons are NOT shown for own proposals
    await expect(approvalCard.getByRole('button', { name: /Accept/i })).toBeHidden();
    await expect(approvalCard.getByRole('button', { name: /Reject/i })).toBeHidden();

    // Assert: Cancel button IS shown for own proposals
    await expect(approvalCard.getByRole('button', { name: /Cancel/i })).toBeVisible();
  });
});
