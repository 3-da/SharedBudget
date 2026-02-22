# SharedBudget -- Testing

---

## Testing Pyramid

| Category | Spec Files | Tests | Tool |
|----------|-----------|-------|------|
| Backend unit | 55 | 723 | Vitest 4.x |
| Frontend unit | 33 | -- | Vitest 4.x |
| E2E | 8 | ~40 | Playwright |
| **Total** | **96** | | |

**Vitest over Jest**: Native ESM support (Prisma generates ESM-only code), ~2x faster cold start via esbuild transformation, near-identical API (`vi.fn()` instead of `jest.fn()`).

---

## Unit Testing

### Mandatory Rule

From `CLAUDE.md`: "Every piece of new code that contains logic MUST have unit tests written immediately -- not later, not in a follow-up PR." Tests are written after the service method and before moving to the controller.

### AAA Pattern

Every test follows Arrange-Act-Assert:

```typescript
it('should return all pending approvals for the household', async () => {
    // Arrange
    mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
    mockPrismaService.expenseApproval.findMany.mockResolvedValue([mockPendingApproval]);

    // Act
    const result = await service.listPendingApprovals(mockUserId);

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe(ApprovalStatus.PENDING);
});
```

### Test Infrastructure

NestJS `TestingModule` creates a real DI container with mocked providers:

```typescript
beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
        providers: [
            ApprovalService,
            { provide: PrismaService, useValue: mockPrismaService },
            { provide: CacheService, useValue: mockCacheService },
            { provide: ExpenseHelperService, useValue: mockExpenseHelper },
        ],
    }).compile();
    service = module.get<ApprovalService>(ApprovalService);
    vi.clearAllMocks();
});
```

The `CacheService` mock bypasses caching by calling the fetch function directly:

```typescript
getOrSet: vi.fn((key, ttl, fetchFn) => fetchFn()),
```

### Eight Mandatory Test Categories

Every service spec file covers these categories:

**1. Happy path** -- Successful operation with valid input.

**2. Validation failures** -- Invalid input caught at the DTO level.

**3. Not found** -- Resource does not exist. Asserts short-circuit behavior (DB not called after membership check fails).

**4. Unauthorized / Forbidden** -- Access control violations. Wrong role, wrong household.

**5. Security / Enumeration prevention** -- Identical error messages for different failure paths:

```typescript
// Both must return the same message
it('should throw for non-existent email', async () => {
    await expect(service.login('noexist@example.com', 'any'))
        .rejects.toThrow('Incorrect email or password');
});
it('should throw for wrong password', async () => {
    await expect(service.login('exists@example.com', 'wrong'))
        .rejects.toThrow('Incorrect email or password');
});
```

**6. Boundary values (Grenzwert)** -- Test at exact edges of valid ranges:

```typescript
it('should accept name at minimum length (1 char)', async () => {
    const dto = plainToInstance(CreateSharedExpenseDto, { ...validDto, name: 'A' });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
});
it('should reject name exceeding maximum (101 chars)', async () => {
    const dto = plainToInstance(CreateSharedExpenseDto, { ...validDto, name: 'A'.repeat(101) });
    const errors = await validate(dto);
    expect(errors[0].constraints).toHaveProperty('maxLength');
});
```

**7. Error message assertions** -- Every `rejects.toThrow` checks both exception type AND exact message string:

```typescript
await expect(service.listPendingApprovals(mockUserId)).rejects.toThrow(NotFoundException);
await expect(service.listPendingApprovals(mockUserId)).rejects.toThrow(
    'You must be in a household to manage expenses'
);
```

**8. Edge cases** -- Self-referential actions, empty collections, race condition guards.

### File Organization

One spec file per source file, co-located:

```
src/approval/
    approval.service.ts
    approval.service.spec.ts
    approval.controller.ts
    approval.controller.spec.ts
    dto/
        accept-approval.dto.ts
        accept-approval.dto.spec.ts
```

### Service Coverage

