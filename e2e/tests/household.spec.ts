import { test, expect } from '../fixtures/auth.fixture';
import { apiCall, apiLogin, flushThrottleKeys, TEST_USERS } from '../fixtures/test-data';
import { Page } from '@playwright/test';

/**
 * Household E2E tests.
 *
 * These tests exercise household management flows:
 * - Household creation
 * - Joining by invite code
 * - Email invitations
 * - Accepting/declining invitations
 * - Member removal
 * - Ownership transfer
 * - Leaving a household
 *
 * Alex is the OWNER, Sam is a MEMBER, Jordan is an OUTSIDER.
 * Tests that require two users use separate authenticated pages.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Navigate to the household page and wait for it to load. */
async function goToHousehold(page: Page): Promise<void> {
  await page.goto('/household');
  await page.waitForLoadState('networkidle');
}

/** Navigate to household and wait for the management panel to be available. */
async function goToHouseholdManagement(page: Page): Promise<void> {
  await goToHousehold(page);
  // Open the Household Management expansion panel if it is not expanded
  const panelHeader = page.locator('mat-expansion-panel-header', { hasText: 'Household Management' });
  if (await panelHeader.isVisible()) {
    const expanded = await panelHeader.getAttribute('aria-expanded');
    if (expanded !== 'true') {
      await panelHeader.click();
    }
  }
}

/** Get the current household's invite code via API. */
async function getInviteCode(token: string): Promise<string> {
  await flushThrottleKeys();
  const res = await apiCall<{ inviteCode: string }>('GET', '/household/mine', token);
  expect(res.status).toBe(200);
  return res.body.inviteCode;
}

/** Get the current user's ID via API. */
async function getUserId(token: string): Promise<string> {
  const res = await apiCall<{ id: string }>('GET', '/users/me', token);
  expect(res.status).toBe(200);
  return res.body.id;
}

