/**
 * Shared test data for E2E tests.
 *
 * These users and households are created during global setup (or via API calls
 * in individual tests) and referenced by all test suites.
 */

import Redis from 'ioredis';

export const API_URL = process.env.BACKEND_URL ?? 'http://localhost:3000/api/v1';
const REDIS_HOST = process.env.REDIS_HOST ?? 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT ?? '6379', 10);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD ?? 'redis_secret';

export const TEST_USERS = {
  alex: {
    email: 'alex@test.com',
    password: 'TestPassword123!',
    firstName: 'Alex',
    lastName: 'TestOwner',
  },
  sam: {
    email: 'sam@test.com',
    password: 'TestPassword456!',
    firstName: 'Sam',
    lastName: 'TestMember',
  },
  jordan: {
    email: 'jordan@test.com',
    password: 'TestPassword789!',
    firstName: 'Jordan',
    lastName: 'TestOutsider',
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

/** API response shape for user profile. */
export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

/** API response shape for an expense (personal or shared). */
export interface ExpenseResponse {
  id: string;
  name: string;
  amount: number;
  type: string;
  category: string;
  frequency?: string;
  paidByUserId?: string | null;
  createdById: string;
}

/** API response shape for an approval. */
export interface ApprovalResponse {
  id: string;
  status: string;
  proposedData: Record<string, unknown>;
  requestedBy: { id: string; firstName: string; lastName: string };
  reviewedBy?: { id: string; firstName: string; lastName: string } | null;
}

/** Typed API call result. */
export interface ApiResult<T = unknown> {
  status: number;
  body: T;
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
 * Known Redis key prefixes used by the application (sessions, tokens, etc.).
 * Everything else is a throttle/rate-limit key and safe to delete during E2E tests.
 */
const APP_KEY_PREFIXES = ['refresh:', 'user_sessions:', 'verify:', 'reset:'];

/**
 * Flush all Redis throttle/block keys so E2E tests don't hit rate limits.
 *
 * The NestJS ThrottlerGuard stores keys using an IP+hash pattern (not prefixed
 * with "throttle"), so we can't match by name. Instead we delete every key that
 * is NOT a known application key (refresh tokens, sessions, etc.).
 */
export async function flushThrottleKeys(): Promise<void> {
  const redis = new Redis({ host: REDIS_HOST, port: REDIS_PORT, password: REDIS_PASSWORD, lazyConnect: true });
  try {
    await redis.connect();
    let cursor = '0';
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'COUNT', 200);
      cursor = nextCursor;
      const toDelete = keys.filter(k => !APP_KEY_PREFIXES.some(p => k.startsWith(p)));
      if (toDelete.length > 0) await redis.del(...toDelete);
    } while (cursor !== '0');
  } finally {
    await redis.quit();
  }
}

/**
 * Helper: login a user via the API.
 * Flushes throttle keys first to prevent 429 errors during E2E test runs.
 * Returns access + refresh tokens.
 */
export async function apiLogin(email: string, password: string): Promise<AuthTokens> {
  await flushThrottleKeys();

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
export async function apiCall<T = unknown>(
  method: string,
  path: string,
  token: string,
  body?: unknown,
): Promise<ApiResult<T>> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const responseBody = await res.json().catch(() => null);
  return { status: res.status, body: responseBody as T };
}

/**
 * Clean up all E2E test data to prevent cross-run interference.
 * Deletes personal expenses, proposes+accepts shared expense deletions,
 * cancels pending approvals, and resets savings.
 */
export async function cleanupAllTestData(): Promise<void> {
  await flushThrottleKeys();
  const alexTokens = await apiLogin(TEST_USERS.alex.email, TEST_USERS.alex.password);
  const samTokens = await apiLogin(TEST_USERS.sam.email, TEST_USERS.sam.password);

  // 1. Cancel all pending approvals first
  const pending = await apiCall<ApprovalResponse[]>('GET', '/approvals', alexTokens.accessToken);
  for (const approval of pending.body ?? []) {
    await flushThrottleKeys();
    if (approval.requestedBy?.firstName === 'Alex') {
      await apiCall('PUT', `/approvals/${approval.id}/cancel`, alexTokens.accessToken);
    } else {
      await apiCall('PUT', `/approvals/${approval.id}/accept`, alexTokens.accessToken, {});
    }
  }

  // 2. Delete all personal expenses for both users
  await flushThrottleKeys();
  const alexExpenses = await apiCall<ExpenseResponse[]>('GET', '/expenses/personal', alexTokens.accessToken);
  for (const expense of alexExpenses.body ?? []) {
    await apiCall('DELETE', `/expenses/personal/${expense.id}`, alexTokens.accessToken);
  }
  await flushThrottleKeys();
  const samExpenses = await apiCall<ExpenseResponse[]>('GET', '/expenses/personal', samTokens.accessToken);
  for (const expense of samExpenses.body ?? []) {
    await apiCall('DELETE', `/expenses/personal/${expense.id}`, samTokens.accessToken);
  }

  // 3. Delete all shared expenses (propose delete → auto-accept)
  await flushThrottleKeys();
  const sharedExpenses = await apiCall<ExpenseResponse[]>('GET', '/expenses/shared', alexTokens.accessToken);
  for (const expense of sharedExpenses.body ?? []) {
    await flushThrottleKeys();
    // Alex proposes deletion
    const delRes = await apiCall<ApprovalResponse>('DELETE', `/expenses/shared/${expense.id}`, alexTokens.accessToken);
    if (delRes.status === 201) {
      const approvalId = delRes.body?.id;
      if (approvalId) {
        // Sam accepts the deletion
        await apiCall('PUT', `/approvals/${approvalId}/accept`, samTokens.accessToken, {});
      }
    }
  }

  // 4. Reset savings to 0 for both users
  await flushThrottleKeys();
  await apiCall('PUT', '/savings/me', alexTokens.accessToken, { amount: 0 });
  await apiCall('PUT', '/savings/shared', alexTokens.accessToken, { amount: 0 });
  await apiCall('PUT', '/savings/me', samTokens.accessToken, { amount: 0 });
  await apiCall('PUT', '/savings/shared', samTokens.accessToken, { amount: 0 });

  // 5. Final throttle flush
  await flushThrottleKeys();
}
