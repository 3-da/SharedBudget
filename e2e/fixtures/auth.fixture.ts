import { test as base, Browser, Page } from '@playwright/test';
import { TEST_USERS, apiLogin, AuthTokens } from './test-data';

/**
 * Extended test fixture that provides authenticated pages for Alex and Sam.
 *
 * The refresh token only ever exists as an HttpOnly cookie set by the backend
 * (the login response body carries just the access token) — it can't be read
 * from JS or forwarded from a raw fetch() into a browser context. So *Page
 * fixtures log in through the real UI, the same way a user would; *Tokens
 * fixtures separately hit the API directly for tests that only need a bearer
 * token to seed/inspect data, not a browser session.
 *
 * Usage:
 *   test('my test', async ({ alexPage, samPage }) => { ... });
 */
type AuthFixtures = {
  alexTokens: AuthTokens;
  samTokens: AuthTokens;
  jordanTokens: AuthTokens;
  alexPage: Page;
  samPage: Page;
  jordanPage: Page;
};

async function createAuthenticatedPage(browser: Browser, user: { email: string; password: string }, baseURL: string): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${baseURL}/auth/login`);
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL(url => !url.pathname.startsWith('/auth/login'), { timeout: 15_000 });

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

  jordanTokens: async ({}, use) => {
    const tokens = await apiLogin(TEST_USERS.jordan.email, TEST_USERS.jordan.password);
    await use(tokens);
  },

  alexPage: async ({ browser, baseURL }, use) => {
    const page = await createAuthenticatedPage(browser, TEST_USERS.alex, baseURL!);
    await use(page);
    await page.context().close();
  },

  samPage: async ({ browser, baseURL }, use) => {
    const page = await createAuthenticatedPage(browser, TEST_USERS.sam, baseURL!);
    await use(page);
    await page.context().close();
  },

  jordanPage: async ({ browser, baseURL }, use) => {
    const page = await createAuthenticatedPage(browser, TEST_USERS.jordan, baseURL!);
    await use(page);
    await page.context().close();
  },
});

export { expect } from '@playwright/test';