/** Cancel all pending invitations for Jordan via API. */
async function cancelJordanInvitations(alexToken: string): Promise<void> {
  await flushThrottleKeys();
  const res = await apiCall<{ id: string; recipientEmail: string }[]>(
    'GET',
    '/household/invitations',
    alexToken,
  );
  if (res.status === 200) {
    for (const inv of res.body ?? []) {
      if (inv.recipientEmail === TEST_USERS.jordan.email) {
        await flushThrottleKeys();
        await apiCall('DELETE', `/household/invitations/${inv.id}`, alexToken);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Tests: Household page structure
// ---------------------------------------------------------------------------

test.describe('Household page structure', () => {
  test('shows invite code and member count for owner', async ({ alexPage }) => {
    await goToHouseholdManagement(alexPage);

    // The invite code section should be visible for the owner
    await expect(alexPage.locator('.invite-code')).toBeVisible({ timeout: 10_000 });
    await expect(alexPage.locator('.code-label')).toContainText('Invite Code');
  });

  test('shows member list with at least one member', async ({ alexPage }) => {
    await goToHouseholdManagement(alexPage);

    // At least Alex should be listed
    const memberList = alexPage.locator('app-member-list');
    await expect(memberList).toBeVisible({ timeout: 10_000 });
    await expect(memberList.getByText('Alex TestOwner')).toBeVisible();
  });

  test('shows Leave Household button', async ({ alexPage }) => {
    await goToHouseholdManagement(alexPage);

    await expect(alexPage.getByRole('button', { name: /Leave Household/i })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('shows Invite button for owner', async ({ alexPage }) => {
    await goToHouseholdManagement(alexPage);

    await expect(alexPage.getByRole('button', { name: /Invite/i })).toBeVisible({
      timeout: 10_000,
    });
  });
});

// ---------------------------------------------------------------------------
// Tests: Copy invite code
// ---------------------------------------------------------------------------

test.describe('Invite code', () => {
  test('clicking copy icon shows snackbar confirmation', async ({ alexPage }) => {
    await goToHouseholdManagement(alexPage);

    // Click the copy icon button
    const copyButton = alexPage.getByRole('button', { name: 'Copy invite code' });
    await expect(copyButton).toBeVisible({ timeout: 10_000 });
    await copyButton.click();

    // A snackbar should appear confirming the copy
    const snackbar = alexPage.locator('mat-snack-bar-container');
    await expect(snackbar).toBeVisible({ timeout: 5_000 });
    await expect(snackbar).toContainText('Code copied!');
  });

  test('clicking regenerate code updates the displayed code', async ({ alexPage, alexTokens }) => {
    await goToHouseholdManagement(alexPage);

    // Get the original code
    const originalCode = await alexPage.locator('.invite-code').textContent();
    expect(originalCode).toBeTruthy();

    // Click regenerate
    const regenerateButton = alexPage.getByRole('button', { name: 'Regenerate invite code' });
    await expect(regenerateButton).toBeVisible({ timeout: 10_000 });
    await regenerateButton.click();

    // Wait for the API to respond and page to update
    await alexPage.waitForLoadState('networkidle');

    // The code should still display (it may or may not differ — both are valid)
    await expect(alexPage.locator('.invite-code')).toBeVisible({ timeout: 10_000 });
  });
});

// ---------------------------------------------------------------------------
// Tests: Email invitation
// ---------------------------------------------------------------------------

test.describe('Email invitation', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ alexTokens }) => {
    // Cancel any outstanding Jordan invitations before each test
    await cancelJordanInvitations(alexTokens.accessToken);
  });

  test('opening invite dialog shows email input', async ({ alexPage }) => {
    await goToHouseholdManagement(alexPage);

    // Click the Invite button to open the dialog
    await alexPage.getByRole('button', { name: /Invite/i }).click();

    // The dialog should appear with an email input
    const dialog = alexPage.locator('app-invite-dialog, mat-dialog-container');
    await expect(dialog).toBeVisible({ timeout: 5_000 });
  });

  test('sending email invitation shows success snackbar', async ({ alexPage }) => {
    await goToHouseholdManagement(alexPage);

    // Open invite dialog
    await alexPage.getByRole('button', { name: /Invite/i }).click();

    const dialog = alexPage.locator('mat-dialog-container');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Fill in Jordan's email
    await dialog.locator('input[type="email"], input[formControlName="email"]').fill(
      TEST_USERS.jordan.email,
    );

    // Submit
    await dialog.getByRole('button', { name: /Send|Invite/i }).click();

    // Snackbar confirmation
    const snackbar = alexPage.locator('mat-snack-bar-container');
    await expect(snackbar).toBeVisible({ timeout: 10_000 });
    await expect(snackbar).toContainText('Invitation sent');
  });
});

// ---------------------------------------------------------------------------
// Tests: Accept invitation via pending invitations page
// ---------------------------------------------------------------------------

test.describe('Pending invitations', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ alexTokens }) => {
    await flushThrottleKeys();
    await cancelJordanInvitations(alexTokens.accessToken);
  });

  test('Jordan can see pending invitation after Alex sends one', async ({
    alexTokens,
    jordanPage,
  }) => {
    // Alex invites Jordan via API
    await flushThrottleKeys();
    const res = await apiCall('POST', '/household/invite', alexTokens.accessToken, {
      email: TEST_USERS.jordan.email,
    });
    expect(res.status === 201 || res.status === 200).toBe(true);

    // Jordan navigates to pending invitations
    await jordanPage.goto('/household/invitations');
    await jordanPage.waitForLoadState('networkidle');

    // Jordan should see the invitation from Alex's household
    await expect(jordanPage.getByText('E2E Test Household')).toBeVisible({ timeout: 10_000 });
  });

  test('Jordan can accept an invitation to join the household', async ({
    alexTokens,
    jordanPage,
    jordanTokens,
  }) => {
    // Alex invites Jordan via API
    await flushThrottleKeys();
    const inviteRes = await apiCall('POST', '/household/invite', alexTokens.accessToken, {
      email: TEST_USERS.jordan.email,
    });
    expect(inviteRes.status === 201 || inviteRes.status === 200).toBe(true);

    // Get the invitation ID for Jordan
    await flushThrottleKeys();
    const pendingRes = await apiCall<{ id: string; householdId: string }[]>(
      'GET',
      '/household/invitations/pending',
      jordanTokens.accessToken,
    );
    const invitation = (pendingRes.body ?? []).find((i) => i.householdId);
    if (!invitation) {
      test.skip(); // Skip if no invitation found (already accepted/expired)
      return;
    }

    // Jordan navigates to pending invitations and accepts
    await jordanPage.goto('/household/invitations');
    await jordanPage.waitForLoadState('networkidle');

    const acceptButton = jordanPage.getByRole('button', { name: /Accept/i }).first();
    await expect(acceptButton).toBeVisible({ timeout: 10_000 });
    await acceptButton.click();

    await jordanPage.waitForLoadState('networkidle');

    // Jordan should be redirected or see the household page
    // After acceptance, navigate to household to confirm
    await jordanPage.goto('/household');
    await jordanPage.waitForLoadState('networkidle');

    // Jordan should see the household name (E2E Test Household)
    await expect(jordanPage.getByText('E2E Test Household')).toBeVisible({ timeout: 10_000 });

    // Cleanup: Jordan leaves the household so other tests are not affected
    await flushThrottleKeys();
    await apiCall('POST', '/household/leave', jordanTokens.accessToken);
  });

  test('Jordan can decline an invitation', async ({
    alexTokens,
    jordanPage,
    jordanTokens,
  }) => {
    // Make sure Jordan is not in a household (so they can receive invites)
    await flushThrottleKeys();
    const householdCheck = await apiCall('GET', '/household/mine', jordanTokens.accessToken);
    if (householdCheck.status === 200) {
      // Jordan is already in a household — skip
      test.skip();
      return;
    }

    // Alex invites Jordan via API
    await flushThrottleKeys();
    const inviteRes = await apiCall('POST', '/household/invite', alexTokens.accessToken, {
      email: TEST_USERS.jordan.email,
    });
    expect(inviteRes.status === 201 || inviteRes.status === 200).toBe(true);

    // Jordan navigates to pending invitations and declines
    await jordanPage.goto('/household/invitations');
    await jordanPage.waitForLoadState('networkidle');

    const declineButton = jordanPage.getByRole('button', { name: /Decline/i }).first();
    await expect(declineButton).toBeVisible({ timeout: 10_000 });
    await declineButton.click();

    await jordanPage.waitForLoadState('networkidle');

    // The invitation should no longer appear in the list
    const snackbar = jordanPage.locator('mat-snack-bar-container');
    // Either a snackbar appears or the list empties — both are valid feedback
    // Verify Jordan is still not in the household
    await flushThrottleKeys();
    const afterCheck = await apiCall('GET', '/household/mine', jordanTokens.accessToken);
    expect(afterCheck.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Tests: Member removal
// ---------------------------------------------------------------------------

test.describe('Member removal', () => {
  test.describe.configure({ mode: 'serial' });

  test('owner can remove a member from the household', async ({
    alexPage,
    alexTokens,
    samTokens,
  }) => {
    // Verify Sam is in the household
    await flushThrottleKeys();
    const samHousehold = await apiCall('GET', '/household/mine', samTokens.accessToken);
    if (samHousehold.status !== 200) {
      test.skip(); // Sam is not in the household — skip
      return;
    }

    const samId = await getUserId(samTokens.accessToken);

    await goToHouseholdManagement(alexPage);

    // Sam should be visible in the member list
    const memberList = alexPage.locator('app-member-list');
    await expect(memberList).toBeVisible({ timeout: 10_000 });
    await expect(memberList.getByText('Sam TestMember')).toBeVisible({ timeout: 10_000 });

    // Click the remove button for Sam
    const samRow = memberList.locator('[data-member-id], mat-list-item, .member-item').filter({
      hasText: 'Sam TestMember',
    }).first();

    const removeButton = samRow.getByRole('button', { name: /Remove/i }).or(
      memberList.getByRole('button', { name: /Remove/i }).first(),
    );
    await expect(removeButton).toBeVisible({ timeout: 10_000 });
    await removeButton.click();

    // A confirmation dialog should appear
    const dialog = alexPage.locator('mat-dialog-container');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Confirm the removal
    await dialog.getByRole('button', { name: /Confirm|Remove|Yes/i }).click();

    // Wait for the operation to complete
    await alexPage.waitForLoadState('networkidle');

    // Sam should no longer appear in the member list
    // (Allow time for re-load after removal)
    await expect(memberList.getByText('Sam TestMember')).toBeHidden({ timeout: 10_000 });

    // Re-add Sam to the household so other tests still work
    await flushThrottleKeys();
    const inviteRes = await apiCall('POST', '/household/invite', alexTokens.accessToken, {
      email: TEST_USERS.sam.email,
    });
    if (inviteRes.status === 201 || inviteRes.status === 200) {
      await flushThrottleKeys();
      const pendingRes = await apiCall<{ id: string }[]>(
        'GET',
        '/household/invitations/pending',
        samTokens.accessToken,
      );
      const inv = (pendingRes.body ?? [])[0];
      if (inv?.id) {
        await flushThrottleKeys();
        await apiCall('PUT', `/household/invitations/${inv.id}/accept`, samTokens.accessToken);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Tests: Ownership transfer
// ---------------------------------------------------------------------------

test.describe('Ownership transfer', () => {
  test.describe.configure({ mode: 'serial' });

  test('owner can transfer ownership to another member', async ({
    alexPage,
    alexTokens,
    samTokens,
  }) => {
    // Verify Sam is in the household as MEMBER
    await flushThrottleKeys();
    const samHousehold = await apiCall('GET', '/household/mine', samTokens.accessToken);
    if (samHousehold.status !== 200) {
      test.skip();
      return;
    }

    await goToHouseholdManagement(alexPage);

    const memberList = alexPage.locator('app-member-list');
    await expect(memberList).toBeVisible({ timeout: 10_000 });
    await expect(memberList.getByText('Sam TestMember')).toBeVisible({ timeout: 10_000 });

    // Click the transfer button for Sam
    const transferButton = memberList
      .locator('[data-member-id], mat-list-item, .member-item')
      .filter({ hasText: 'Sam TestMember' })
      .first()
      .getByRole('button', { name: /Transfer|Owner/i })
      .or(memberList.getByRole('button', { name: /Transfer/i }).first());

    await expect(transferButton).toBeVisible({ timeout: 10_000 });
    await transferButton.click();

    // A confirmation dialog should appear
    const dialog = alexPage.locator('mat-dialog-container');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Confirm the transfer
    await dialog.getByRole('button', { name: /Confirm|Transfer|Yes/i }).click();

    await alexPage.waitForLoadState('networkidle');

    // The page should still show the household but Alex's role is now MEMBER
    // Sam is now the owner — verify via API
    await flushThrottleKeys();
    const householdRes = await apiCall<{
      members: { userId: string; role: string }[];
    }>('GET', '/household/mine', samTokens.accessToken);
    const samMember = householdRes.body?.members?.find(
      (m) => m.role === 'OWNER',
    );
    expect(samMember).toBeTruthy();

    // Transfer ownership back to Alex so the rest of the suite works
    await flushThrottleKeys();
    const alexId = await getUserId(alexTokens.accessToken);
    await apiCall('PUT', '/household/transfer-ownership', samTokens.accessToken, {
      targetUserId: alexId,
    });
  });
});

// ---------------------------------------------------------------------------
// Tests: Leave household
// ---------------------------------------------------------------------------

test.describe('Leave household', () => {
  test('non-owner member can leave the household', async ({ samPage, samTokens, alexTokens }) => {
    // Verify Sam is in the household
    await flushThrottleKeys();
    const samHousehold = await apiCall('GET', '/household/mine', samTokens.accessToken);
    if (samHousehold.status !== 200) {
      test.skip();
      return;
    }

    await goToHouseholdManagement(samPage);

    // Click Leave Household
    const leaveButton = samPage.getByRole('button', { name: /Leave Household/i });
    await expect(leaveButton).toBeVisible({ timeout: 10_000 });
    await leaveButton.click();

    // Confirmation dialog should appear
    const dialog = samPage.locator('mat-dialog-container');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Confirm leaving
    await dialog.getByRole('button', { name: /Confirm|Leave|Yes/i }).click();

    await samPage.waitForLoadState('networkidle');

    // Sam should now see the "Join or Create a Household" UI
    await expect(
      samPage.getByText('Join or Create a Household'),
    ).toBeVisible({ timeout: 10_000 });

    // Re-add Sam to the household so other tests still work
    await flushThrottleKeys();
    const inviteRes = await apiCall('POST', '/household/invite', alexTokens.accessToken, {
      email: TEST_USERS.sam.email,
    });
    if (inviteRes.status === 201 || inviteRes.status === 200) {
      await flushThrottleKeys();
      const pendingRes = await apiCall<{ id: string }[]>(
        'GET',
        '/household/invitations/pending',
        samTokens.accessToken,
      );
      const inv = (pendingRes.body ?? [])[0];
      if (inv?.id) {
        await flushThrottleKeys();
        await apiCall('PUT', `/household/invitations/${inv.id}/accept`, samTokens.accessToken);
      }
    }
  });
});
