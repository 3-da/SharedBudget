import { cleanupAllTestData, ensureTestFixturesExist } from './fixtures/test-data';

/**
 * Playwright global setup: runs once before all tests.
 * Bootstraps the fixed test users (and Alex+Sam's shared household) on a
 * fresh database, then clears stale Redis throttle/block keys and removes
 * leftover E2E test data (personal/shared expenses, approvals, savings)
 * from previous runs so the test suite starts with a clean state.
 */
export default async function globalSetup() {
  await ensureTestFixturesExist();
  await cleanupAllTestData();
}
