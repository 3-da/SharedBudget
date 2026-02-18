import { test, expect } from '../fixtures/auth.fixture';
import { apiCall, flushThrottleKeys, TEST_USERS } from '../fixtures/test-data';

/**
 * Settings E2E tests.
 *
 * These tests exercise the Settings page flows:
 * - Profile update (first name, last name)
 * - Password change
 * - Verify new password works on re-login
 *
 * Alex is the OWNER used for most tests.
 * Tests that mutate password restore the original password afterwards.
 */

// ---------------------------------------------------------------------------
// Tests: Profile update
// ---------------------------------------------------------------------------

test.describe('Profile update', () => {
  test('shows current profile data pre-filled in the form', async ({ alexPage }) => {
    await alexPage.goto('/settings');
    await alexPage.waitForLoadState('networkidle');

    // Profile panel is expanded by default
    const firstNameInput = alexPage.getByLabel('First Name');
    const lastNameInput = alexPage.getByLabel('Last Name');

    await expect(firstNameInput).toBeVisible({ timeout: 10_000 });
    await expect(lastNameInput).toBeVisible({ timeout: 10_000 });

    // Fields should be pre-filled with Alex's data
    await expect(firstNameInput).toHaveValue('Alex');
    await expect(lastNameInput).toHaveValue('TestOwner');
  });

  test('shows success snackbar after profile update', async ({ alexPage }) => {
    await alexPage.goto('/settings');
    await alexPage.waitForLoadState('networkidle');

    const firstNameInput = alexPage.getByLabel('First Name');
    await expect(firstNameInput).toBeVisible({ timeout: 10_000 });

    // Change the first name
    await firstNameInput.fill('Alex');
    const lastNameInput = alexPage.getByLabel('Last Name');
    await lastNameInput.fill('TestOwner');

    // Submit the profile form
    const saveButton = alexPage.locator('app-profile-form').getByRole('button', { name: /Save/i });
    await expect(saveButton).toBeVisible({ timeout: 5_000 });
    await saveButton.click();

    // Success snackbar should appear
    const snackbar = alexPage.locator('mat-snack-bar-container');
    await expect(snackbar).toBeVisible({ timeout: 10_000 });
    await expect(snackbar).toContainText('Profile updated');
  });
});

// ---------------------------------------------------------------------------
// Tests: Password change
// ---------------------------------------------------------------------------

test.describe('Password change', () => {
  test.describe.configure({ mode: 'serial' });

  test('shows error when current password is wrong', async ({ alexPage }) => {
    await alexPage.goto('/settings');
    await alexPage.waitForLoadState('networkidle');

    // Open the Change Password panel
    const panelHeader = alexPage.locator('mat-expansion-panel-header', { hasText: 'Change Password' });
    await expect(panelHeader).toBeVisible({ timeout: 10_000 });
    await panelHeader.click();

    const changePasswordForm = alexPage.locator('app-change-password-form');
    await expect(changePasswordForm).toBeVisible({ timeout: 5_000 });

    // Fill with wrong current password
    await changePasswordForm.getByLabel('Current Password').fill('WrongPassword123!');
    await changePasswordForm.getByLabel('New Password').fill('NewPassword456!');
    await changePasswordForm.getByLabel('Confirm New Password').fill('NewPassword456!');

    await changePasswordForm.getByRole('button', { name: /Change Password|Save/i }).click();

    // Should show error (snackbar or inline message)
    await alexPage.waitForLoadState('networkidle');

    // Expect an error snackbar
    const snackbar = alexPage.locator('mat-snack-bar-container');
    await expect(snackbar).toBeVisible({ timeout: 10_000 });
  });

  test('can change password and re-login with new password', async ({ browser, alexTokens }) => {
    const newPassword = 'NewTestPassword999!';
    const originalPassword = TEST_USERS.alex.password;

    // Create authenticated page for Alex
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await page.goto('/');

      // Set refresh token
      await page.evaluate((refreshToken: string) => {
        localStorage.setItem('sb_refresh_token', refreshToken);
      }, alexTokens.refreshToken);

      await page.goto('/settings');
      await page.waitForLoadState('networkidle');

      // Open the Change Password panel
      const panelHeader = page.locator('mat-expansion-panel-header', { hasText: 'Change Password' });
      await expect(panelHeader).toBeVisible({ timeout: 10_000 });
      await panelHeader.click();

      const changePasswordForm = page.locator('app-change-password-form');
      await expect(changePasswordForm).toBeVisible({ timeout: 5_000 });

      // Fill with correct current password and new password
      await changePasswordForm.getByLabel('Current Password').fill(originalPassword);
      await changePasswordForm.getByLabel('New Password').fill(newPassword);
      await changePasswordForm.getByLabel('Confirm New Password').fill(newPassword);

      await flushThrottleKeys();
      await changePasswordForm.getByRole('button', { name: /Change Password|Save/i }).click();

      // Wait for success
      await page.waitForLoadState('networkidle');

      const snackbar = page.locator('mat-snack-bar-container');
      await expect(snackbar).toBeVisible({ timeout: 10_000 });
      await expect(snackbar).toContainText('Password changed');
    } finally {
      await context.close();
    }

    // Verify new password works by logging in via API
    await flushThrottleKeys();
    const loginRes = await apiCall<{ accessToken: string }>(
      'POST',
      '/auth/login',
      undefined,
      { email: TEST_USERS.alex.email, password: newPassword },
    );
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.accessToken).toBeTruthy();

    // Restore original password via API so other tests are not affected
    await flushThrottleKeys();
    const restoreRes = await apiCall(
      'PUT',
      '/users/me/password',
      loginRes.body.accessToken,
      {
        currentPassword: newPassword,
        newPassword: originalPassword,
        confirmPassword: originalPassword,
      },
    );
    expect(restoreRes.status === 200 || restoreRes.status === 204).toBe(true);
  });
});
