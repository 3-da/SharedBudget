import { cleanupAllTestData } from './fixtures/test-data';

/**
 * Playwright global setup: runs once before all tests.
 * Clears stale Redis throttle/block keys AND removes leftover E2E test data
 * (personal/shared expenses, approvals, savings) from previous runs
 * so the test suite starts with a clean state.
 */
export default async function globalSetup() {
  await cleanupAllTestData();
}
