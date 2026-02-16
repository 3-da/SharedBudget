# Testing Strategy

This document explains every testing decision in SharedBudget: why Vitest over Jest, how the mock architecture works, the eight mandatory test case categories, how DTO validation tests work, and how Playwright E2E tests complement unit tests. The testing strategy is codified as a mandatory rule — every piece of logic must have tests written immediately, not in a follow-up.

---

## 1. Testing Philosophy

### 1.1 Tests Are Not Optional

The project's development guidelines (`CLAUDE.md`) codify a hard rule:

> "Every piece of new code that contains logic MUST have unit tests written immediately — not later, not in a follow-up PR."

In practice, this means:

1. Write the service method
2. Write its `.spec.ts` tests **before moving to the controller**
3. If you modify an existing method, update or add tests covering the change
4. Only skip tests for pure boilerplate with zero logic (module imports, re-exports)

This rule exists because deferred tests never get written. "I'll add tests later" becomes technical debt that grows with every commit. By enforcing test-writing as part of the implementation step (not a separate task), the test suite stays current.

### 1.2 Why Vitest Over Jest

I chose Vitest for three reasons:

1. **Native ESM support.** Vitest runs ES modules natively without the `ts-jest` transform layer that Jest requires. The SharedBudget backend uses ESM imports (Prisma generates ESM-only code), and Jest's CommonJS-first architecture creates configuration friction with ESM.

2. **Faster execution.** Vitest uses esbuild for transformation (instead of ts-jest's TypeScript compiler). Cold start is ~2x faster. With 723 tests, this saves meaningful time during development.

3. **Compatible API.** Vitest's API is nearly identical to Jest — `describe`, `it`, `expect`, `vi.fn()` (instead of `jest.fn()`), `vi.spyOn()` (instead of `jest.spyOn()`). Migration from Jest (or a developer's Jest knowledge) is trivial.

### 1.3 The AAA Pattern

Every test follows Arrange-Act-Assert:

```typescript
it('should return all pending approvals for the household', async () => {
    // Arrange — set up mocks and input data
    mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
    mockPrismaService.expenseApproval.findMany.mockResolvedValue([mockPendingApproval]);

    // Act — call the method under test
    const result = await service.listPendingApprovals(mockUserId);

    // Assert — verify the outcome
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe(ApprovalStatus.PENDING);
});
```

The three phases are visually separated (even without comments in shorter tests) and each has exactly one responsibility. Arrange sets up the world. Act performs a single action. Assert checks the result.

### 1.4 Tests as Living Specification

The 723 unit tests across 42 spec files serve as executable documentation. When a developer asks "what happens when a non-owner tries to remove a member?", the answer is in the test file:

```typescript
it('should throw ForbiddenException when non-owner tries to remove member', async () => {
    // The test describes the behavior precisely
});
```

If the behavior changes, the test breaks. This is intentional — tests prevent undocumented behavior changes.

### Interview Questions This Section Answers
- "Why did you choose Vitest over Jest?"
- "What's your testing philosophy?"
- "How do you ensure tests stay current with the code?"
- "What is the AAA pattern and why do you use it?"

---

## 2. Unit Test Infrastructure

### 2.1 TestingModule and Mock Injection

NestJS's `@nestjs/testing` package provides a `TestingModule` that creates a real dependency injection container with mocked providers:

```typescript
// backend/src/approval/approval.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';

const mockPrismaService = {
    expenseApproval: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
    },
    $transaction: vi.fn(),
};

const mockCacheService = {
    getOrSet: vi.fn((key, ttl, fetchFn) => fetchFn()),
    invalidateHousehold: vi.fn(),
    pendingApprovalsKey: vi.fn((hid) => `cache:approvals:pending:${hid}`),
    summaryTTL: 120,
};

beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
        providers: [
            ApprovalService,                                        // Real service
            { provide: PrismaService, useValue: mockPrismaService },  // Mocked DB
            { provide: ExpenseHelperService, useValue: mockExpenseHelper }, // Mocked helper
            { provide: CacheService, useValue: mockCacheService },    // Mocked cache
        ],
    }).compile();

    service = module.get<ApprovalService>(ApprovalService);
    vi.clearAllMocks();
});
```

