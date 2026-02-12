/**
 * Shared test data for E2E tests.
 *
 * These users and households are created during global setup (or via API calls
 * in individual tests) and referenced by all test suites.
 */

export const API_URL = process.env.BACKEND_URL ?? 'http://localhost:3000/api/v1';

export const TEST_USERS = {
  alex: {
    email: 'alex.e2e@test.com',
    password: 'TestPassword123!',
    firstName: 'Alex',
    lastName: 'TestOwner',
  },
  sam: {
    email: 'sam.e2e@test.com',
    password: 'TestPassword456!',
    firstName: 'Sam',
    lastName: 'TestMember',
  },
} as const;

export const TEST_HOUSEHOLD = {
  name: 'E2E Test Household',
} as const;

/** Tokens are set during test setup and shared across specs in a suite. */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Helper: register a user via the API.
 * Returns the response body.
 */
export async function apiRegister(user: (typeof TEST_USERS)[keyof typeof TEST_USERS]) {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(user),
  });
  return { status: res.status, body: await res.json() };
}

/**
 * Helper: login a user via the API.
 * Returns access + refresh tokens.
 */
export async function apiLogin(email: string, password: string): Promise<AuthTokens> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(`Login failed for ${email}: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return { accessToken: data.accessToken, refreshToken: data.refreshToken };
}

/**
 * Helper: make an authenticated API call.
 */
export async function apiCall(
  method: string,
  path: string,
  token: string,
  body?: unknown,
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const responseBody = await res.json().catch(() => null);
  return { status: res.status, body: responseBody };
}
