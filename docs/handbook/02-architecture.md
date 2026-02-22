# SharedBudget -- Architecture

---

## System Diagram

```
+-------------------+         HTTPS / JSON          +-------------------+
|                   |  -----------------------------> |                   |
|   Angular 21 SPA  |  <----------------------------- |   NestJS 11 API   |
|   (Browser)       |   Authorization: Bearer {jwt}  |   Port 3000       |
|                   |                                |                   |
|   Zoneless CD     |                                |   19 Modules      |
|   Signal stores   |                                |   63 Endpoints    |
|   Material M3     |                                |   Global guards   |
+-------------------+                                +--------+----------+
                                                              |
                                              +---------------+---------------+
                                              |                               |
                                    +---------v---------+         +-----------v-----------+
                                    |   PostgreSQL 18   |         |      Redis 7.2        |
                                    |                   |         |                       |
                                    |   11 models       |         |   Sessions (7d TTL)   |
                                    |   10 enums        |         |   Cache (60-300s TTL) |
                                    |   Prisma 7.3.0    |         |   Rate limit counters |
                                    |   @prisma/        |         |   Verification codes  |
                                    |    adapter-pg     |         |   Deletion requests   |
                                    +-------------------+         +-----------------------+
```

---

## Three-Tier Architecture

**Presentation tier** -- Angular 21 SPA running in the browser. Standalone components with zoneless change detection driven by signals. Angular Material M3 theming (cyan primary, orange tertiary). Feature-Sliced Design: `core/` (singletons), `shared/` (reusable UI), `features/` (9 lazy-loaded business domains).

**Application tier** -- NestJS 11 REST API. 19 modules (11 feature + 8 infrastructure). Global JWT authentication guard (opt-out via `@Public()`), global rate limiting via `@nestjs/throttler` with Redis storage, global `HttpExceptionFilter` for consistent error formatting. Structured logging via nestjs-pino with request ID correlation.

**Data tier** -- PostgreSQL 18 as primary database via Prisma ORM. Redis 7.2 serves three roles: session storage, application cache, and rate limit counters. Key prefixes prevent cross-concern interference (`refresh:*`, `cache:*`, `verify:*`, `reset:*`, `delete_request:*`).

---

## NestJS Module Breakdown

### Feature Modules (11)

| Module | Controller | Endpoints | Responsibility |
|--------|-----------|-----------|----------------|
| auth | AuthController | 8 | Register, verify email, login, refresh, logout, password reset |
| household | HouseholdController | 11 | CRUD, join/leave, invite, transfer ownership |
| user | UserController | 8 | Profile, change password, account deletion |
| salary | SalaryController | 4 | Upsert salary, get own/household/monthly |
| personal-expense | PersonalExpenseController | 5 | CRUD for personal expenses |
| shared-expense | SharedExpenseController | 5 | Propose create/update/delete (approval-gated) |
| approval | ApprovalController | 5 | List pending/history, accept, reject, cancel |
| dashboard | DashboardController | 4 | Financial overview, savings, settlement, mark-paid |
| expense-payment | ExpensePaymentController | 3 | Mark expense months as paid/pending |
| recurring-override | RecurringOverrideController | 4 | Override amounts per month, batch upsert |
| saving | SavingController | 6 | Personal/shared savings add/withdraw |

### Infrastructure Modules (8)

| Module | Provides | Consumers |
|--------|---------|-----------|
| prisma | PrismaService (DB client) | All feature services |
| redis | Redis connection + REDIS_CLIENT token | Cache, session, throttler |
| session | SessionService (Redis sessions) | Auth |
| cache | CacheService (cache-aside pattern) | Dashboard, expenses, salary, savings, approvals |
| mail | MailService (logs in dev) | Auth |
| expense-helper | ExpenseHelperService | Personal/shared expenses, approval |
| logger | Pino logger with request ID and redaction | All modules |
| throttler | ThrottlerModule (forRootAsync, Redis storage) | All controllers (global) |

---

## Request Lifecycle

Every HTTP request passes through a fixed pipeline:

```
Client Request
    |
    v
Middleware          Pino logger assigns requestId, logs HTTP method + URL
    |
    v
Guard               ThrottlerGuard -- checks Redis counter (100 req/60s default)
    |                JwtAuthGuard  -- verifies Bearer token, sets req.user
    v                              (skipped for @Public() endpoints)
Pipe                ValidationPipe -- whitelist strips unknown fields,
    |                                transform converts to DTO instances,
    |                                class-validator rejects invalid input (400)
    v
Controller          Receives validated DTO + userId from @CurrentUser()
    |
    v
Service             Business logic, Prisma DB calls, cache invalidation
    |
    v
Response            NestJS serializes return value to JSON
    |
    v
Exception Filter    If ANY stage threw: HttpExceptionFilter catches it,
                    formats { statusCode, message, error, timestamp, requestId }
```

**Guard order matters.** ThrottlerGuard runs before JwtAuthGuard. A brute-force attack is rate-limited before the server wastes time verifying credentials.