This pattern gives us:
- **Real service logic** with all its constructor injection resolved
- **Mocked dependencies** that we control per test
- **Isolation** — `vi.clearAllMocks()` ensures no state leaks between tests
- **Type safety** — the mock's shape must match the interface the service expects

### 2.2 Mock Factory Pattern

Each test file creates mock objects following a consistent pattern:

**PrismaService mocks:** Modeled at the Prisma model level. Each model gets an object with its query methods:

```typescript
const mockPrismaService = {
    expense: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
    },
    $transaction: vi.fn(),
};
```

**CacheService mock:** The `getOrSet` mock is configured to call the fetch function directly, effectively bypassing caching during tests:

```typescript
getOrSet: vi.fn((key, ttl, fetchFn) => fetchFn()),
```

This means tests exercise the real data-fetching logic without Redis. Cache behavior is tested separately in `cache.service.spec.ts`.

**ExpenseHelperService mock:** Provides a `requireMembership` mock that returns membership data or throws exceptions:

```typescript
const mockExpenseHelper = {
    requireMembership: vi.fn(),
};

// In a test:
mockExpenseHelper.requireMembership.mockResolvedValue({
    userId: 'user-123',
    householdId: 'household-456',
    role: 'OWNER',
});
```

### 2.3 File Organization

One spec file per source file, co-located in the same directory:

```
src/approval/
    approval.service.ts           → business logic
    approval.service.spec.ts      → unit tests for the service
    approval.controller.ts        → HTTP layer
    approval.controller.spec.ts   → unit tests for the controller
    dto/
        accept-approval.dto.ts         → input DTO
        accept-approval.dto.spec.ts    → validation tests
```

Co-location ensures tests are updated when code changes — they're in the same directory, visible in the same file listing.

### Interview Questions This Section Answers
- "How do you set up unit tests in NestJS?"
- "How do you mock database calls in tests?"
- "Why do you use TestingModule instead of creating services manually?"
- "How do you prevent test pollution between test cases?"

---

## 3. The Eight Test Case Categories

Every service spec file aims to cover these eight categories. They are documented in `CLAUDE.md` as a checklist for test authors.

### 3.1 Happy Path

The successful operation with valid input and expected state:

```typescript
// backend/src/approval/approval.service.spec.ts
it('should return all pending approvals for the household', async () => {
    mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
    mockPrismaService.expenseApproval.findMany.mockResolvedValue([mockPendingCreateApproval]);

    const result = await service.listPendingApprovals(mockUserId);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(mockApprovalId);
    expect(result[0].status).toBe(ApprovalStatus.PENDING);
});
```

Happy path tests verify the **normal flow** works. They assert on the return value, the calls made to dependencies, and the shape of the output.

### 3.2 Validation Failures

Invalid input caught at the DTO level before reaching service logic:

```typescript
// backend/src/shared-expense/dto/create-shared-expense.dto.spec.ts
it('should reject when name is empty', async () => {
    const dto = plainToInstance(CreateSharedExpenseDto, { ...validDto, name: '' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('minLength');
});
```

These tests verify that class-validator decorators are correctly configured. The assertion checks the specific constraint (`minLength`, `isEnum`, `min`) to ensure the right rule triggered.

### 3.3 Not Found

Resource doesn't exist in the expected state:

```typescript
// backend/src/approval/approval.service.spec.ts
it('should throw NotFoundException if user has no household', async () => {
    mockExpenseHelper.requireMembership.mockRejectedValue(
        new NotFoundException('You must be in a household to manage expenses')
    );

    await expect(service.listPendingApprovals(mockUserId)).rejects.toThrow(NotFoundException);
    await expect(service.listPendingApprovals(mockUserId)).rejects.toThrow(
        'You must be in a household to manage expenses'
    );
    expect(mockPrismaService.expenseApproval.findMany).not.toHaveBeenCalled();
});
```

Note the dual assertion: both the **exception type** and the **message string** are verified. The third assertion (`not.toHaveBeenCalled`) verifies that the method short-circuited before reaching the database — a failed membership check should prevent any further work.

### 3.4 Unauthorized / Forbidden

Access control violations:

```typescript
it('should throw ForbiddenException when non-owner tries to remove member', async () => {
    mockPrismaService.householdMember.findUnique.mockResolvedValue({
        ...mockMembership,
        role: 'MEMBER',  // Not OWNER
    });

    await expect(service.removeMember(userId, targetId)).rejects.toThrow(ForbiddenException);
    await expect(service.removeMember(userId, targetId)).rejects.toThrow(
        'Only the household owner can remove members'
    );
});
```