| Service | Spec File |
|---------|-----------|
| AuthService | auth.service.spec.ts |
| UserService | user.service.spec.ts |
| HouseholdService | household.service.spec.ts |
| HouseholdInvitationService | household-invitation.service.spec.ts |
| SalaryService | salary.service.spec.ts |
| PersonalExpenseService | personal-expense.service.spec.ts |
| SharedExpenseService | shared-expense.service.spec.ts |
| ApprovalService | approval.service.spec.ts |
| DashboardService | dashboard.service.spec.ts |
| ExpensePaymentService | expense-payment.service.spec.ts |
| RecurringOverrideService | recurring-override.service.spec.ts |
| SavingService | saving.service.spec.ts |
| SessionService | session.service.spec.ts |
| CacheService | cache.service.spec.ts |
| ExpenseHelperService | expense-helper.service.spec.ts |

All 11 controllers also have dedicated spec files.

---

## DTO Validation Testing

**Test**: DTOs that import from `class-validator` or `class-transformer` (contain validation logic).
**Skip**: Response DTOs that only import from `@nestjs/swagger` (pure data shapes).

Pattern: `plainToInstance` + `validate` -- simulates the exact pipeline that runs in production:

```typescript
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

it('should reject invalid category', async () => {
    const dto = plainToInstance(CreateSharedExpenseDto, { ...validDto, category: 'INVALID' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('isEnum');
});
```

15 DTO spec files across auth, user, household, expense, approval, salary, override, and dashboard modules.

---

## Infrastructure Tests

**HttpExceptionFilter** (`http-exception.filter.spec.ts`):
- HttpExceptions pass through with correct status and message
- Prisma P2002 maps to 409, P2025 maps to 404
- Unknown errors return 500 with no internal details
- Response metadata (requestId, timestamp) always present
- Validation arrays preserved (not flattened)

**CacheService** (`cache.service.spec.ts`):
- `getOrSet` returns cached value on hit
- `getOrSet` calls fetch function on miss and stores result
- `invalidateHousehold` deletes all matching keys
- Key generation produces correct patterns

---

## E2E Testing with Playwright

### What E2E Catches That Unit Tests Cannot

| Failure | Why Unit Tests Miss It |
|---------|----------------------|
| Module wiring | Unit tests create their own TestingModule |
| HTTP contract (status codes, content types) | Unit tests call services directly |
| Guard pipeline | Unit tests mock guards |
| Auth interceptor token refresh | Unit tests do not involve the frontend |
| Database constraint violations | Unit tests mock the database |
| CORS | Unit tests do not involve a browser |

### Test Suites

| Suite | File | Coverage |
|-------|------|----------|
| Authentication | `auth.spec.ts` | Login, logout, route protection, navigation |
| Personal Expenses | `personal-expenses.spec.ts` | CRUD, recurring, one-time, payment tracking |
| Shared Expenses | `shared-expenses.spec.ts` | Propose create/update/delete, approval flow |
| Approvals | `approvals.spec.ts` | Accept, reject, cancel, history |
| Dashboard | `dashboard.spec.ts` | Financial overview, expense/income summaries |
| Savings | `savings.spec.ts` | Personal and shared savings upsert |
| Salary | `salary.spec.ts` | Salary upsert, household salaries |
| Timeline | `timeline-navigation.spec.ts` | Month navigation, recurring overrides |

### Test Data

Global setup seeds the database with recurring cast users:

| Test User | Role | Purpose |
|-----------|------|---------|
| Alex | OWNER | Household creator, primary test user |
| Sam | MEMBER | Second household member |
| Jordan | OUTSIDER | User not in any household |

`apiLogin()` helper makes direct HTTP requests for programmatic auth setup.

### Running E2E Tests

```bash
cd e2e
npm test                  # Headless (all suites)
npm run test:headed       # With browser visible
npm run test:ui           # Interactive Playwright UI
npm run test:debug        # Debug mode with inspector
```

Requires a running backend with a seeded database.

---

## What Is Not Tested

- **Module files** (`*.module.ts`): Pure configuration. Verified by E2E.
- **main.ts**: Application bootstrap. Verified by E2E.
- **Generated code** (`generated/`): Auto-generated by Prisma.
- **Response DTOs**: Pure data shapes with only `@ApiProperty()` decorators.

---

## Commands

```bash
# Backend unit tests
cd backend && npm run test          # vitest run (55 spec files)
cd backend && npm run test:cov      # Coverage report

# Frontend unit tests
cd frontend && npm run test         # vitest run (33 spec files)
cd frontend && npm run test:cov     # Coverage report

# E2E tests (requires running backend + seeded DB)
cd e2e && npm test                  # Playwright (8 suites)
```