**Pipes transform and validate.** `whitelist: true` strips undeclared properties (mass assignment prevention). `transform: true` enables class-transformer decorators. By the time a DTO reaches a controller, it contains only declared fields with correct types.

**The exception filter is the safety net.** HttpExceptions pass through as-is. Prisma P2002 maps to 409 Conflict. Prisma P2025 maps to 404 Not Found. Unknown errors return generic 500 with no internal details. Every response includes `requestId` for log correlation.

---

## Frontend Architecture

### Layer Structure

```
frontend/src/app/
  core/             Singleton services (ApiService, AuthService, TokenService,
                    GlobalErrorHandler, ThemeService, ShellComponent)
  shared/           Reusable components (7), pipes (3), directives (2),
                    validators (1), models (TypeScript interfaces)
  features/         9 lazy-loaded feature modules
    auth/           Login, register, verify-code, forgot/reset password
    household/      Household detail, members, invitations, charts
    salary/         Salary overview, form, chart
    personal-expenses/  List, form, recurring timeline
    shared-expenses/    List, form, recurring timeline
    approvals/      Pending and history lists
    dashboard/      Income, expenses, savings, settlement cards
    savings/        Personal and shared savings management
    settings/       Profile and password change forms
```

### Key Patterns

- **Container/Presentational split.** Pages (containers) inject stores, read signals, orchestrate dialogs. Components (presentational) receive data via `input()`, emit events via `output()`, inject nothing.
- **Signal stores.** Each feature has a signal-based store managing loading/error/data state. No global state library.
- **Auth interceptor.** Functional interceptor attaches Bearer token to every request. On 401, queues concurrent requests and silently refreshes via `/auth/refresh`. On refresh failure, clears auth state and redirects to login.
- **App initializer.** `provideAppInitializer(initializeAuth)` restores the session from localStorage refresh token before the first render. Prevents login page flash on reload.
- **Theming.** Angular Material M3 with `mat.$cyan-palette` (primary) and `mat.$orange-palette` (tertiary). Light/dark/system mode toggle persisted to localStorage.

---

## Data Flow: Core Operations

### Create Shared Expense (Approval Flow)

```
Sam proposes "Internet 50 EUR/month"
    |
    v
POST /expenses/shared  -->  SharedExpenseService.proposeCreateSharedExpense()
    |                            |
    |                            v
    |                       ExpenseApproval created (PENDING, proposedData: {...})
    |                       Cache: invalidateApprovals(householdId)
    v
Alex sees pending approval in Approvals list
    |
    v
PUT /approvals/:id/accept  -->  ApprovalService.acceptApproval()
    |                                |
    |                                v
    |                           $transaction:
    |                             1. Update approval -> ACCEPTED
    |                             2. Create Expense from proposedData
    |                           Cache: invalidateHousehold(householdId)
    v
Expense now visible in shared expense list and dashboard
```

### Authentication Flow

```
POST /auth/login  -->  AuthService.login()
    |                      |
    |                      v
    |                  Verify Argon2 hash, check emailVerified
    |                  Generate: JWT access (15m) + random refresh (7d)
    |                  Redis: SET refresh:{token} userId
    |                  Redis: SADD user_sessions:{userId} token
    v
Frontend stores:
  - Access token: in-memory (TokenService)
  - Refresh token: localStorage (sb_refresh_token)
    |
    v
Subsequent requests: Authorization: Bearer {accessToken}
    |
    v
On 401: interceptor calls POST /auth/refresh
    |                            |
    |                            v
    |                        Redis: GET refresh:{oldToken}
    |                        Redis: DEL refresh:{oldToken} (rotation)
    |                        Generate new token pair
    v
On refresh failure: clearAuth() -> redirect to /auth/login
```

---

## Caching Strategy

Redis cache-aside pattern via `CacheService.getOrSet()`. Read: check Redis, return on hit, query DB on miss, store result with TTL. Write operations invalidate relevant keys.

| Domain | TTL | Key Pattern |
|--------|-----|-------------|
| Salaries | 300s | `cache:salary:household:{householdId}:*` |
| Expenses | 60s | `cache:expenses:{type}:{scope}:{filterHash}` |
| Dashboard | 120s | `cache:dashboard:{householdId}:{year}:{month}:{mode}` |
| Settlement | 120s | `cache:settlement:{householdId}:{year}:{month}` |
| Approvals | 120s | `cache:approvals:{status}:{householdId}*` |
| Savings | 120s | `cache:savings:{householdId}:{year}:{month}` |

**Invalidation strategies:**
- **Granular**: `invalidateSalaries()`, `invalidatePersonalExpenses()`, etc. -- used for isolated changes.
- **Nuclear**: `invalidateHousehold()` -- wipes all cache keys for a household. Used when accepting approvals (affects expenses, dashboard, settlement, approvals simultaneously).

Pattern-based deletion uses Redis `SCAN` (not `KEYS`) to avoid blocking the event loop.