These tests verify that role checks are enforced correctly and that the exact error message matches what the user will see.

### 3.5 Security / Enumeration Prevention

Identical errors for different failure reasons:

```typescript
// Tests that verify login returns the same error for "wrong email" and "wrong password":
it('should throw UnauthorizedException for non-existent email', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    await expect(service.login('noexist@example.com', 'any'))
        .rejects.toThrow('Invalid email or password');
});

it('should throw UnauthorizedException for wrong password', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    vi.mocked(argon2.verify).mockResolvedValue(false);
    await expect(service.login('exists@example.com', 'wrong'))
        .rejects.toThrow('Invalid email or password');
});
```

Both tests assert the **identical message string**. If a developer accidentally changes one error path to return a different message, the test catches the enumeration vulnerability.

### 3.6 Boundary Values (Grenzwert)

Testing at the exact edges of valid ranges:

```typescript
// backend/src/shared-expense/dto/create-shared-expense.dto.spec.ts
it('should accept name at minimum length (1 char)', async () => {
    const dto = plainToInstance(CreateSharedExpenseDto, { ...validDto, name: 'A' });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
});

it('should accept name at maximum length (100 chars)', async () => {
    const dto = plainToInstance(CreateSharedExpenseDto, { ...validDto, name: 'A'.repeat(100) });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
});

it('should reject name exceeding maximum length (101 chars)', async () => {
    const dto = plainToInstance(CreateSharedExpenseDto, { ...validDto, name: 'A'.repeat(101) });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('maxLength');
});
```

Boundary value testing follows the classic pattern: test **at the boundary** (valid), and **one step beyond** (invalid). For `@MinLength(1)`, test with 1 character (pass) and 0 characters (fail). For `@MaxLength(100)`, test with 100 characters (pass) and 101 characters (fail).

### 3.7 Error Message Assertions

Every `rejects.toThrow` assertion checks both the exception type and the exact message:

```typescript
await expect(service.listPendingApprovals(mockUserId)).rejects.toThrow(NotFoundException);
await expect(service.listPendingApprovals(mockUserId)).rejects.toThrow(
    'You must be in a household to manage expenses'
);
```

This is a project rule. Exception type alone isn't enough — a refactoring could change the message to something incorrect or misleading, and the type-only test would still pass. Message assertions catch regressions in user-facing error text.

### 3.8 Edge Cases

Unusual but valid states that could trigger bugs:

```typescript
// Empty collection
it('should return empty array when no pending approvals exist', async () => {
    mockPrismaService.expenseApproval.findMany.mockResolvedValue([]);
    const result = await service.listPendingApprovals(mockUserId);
    expect(result).toEqual([]);
});

// Self-referential action
it('should throw ForbiddenException when owner tries to transfer to themselves', async () => {
    await expect(service.transferOwnership(ownerId, ownerId))
        .rejects.toThrow('Cannot transfer ownership to yourself');
});

// Bug-fix regression test
it('should not require paymentMonth when category is ONE_TIME even with FULL strategy', async () => {
    const dto = plainToInstance(CreateSharedExpenseDto, {
        ...validDto,
        category: ExpenseCategory.ONE_TIME,
        frequency: ExpenseFrequency.YEARLY,
        yearlyPaymentStrategy: YearlyPaymentStrategy.FULL,
        month: 3,
        year: 2026,
        // paymentMonth intentionally omitted — ONE_TIME uses month/year, not paymentMonth
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
});
```

The last example is a regression test for a specific bug: `@ValidateIf` for `paymentMonth` was triggering when category was `ONE_TIME` + `FULL`, even though one-time expenses use `month`/`year` instead of `paymentMonth`. The test documents the fix and prevents the bug from recurring.

### Interview Questions This Section Answers
- "What categories of test cases do you write?"
- "Why do you assert on error message strings, not just exception types?"
- "What are boundary value tests and why do you write them?"
- "How do you test for enumeration prevention?"

---

## 4. DTO Validation Testing

### 4.1 When to Test vs. When to Skip

**Test:** DTOs that import from `class-validator` or `class-transformer`. These contain logic (validation rules, transformations).

