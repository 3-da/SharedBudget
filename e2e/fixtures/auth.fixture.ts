import { test as base, Page } from '@playwright/test';
import { TEST_USERS, apiLogin, AuthTokens } from './test-data';

/**
 * Extended test fixture that provides authenticated pages for Alex and Sam.
 *
 * The Angular app stores the refresh token in localStorage under 'sb_refresh_token'.
 * The access token is in-memory only. When the app loads with a refresh token
 * set, the auth guard allows access (it checks accessToken OR refreshToken),
 * and the interceptor auto-refreshes on the first 401 to get a new access token.
 *
 * Usage:
 *   test('my test', async ({ alexPage, samPage }) => { ... });
 */
type AuthFixtures = {
  alexTokens: AuthTokens;
  samTokens: AuthTokens;
  alexPage: Page;
  samPage: Page;
};

async function createAuthenticatedPage(browser: any, tokens: AuthTokens, baseURL: string): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();

  // Navigate to the app origin so we can set localStorage
  await page.goto(baseURL);

  // Set refresh token — the auth guard checks refreshToken in localStorage
  // The interceptor will auto-refresh to get an access token on first API call
  await page.evaluate((refreshToken: string) => {
    localStorage.setItem('sb_refresh_token', refreshToken);
  }, tokens.refreshToken);

  return page;
}

export const test = base.extend<AuthFixtures>({
  alexTokens: async ({}, use) => {
    const tokens = await apiLogin(TEST_USERS.alex.email, TEST_USERS.alex.password);
    await use(tokens);
  },

  samTokens: async ({}, use) => {
    const tokens = await apiLogin(TEST_USERS.sam.email, TEST_USERS.sam.password);
    await use(tokens);
  },

  alexPage: async ({ browser, alexTokens, baseURL }, use) => {
    const page = await createAuthenticatedPage(browser, alexTokens, baseURL!);
    await use(page);
    await page.context().close();
  },

  samPage: async ({ browser, samTokens, baseURL }, use) => {
    const page = await createAuthenticatedPage(browser, samTokens, baseURL!);
    await use(page);
    await page.context().close();
  },
});

export { expect } from '@playwright/test';
