import { test, expect } from '@playwright/test';
import { TEST_USERS, apiLogin } from '../fixtures/test-data';

/**
 * Auth E2E tests.
 *
 * These tests exercise the authentication flows through the Angular UI.
 * They use the base Playwright test (not the auth fixture) because they
 * test the login/logout flows themselves rather than relying on pre-authenticated
 * pages.
 */
test.describe('Authentication', () => {
  test.describe('Login', () => {
    test('should redirect to main app after login with valid credentials', async ({ page }) => {
      await page.goto('/auth/login');

      // Verify we are on the login page
      await expect(page.getByText('Welcome Back')).toBeVisible();

      // Fill in credentials
      await page.getByLabel('Email').fill(TEST_USERS.alex.email);
      await page.getByLabel('Password').fill(TEST_USERS.alex.password);

      // Submit the form
      await page.getByRole('button', { name: 'Sign In' }).click();

      // Wait for navigation away from the login page
      await expect(page).not.toHaveURL(/\/auth\/login/);

      // The default redirect is /household (see login component: returnUrl || '/household')
      await expect(page).toHaveURL(/\/household/);
    });

    test('should show error message when login with invalid credentials', async ({ page }) => {
      await page.goto('/auth/login');

      await page.getByLabel('Email').fill(TEST_USERS.alex.email);
      await page.getByLabel('Password').fill('WrongPassword999!');

      await page.getByRole('button', { name: 'Sign In' }).click();

      // The backend returns a 401 and the frontend shows the error in a snackbar.
      // MatSnackBar renders inside a <mat-snack-bar-container> with role="status"
      // or as simple-snack-bar. Look for error text in the snackbar.
      const snackbar = page.locator('mat-snack-bar-container');
      await expect(snackbar).toBeVisible({ timeout: 10_000 });

      // The snackbar should contain an error message (either from backend or fallback)
      const snackbarText = await snackbar.textContent();
      expect(snackbarText).toBeTruthy();

      // Should remain on the login page
      await expect(page).toHaveURL(/\/auth\/login/);
    });

    test('should show validation errors when submitting empty form', async ({ page }) => {
      await page.goto('/auth/login');

      // Click submit without filling anything
      await page.getByRole('button', { name: 'Sign In' }).click();

      // Validation errors should appear
      await expect(page.getByText('Email is required')).toBeVisible();
      await expect(page.getByText('Password is required')).toBeVisible();

      // Should remain on the login page
      await expect(page).toHaveURL(/\/auth\/login/);
    });
  });

  test.describe('Route protection', () => {
    test('should redirect unauthenticated user to login when accessing protected route', async ({
      page,
    }) => {
      // Clear any existing auth state
      await page.goto('/auth/login');
      await page.evaluate(() => localStorage.removeItem('sb_refresh_token'));

      // Attempt to navigate to a protected route
      await page.goto('/dashboard');

      // The auth guard should redirect to /auth/login with a returnUrl query param
      await expect(page).toHaveURL(/\/auth\/login/);
      await expect(page).toHaveURL(/returnUrl/);
    });

    test('should redirect unauthenticated user to login when accessing household route', async ({
      page,
    }) => {
      await page.goto('/auth/login');
      await page.evaluate(() => localStorage.removeItem('sb_refresh_token'));

      await page.goto('/household');

      await expect(page).toHaveURL(/\/auth\/login/);
    });
  });

  test.describe('Logout', () => {
    test('should redirect to login page after logout', async ({ page }) => {
      // Authenticate via API to get a valid refresh token
      const tokens = await apiLogin(TEST_USERS.alex.email, TEST_USERS.alex.password);

      // Navigate to the app origin and set the refresh token in localStorage
      await page.goto('/');
      await page.evaluate(
        (refreshToken: string) => {
          localStorage.setItem('sb_refresh_token', refreshToken);
        },
        tokens.refreshToken,
      );

      // Navigate to the app -- the auth guard will allow access because
      // a refresh token exists, and the interceptor will auto-refresh
      await page.goto('/household');

      // Wait for the toolbar to appear (indicates the shell has loaded)
      await expect(page.getByText('SharedBudget')).toBeVisible({ timeout: 10_000 });

      // Open the user menu by clicking the account circle icon button
      await page.getByRole('button', { name: 'User menu' }).click();

      // Click the Logout menu item
      await page.getByRole('menuitem', { name: 'Logout' }).click();

      // Should redirect to the login page
      await expect(page).toHaveURL(/\/auth\/login/, { timeout: 10_000 });

      // Refresh token should be cleared from localStorage
      const refreshToken = await page.evaluate(() =>
        localStorage.getItem('sb_refresh_token'),
      );
      expect(refreshToken).toBeNull();
    });
  });

  test.describe('Navigation', () => {
    test('should navigate from login to register page', async ({ page }) => {
      await page.goto('/auth/login');

      await expect(page.getByText('Welcome Back')).toBeVisible();

      // Click the "Create an account" link
      await page.getByRole('link', { name: 'Create an account' }).click();

      // Should be on the register page
      await expect(page).toHaveURL(/\/auth\/register/);
      await expect(page.getByText('Create Account')).toBeVisible();
    });

    test('should navigate from register to login page', async ({ page }) => {
      await page.goto('/auth/register');

      await expect(page.getByText('Create Account')).toBeVisible();

      // Click the "Already have an account?" link
      await page.getByRole('link', { name: 'Already have an account?' }).click();

      // Should be back on the login page
      await expect(page).toHaveURL(/\/auth\/login/);
      await expect(page.getByText('Welcome Back')).toBeVisible();
    });

    test('should navigate from login to forgot password page', async ({ page }) => {
      await page.goto('/auth/login');

      // Click the "Forgot password?" link
      await page.getByRole('link', { name: 'Forgot password?' }).click();

      // Should be on the forgot password page
      await expect(page).toHaveURL(/\/auth\/forgot-password/);
    });
  });

  test.describe('Register page', () => {
    test('should display all required form fields', async ({ page }) => {
      await page.goto('/auth/register');

      // Verify all form fields are present
      await expect(page.getByLabel('First Name')).toBeVisible();
      await expect(page.getByLabel('Last Name')).toBeVisible();
      await expect(page.getByLabel('Email')).toBeVisible();
      // Password fields are rendered by PasswordFieldComponent with labels "Password" and "Confirm Password"
      await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
      await expect(page.getByLabel('Confirm Password')).toBeVisible();

      // Submit button should be present
      await expect(page.getByRole('button', { name: 'Create Account' })).toBeVisible();
    });

    test('should show validation errors when submitting empty register form', async ({
      page,
    }) => {
      await page.goto('/auth/register');

      await page.getByRole('button', { name: 'Create Account' }).click();

      // Required field errors should appear (first name, last name use "Required" text)
      const requiredErrors = page.getByText('Required');
      await expect(requiredErrors.first()).toBeVisible();
    });
  });
});