**Skip:** DTOs that only import from `@nestjs/swagger` (response DTOs with only `@ApiProperty()`). These are pure data shapes with no logic to test.

```
create-shared-expense.dto.ts   → imports class-validator → HAS tests
auth-response.dto.ts           → imports only @nestjs/swagger → NO tests needed
error-response.dto.ts          → imports only @nestjs/swagger → NO tests needed
```

### 4.2 The Testing Pattern

DTO tests use `plainToInstance` + `validate` from class-transformer and class-validator:

```typescript
// backend/src/shared-expense/dto/create-shared-expense.dto.spec.ts
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

const validDto = {
    name: 'Monthly Rent',
    amount: 800,
    category: ExpenseCategory.RECURRING,
    frequency: ExpenseFrequency.MONTHLY,
};

it('should accept a valid monthly recurring expense', async () => {
    const dto = plainToInstance(CreateSharedExpenseDto, validDto);
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
});

it('should reject invalid category', async () => {
    const dto = plainToInstance(CreateSharedExpenseDto, { ...validDto, category: 'INVALID' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('isEnum');
});
```

The `plainToInstance` call simulates what NestJS's `ValidationPipe` does internally — converting raw JSON into a typed class instance. Then `validate()` runs all class-validator decorators. This tests the exact same validation pipeline that runs in production.

### 4.3 DTO Spec Files in the Codebase

There are 15 DTO spec files covering every input DTO with validation logic:

| Module | Spec File |
|--------|-----------|
| Auth | `auth-dto.spec.ts` |
| User | `user-dto.spec.ts` |
| Household | `household-dto.spec.ts` |
| Personal Expense | `create-personal-expense.dto.spec.ts`, `update-personal-expense.dto.spec.ts`, `list-personal-expenses-query.dto.spec.ts` |
| Shared Expense | `create-shared-expense.dto.spec.ts`, `update-shared-expense.dto.spec.ts`, `list-shared-expenses-query.dto.spec.ts` |
| Approval | `accept-approval.dto.spec.ts`, `reject-approval.dto.spec.ts`, `list-approvals-query.dto.spec.ts` |
| Salary | `upsert-salary.dto.spec.ts` |
| Recurring Override | `batch-upsert-override.dto.spec.ts` |
| Dashboard | `dashboard-query.dto.spec.ts` |

### Interview Questions This Section Answers
- "How do you test DTO validation rules?"
- "Why don't you test response DTOs?"
- "How do you test conditional validation (@ValidateIf)?"

---

## 5. Infrastructure Tests

### 5.1 HttpExceptionFilter Tests

The global exception filter has its own spec file that tests all three error categories:

```typescript
// backend/src/common/filters/http-exception.filter.spec.ts
describe('Prisma error handling', () => {
    it('should map P2002 (unique constraint) to 409 Conflict', () => {
        const exception = new PrismaClientKnownRequestError('Unique constraint failed', {
            code: 'P2002',
            clientVersion: '7.3.0',
        });

        filter.catch(exception, mockHost);

        expect(mockReply).toHaveBeenCalledWith(
            {},
            expect.objectContaining({
                statusCode: HttpStatus.CONFLICT,
                message: 'A record with this value already exists',
                error: 'Conflict',
            }),
            HttpStatus.CONFLICT,
        );
    });
});

describe('response metadata', () => {
    it('should include requestId from the request', () => {
        filter.catch(new NotFoundException('Not found'), mockHost);
        expect(mockReply).toHaveBeenCalledWith(
            {},
            expect.objectContaining({ requestId: 'req-123-abc' }),
            expect.any(Number),
        );
    });

    it('should include a valid ISO 8601 timestamp', () => {
        filter.catch(new NotFoundException('Not found'), mockHost);
        const responseBody = mockReply.mock.calls[0][1];
        expect(new Date(responseBody.timestamp).toISOString()).toBe(responseBody.timestamp);
    });
});
```

The filter tests verify:
- HttpExceptions pass through with correct status and message
- ValidationPipe's `string[]` messages are preserved (not flattened to a single string)
- Prisma error codes map to correct HTTP status codes with generic messages
- Unknown errors return 500 with no internal details
- Response metadata (`requestId`, `timestamp`) is always present
- Non-Error thrown values (e.g., thrown strings) are handled gracefully

### 5.2 CacheService Tests

`cache.service.spec.ts` tests the caching layer:
- `getOrSet` returns cached value on hit
- `getOrSet` calls fetch function on miss and stores the result
- `invalidateHousehold` deletes all keys matching the household's pattern
- Key generation functions produce correct Redis key patterns

### Interview Questions This Section Answers
- "How do you test error handling?"
- "How do you test that Prisma errors don't leak database details?"

---

## 6. E2E Testing with Playwright

### 6.1 What E2E Tests Catch That Unit Tests Cannot

Unit tests mock dependencies. E2E tests run the full stack — Angular frontend, NestJS backend, PostgreSQL database, Redis cache. They catch integration failures that unit tests structurally miss:

| Failure Category | Example | Why Unit Tests Miss It |
|-----------------|---------|----------------------|
| Module wiring | A service isn't properly exported from its module | Unit tests create their own TestingModule with explicit providers |
| HTTP contract | Controller returns wrong status code or content type | Unit tests call service methods directly, not HTTP endpoints |
| Guard pipeline | JwtAuthGuard doesn't trigger on a new endpoint | Unit tests mock or skip guards |
| Client-server integration | Angular interceptor doesn't refresh token on 401 | Unit tests don't involve the frontend |
| Database constraints | Unique constraint violation on concurrent inserts | Unit tests mock the database |
| CORS | Browser blocks cross-origin request | Unit tests don't involve a browser |

### 6.2 Test Suite Inventory

8 test suites covering all major user workflows:

| Suite | File | Coverage |
|-------|------|----------|
| Authentication | `auth.spec.ts` | Login, logout, route protection, navigation, register page |
| Personal Expenses | `personal-expenses.spec.ts` | CRUD, recurring expenses, one-time expenses, payment tracking |
| Shared Expenses | `shared-expenses.spec.ts` | Propose create/update/delete, approval flow |
| Approvals | `approvals.spec.ts` | Accept, reject, cancel, history |
| Dashboard | `dashboard.spec.ts` | Financial overview, expense/income summaries |
| Savings | `savings.spec.ts` | Personal and shared savings upsert |
| Salary | `salary.spec.ts` | Salary upsert, household salaries |
| Timeline | `timeline-navigation.spec.ts` | Month navigation, recurring overrides |

### 6.3 E2E Test Examples

**Login flow — happy path:**

```typescript
// e2e/tests/auth.spec.ts
test('should redirect to main app after login with valid credentials', async ({ page }) => {
    await page.goto('/auth/login');
    await expect(page.getByText('Welcome Back')).toBeVisible();

    await page.getByLabel('Email').fill(TEST_USERS.alex.email);
    await page.getByLabel('Password').fill(TEST_USERS.alex.password);
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(page).not.toHaveURL(/\/auth\/login/);
    await expect(page).toHaveURL(/\/household/);
});
```

**Login flow — error handling:**

```typescript
test('should show error message when login with invalid credentials', async ({ page }) => {
    await page.goto('/auth/login');

    await page.getByLabel('Email').fill(TEST_USERS.alex.email);
    await page.getByLabel('Password').fill('WrongPassword999!');
    await page.getByRole('button', { name: 'Sign In' }).click();

    const snackbar = page.locator('mat-snack-bar-container');
    await expect(snackbar).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/auth\/login/);
});
```

**Route protection — auth guard:**

```typescript
test('should redirect unauthenticated user to login when accessing protected route', async ({
    page,
}) => {
    await page.goto('/auth/login');
    await page.evaluate(() => localStorage.removeItem('sb_refresh_token'));

    await page.goto('/dashboard');

    await expect(page).toHaveURL(/\/auth\/login/);
    await expect(page).toHaveURL(/returnUrl/);
});
```

This test verifies the full auth guard chain: no refresh token → auth guard blocks access → redirect to `/auth/login` with `returnUrl` query parameter → user can log in and return to the originally requested page.

### 6.4 Test Data and Isolation

**Global setup:** A global setup script seeds the test database with known test users matching the JSDoc recurring cast:

| Test User | Role | Purpose |
|-----------|------|---------|
| Alex | OWNER | Household creator, primary test user |
| Sam | MEMBER | Second household member |
| Jordan | OUTSIDER | User not in any household |

**API helper for programmatic auth:**

```typescript
// e2e/fixtures/test-data.ts
const tokens = await apiLogin(TEST_USERS.alex.email, TEST_USERS.alex.password);
```

Some tests need to set up auth state without going through the login UI (e.g., to test logout). The `apiLogin` helper makes a direct HTTP request to `POST /auth/login` and returns tokens.

**Suite isolation:** Each test suite operates on its own data subset. Auth tests work with login/register flows. Expense tests create and manipulate expenses. No suite depends on state created by another suite.

### 6.5 Running E2E Tests

```bash
cd e2e
npm test                  # Run all Playwright tests (headless)
npm run test:headed       # Run with browser visible
npm run test:ui           # Interactive Playwright UI
npm run test:debug        # Debug mode with inspector
```

E2E tests require a running backend with a seeded database. They execute against the full application stack.

### Interview Questions This Section Answers
- "What do your E2E tests cover that unit tests don't?"
- "How do you set up test data for E2E tests?"
- "How do you test authentication flows end-to-end?"
- "How do you ensure test isolation between test suites?"

---

## 7. Coverage Summary

### 7.1 Numbers

| Category | Files | Tests |
|----------|-------|-------|
| Backend unit tests | 42 spec files | 723 tests |
| DTO validation tests | 15 spec files | (included in 723) |
| Infrastructure tests | 2 spec files | (included in 723) |
| E2E test suites | 8 spec files | ~40 tests |
| **Total** | **50 spec files** | **~763 tests** |

### 7.2 Service Coverage

Every service has a dedicated spec file:

| Service | Spec File | Coverage |
|---------|-----------|----------|
| AuthService | `auth.service.spec.ts` | Login, register, verify, refresh, forgot/reset password |
| UserService | `user.service.spec.ts` | Profile CRUD, change password |
| HouseholdService | `household.service.spec.ts` | Create, join, leave, transfer, remove |
| HouseholdInvitationService | `household-invitation.service.spec.ts` | Invite, accept, decline, cancel |
| SalaryService | `salary.service.spec.ts` | Upsert, get own/household/monthly |
| PersonalExpenseService | `personal-expense.service.spec.ts` | CRUD for personal expenses |
| SharedExpenseService | `shared-expense.service.spec.ts` | Propose create/update/delete |
| ApprovalService | `approval.service.spec.ts` | List, accept, reject, cancel |
| DashboardService | `dashboard.service.spec.ts` | Overview, savings, settlement, mark-paid |
| ExpensePaymentService | `expense-payment.service.spec.ts` | Payment status CRUD |
| RecurringOverrideService | `recurring-override.service.spec.ts` | Override CRUD, batch, delete upcoming |
| SavingService | `saving.service.spec.ts` | Personal/shared savings CRUD |
| SessionService | `session.service.spec.ts` | Redis session management |
| CacheService | `cache.service.spec.ts` | Cache-aside pattern, invalidation |
| ExpenseHelperService | `expense-helper.service.spec.ts` | Membership check, expense mapping |

### 7.3 Controller Coverage

Every controller has a spec file verifying that endpoints delegate correctly to services:

Auth, User, Household, Personal Expense, Shared Expense, Approval, Salary, Expense Payment, Recurring Override, Saving, Dashboard — 11 controller spec files.

### 7.4 What's Not Tested

- **Module wiring** (`*.module.ts` files) — These are pure configuration (imports, providers, exports). No logic to test. Module wiring is verified by E2E tests.
- **main.ts** — Application bootstrap. Tested implicitly by E2E tests.
- **Prisma-generated code** (`generated/`) — Auto-generated, not our code.
- **Response DTOs** — Pure data shapes with no logic (only `@ApiProperty()` decorators).

### Interview Questions This Section Answers
- "What is your test coverage?"
- "How many tests does your application have?"
- "What do you NOT test, and why?"
- "How do your unit tests and E2E tests complement each other?"

---

## Cross-References

- **Database models (what the tests mock):** [01-DATABASE.md](./01-DATABASE.md)
- **Module system (what TestingModule replaces):** [03-BACKEND.md](./03-BACKEND.md)
- **DTO validation rules (what DTO tests verify):** [06-API.md](./06-API.md)
- **Security test cases (enumeration, boundary values):** [07-SECURITY.md](./07-SECURITY.md)
