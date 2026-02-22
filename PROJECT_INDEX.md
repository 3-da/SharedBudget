# SharedBudget — Project Index

> **Generated:** 2026-02-20 | **Backend:** Complete (54 endpoints) | **Frontend:** Complete (Angular 21, builds clean) | **E2E:** 8 Playwright test suites

A household budget management app where members track personal/shared expenses, manage salaries, savings, and settle debts.

---

## Quick Links

| Document                             | Purpose                                                     |
|--------------------------------------|-------------------------------------------------------------|
| [CLAUDE.md](./CLAUDE.md)             | Development rules for Claude Code (tests, logging, Swagger) |
| [docs/handbook/](./docs/handbook/)   | Technical reference (user stories, architecture, data model, API, security, testing, deployment) |

---

## Tech Stack

| Layer          | Technology                              | Version              |
|----------------|-----------------------------------------|----------------------|
| Frontend       | Angular + Angular Material (M3)         | 21.1.x               |
| Frontend Dates | date-fns                                | 4.x                  |
| Frontend Charts| chart.js                                | 4.5.x                |
| Backend        | NestJS                                  | 11.x                 |
| ORM            | Prisma (with @prisma/adapter-pg)        | 7.3.0                |
| Database       | PostgreSQL                              | 18 (alpine)          |
| Cache/Sessions | Redis (ioredis)                         | 7 (alpine)           |
| Auth           | JWT (passport-jwt) + Argon2             | passport-jwt 4.x     |
| Testing        | Vitest (both frontend and backend)      | 4.x                  |
| API Docs       | @nestjs/swagger                         | 11.2.5               |
| Language       | TypeScript                              | 5.7 (BE) / 5.9 (FE) |

---

## Project Structure

```
SharedBudget/
├── backend/                    # NestJS 11 REST API
│   ├── src/
│   │   ├── main.ts             # Entry point (port 3000)
│   │   ├── app.module.ts       # Root module (19 modules)
│   │   ├── auth/               # Register, login, verify, password reset, refresh
│   │   ├── user/               # Profile CRUD, change password, account deletion
│   │   ├── household/          # Household CRUD, membership, invitations
│   │   ├── salary/             # Salary upsert, monthly tracking
│   │   ├── personal-expense/   # Personal expense CRUD
│   │   ├── shared-expense/     # Shared expense proposals (approval-gated)
│   │   ├── approval/           # Accept/reject shared expense changes
│   │   ├── dashboard/          # Financial overview, settlement calc, mark-paid
│   │   ├── expense-payment/    # Mark expense months as paid/pending
│   │   ├── recurring-override/ # Override recurring expense amounts per month
│   │   ├── saving/             # Personal & shared savings add/withdraw
│   │   ├── session/            # Redis session management
│   │   ├── common/             # Filters, DTOs, helpers, logger, cache, utils
│   │   ├── prisma/             # PrismaService (PostgreSQL via @prisma/adapter-pg)
│   │   ├── redis/              # Redis module + throttler storage
│   │   ├── mail/               # Email service (placeholder, logs in dev)
│   │   └── generated/          # Auto-generated Prisma client + DTOs (DO NOT EDIT)
│   └── prisma/
│       └── schema.prisma       # 11 models, 10 enums
├── frontend/                   # Angular 21 SPA
│   └── src/app/
│       ├── main.ts             # Bootstrap (zoneless)
│       ├── app.ts              # Root component
│       ├── app.routes.ts       # Top-level routing (lazy-loaded features)
│       ├── app.config.ts       # Providers (auth init, HTTP interceptor)
│       ├── core/               # Auth, API, error handling, layout
│       │   ├── api/            # ApiService (centralized HTTP)
│       │   ├── auth/           # TokenService, AuthService, interceptor, guard
│       │   ├── error/          # Global ErrorHandlerService
│       │   └── layout/         # ShellComponent, ToolbarComponent, SidenavComponent
│       ├── shared/             # Pipes, directives, reusable components, models
│       │   ├── models/         # TypeScript interfaces (auth, user, expense, approval, household, salary, saving, dashboard, enums)
│       │   ├── pipes/          # CurrencyEurPipe, MonthlyEquivalentPipe, RelativeTimePipe
│       │   ├── directives/     # AutoFocusDirective, PositiveNumberDirective
│       │   ├── validators/     # PasswordMatchValidator
│       │   └── components/     # LoadingSpinner, EmptyState, CurrencyDisplay, ConfirmDialog, PageHeader, BaseChart, MonthPicker
│       └── features/           # Feature modules (lazy-loaded routes)
│           ├── auth/           # Login, register, verify-code, forgot/reset password
│           ├── household/      # Create, join, manage, financial dashboard, charts
│           ├── salary/         # Salary overview, form, chart
│           ├── personal-expenses/ # List, form, recurring timeline, overrides
│           ├── shared-expenses/   # List, form, recurring timeline pages
│           ├── approvals/      # Pending/history approval lists
│           ├── dashboard/      # Income, expenses, savings, settlement cards
│           ├── savings/        # Personal & shared savings management
│           └── settings/       # Profile + change password forms
├── e2e/                        # Playwright E2E tests (8 suites)
│   ├── tests/                  # Test specs (auth, expenses, approvals, dashboard, etc.)
│   └── fixtures/               # Test data helpers
├── docker-compose.yml          # PostgreSQL 18 + Redis 7
├── CLAUDE.md                   # Development guidelines
├── SPEC.md                     # Business requirements & API spec
├── ARCHITECTURE.md             # Tech stack & data model
└── PLAN.md                     # Bug fix & feature plan
```

---

## Backend Modules (11 feature + 8 infrastructure)

| Module                  | Controller | Service(s)                                    | Endpoints | Purpose                                          |
|-------------------------|-----------|-----------------------------------------------|-----------|--------------------------------------------------|
| **auth**                | Yes       | AuthService                                   | 8         | Register, verify, login, refresh, logout, pwd reset |
| **household**           | Yes       | HouseholdService, HouseholdInvitationService  | 11        | CRUD, join/leave, invite, transfer ownership     |
| **user**                | Yes       | UserService                                   | 8         | Profile get/update, change password, account deletion |
| **salary**              | Yes       | SalaryService                                 | 4         | Upsert salary, get own/household/monthly         |
| **personal-expense**    | Yes       | PersonalExpenseService                        | 5         | CRUD for personal expenses                       |
| **shared-expense**      | Yes       | SharedExpenseService                          | 5         | Propose create/update/delete (needs approval)    |
| **approval**            | Yes       | ApprovalService                               | 5         | List pending/history, accept, reject, cancel     |
| **dashboard**           | Yes       | DashboardService                              | 4         | Overview, savings, settlement, mark-paid         |
| **expense-payment**     | Yes       | ExpensePaymentService                         | 3         | Mark expense months as paid/pending              |
| **recurring-override**  | Yes       | RecurringOverrideService                      | 4         | Override amounts per month, batch upsert, delete upcoming |
| **saving**              | Yes       | SavingService                                 | 6         | Personal/shared savings add/withdraw, get own/household |
| session                 | No        | SessionService                                | -         | Redis session CRUD                               |
| cache                   | No        | CacheService                                  | -         | Redis caching layer with invalidation            |
| prisma                  | No        | PrismaService                                 | -         | Database client                                  |
| redis                   | No        | -                                             | -         | Redis connection + throttler storage             |
| mail                    | No        | MailService                                   | -         | Email placeholder (logs in dev)                  |
| expense-helper          | No        | ExpenseHelperService                          | -         | Shared expense mappers and membership check      |
| logger                  | No        | -                                             | -         | Pino logger config with redaction                |

**Total: 54 API endpoints across 11 controllers**

---

## Frontend Feature Map

| Feature              | Pages                                   | Key Components                                     | Store              | Service               |
|----------------------|-----------------------------------------|----------------------------------------------------|--------------------|------------------------|
| **auth**             | Login, Register, VerifyCode, ForgotPassword, ResetPassword | PasswordField, CodeInput | -                  | AuthService (core)     |
| **household**        | HouseholdDetail, MemberDetail, PendingInvitations | CreateHouseholdForm, JoinByCodeForm, InviteDialog, MemberList, MemberFinanceCard, FinancialSummary, SettlementSummary, IncomeExpenseChart, SavingsChart, HouseholdManagement | HouseholdStore | HouseholdService, InvitationService |
| **salary**           | SalaryOverview                          | SalaryForm, SalarySummaryCard, SalaryChart         | SalaryStore        | SalaryService          |
| **personal-expenses**| PersonalExpenseList, PersonalExpenseFormPage, RecurringTimeline | ExpenseCard, ExpenseForm, RecurringOverrideDialog | PersonalExpenseStore | PersonalExpenseService, RecurringOverrideService |
| **shared-expenses**  | SharedExpenseList, SharedExpenseFormPage, SharedRecurringTimeline | SharedExpenseCard                    | SharedExpenseStore | SharedExpenseService   |
| **approvals**        | ApprovalList                            | ApprovalCard, RejectDialog                         | ApprovalStore      | ApprovalService        |
| **dashboard**        | Dashboard                               | IncomeSummaryCard, ExpenseSummaryCard, SavingsCard, SettlementCard | DashboardStore | DashboardService |
| **savings**          | SavingsOverview                         | SavingsHistoryChart, WithdrawDialog                | SavingStore        | SavingService          |
| **settings**         | Settings                                | ProfileForm, ChangePasswordForm, DeleteAccountDialog | -                | UserService (core)     |

**9 feature areas | 19 pages | 28 feature components | 7 shared components | 7 signal stores | 10+ API services**

---

## API Endpoints (54 total, all prefixed with `/api/v1`)

### Authentication (8)
```
POST /auth/register          Register + send verification code
POST /auth/verify-code       Verify email -> auto-login
POST /auth/resend-code       Resend verification code
POST /auth/login             Login -> JWT tokens
POST /auth/refresh           Refresh access token
POST /auth/logout            Invalidate refresh token
POST /auth/forgot-password   Request password reset email
POST /auth/reset-password    Reset password with token
```

### Household (11)
```
POST   /household                          Create household
GET    /household/mine                     Get my household
POST   /household/regenerate-code          New invite code (OWNER)
POST   /household/invite                   Invite by email (OWNER)
GET    /household/invitations/pending      My pending invitations
POST   /household/invitations/:id/respond  Accept/decline
DELETE /household/invitations/:id          Cancel invitation
POST   /household/join                     Join by invite code
POST   /household/leave                    Leave household
DELETE /household/members/:userId          Remove member (OWNER)
POST   /household/transfer-ownership       Transfer OWNER role
```

### User (8)
```
GET    /users/me                                  Get profile
PUT    /users/me                                  Update profile (name)
PUT    /users/me/password                         Change password
DELETE /users/me                                  Delete account (anonymizes data)
POST   /users/me/delete-account-request           Request account deletion (owner)
GET    /users/me/pending-delete-requests           Pending deletion requests for me
POST   /users/me/delete-account-request/:id/respond  Accept/reject deletion request
DELETE /users/me/delete-account-request            Cancel deletion request
```

### Salary (4)
```
GET /salary/me                      My salary (current month, returns null if none)
PUT /salary/me                      Upsert my salary
GET /salary/household               All household salaries
GET /salary/household/:year/:month  Salaries for specific month
```

### Personal Expenses (5)
```
GET    /expenses/personal      List my personal expenses
POST   /expenses/personal      Create personal expense
GET    /expenses/personal/:id  Get expense details
PUT    /expenses/personal/:id  Update expense
DELETE /expenses/personal/:id  Soft-delete expense
```

### Shared Expenses (5)
```
GET    /expenses/shared      List shared expenses
GET    /expenses/shared/:id  Get shared expense
POST   /expenses/shared      Propose new expense -> approval
PUT    /expenses/shared/:id  Propose edit -> approval
DELETE /expenses/shared/:id  Propose delete -> approval
```

### Approvals (5)
```
GET    /approvals              List pending approvals (includes requestedBy/reviewedBy user objects)
GET    /approvals/history      Past approvals (with status filter)
PUT    /approvals/:id/accept   Accept approval (includes user objects in response)
PUT    /approvals/:id/reject   Reject approval (includes user objects in response)
DELETE /approvals/:id          Cancel own pending approval (original requester only)
```

### Dashboard (4)
```
GET  /dashboard                       Full financial overview (income, expenses, savings, settlement, pending approvals count)
GET  /dashboard/savings               Savings per member
GET  /dashboard/settlement            Settlement calculation
POST /dashboard/settlement/mark-paid  Mark as settled
```

### Expense Payments (3)
```
GET  /expense-payments/:expenseId          Get payment statuses for expense
PUT  /expense-payments/:expenseId/:year/:month  Mark month as paid/pending
GET  /expense-payments/household           Get all household payment statuses
```

### Recurring Overrides (4)
```
GET    /recurring-overrides/:expenseId                     List overrides for expense
PUT    /recurring-overrides/:expenseId/:year/:month        Upsert single override
PUT    /recurring-overrides/:expenseId/batch               Batch upsert overrides
DELETE /recurring-overrides/:expenseId/upcoming/:year/:month  Delete upcoming overrides
```

### Savings (6)
```
GET  /savings/me                     My savings (personal + shared)
POST /savings/me/personal            Add personal savings
POST /savings/me/shared              Add shared savings
POST /savings/me/personal/withdraw   Withdraw personal savings
POST /savings/me/shared/withdraw     Request shared withdrawal -> approval
GET  /savings/household              All household savings
```

---

## Data Model (11 models, 10 enums)

| Model                  | Key Fields                                          | Purpose                     |
|------------------------|-----------------------------------------------------|-----------------------------|
| User                   | email, password, firstName, lastName, emailVerified  | User accounts               |
| Household              | name, inviteCode, maxMembers                        | Budget groups               |
| HouseholdMember        | userId, householdId, role (OWNER/MEMBER)            | Membership join table       |
| HouseholdInvitation    | status, senderId, targetUserId                      | Email invitations           |
| Salary                 | defaultAmount, currentAmount, month, year            | Monthly income tracking     |
| Expense                | name, amount, type, category, frequency, yearlyPaymentStrategy, installmentFrequency, installmentCount | Personal & shared expenses |
| ExpenseApproval        | action, status, proposedData, requestedBy, reviewedBy | Change proposals          |
| Settlement             | amount, paidByUserId, paidToUserId, month, year     | Settlement audit trail      |
| ExpensePaymentStatus   | expenseId, month, year, status, paidById            | Per-month payment tracking  |
| RecurringOverride      | expenseId, month, year, amount, skipped             | Per-month amount overrides  |
| Saving                 | userId, amount, month, year, isShared               | Personal/shared savings     |

### Enums
| Enum                  | Values                                 |
|-----------------------|----------------------------------------|
| HouseholdRole         | OWNER, MEMBER                          |
| ExpenseType           | PERSONAL, SHARED                       |
| ExpenseCategory       | RECURRING, ONE_TIME                    |
| ExpenseFrequency      | MONTHLY, YEARLY                        |
| YearlyPaymentStrategy | FULL, INSTALLMENTS                     |
| InstallmentFrequency  | MONTHLY, QUARTERLY, SEMI_ANNUAL        |
| ApprovalAction        | CREATE, UPDATE, DELETE, WITHDRAW_SAVINGS |
| ApprovalStatus        | PENDING, ACCEPTED, REJECTED, CANCELLED |
| InvitationStatus      | PENDING, ACCEPTED, DECLINED, CANCELLED |
| PaymentStatus         | PENDING, PAID, CANCELLED               |

---

## Test Coverage

| Area                | Spec Files | Tests | Scope                                               |
|---------------------|-----------|-------|------------------------------------------------------|
| Backend unit        | 55        | 723   | Services, controllers, DTOs, filters, helpers        |
| Frontend unit       | 33        | -     | Services, stores, pipes, directives, components      |
| E2E (Playwright)    | 8         | -     | Auth, expenses, approvals, dashboard, settlement, savings, salary, timeline |
| **Total**           | **96**    |       |                                                      |

### E2E Test Suites (`e2e/tests/`)
| File                        | Coverage                                          |
|-----------------------------|---------------------------------------------------|
| `auth.spec.ts`              | Register, verify, login, refresh, password reset   |
| `personal-expenses.spec.ts` | CRUD, recurring, one-time, payment tracking        |
| `shared-expenses.spec.ts`   | Propose create/update/delete, approval flow        |
| `approvals.spec.ts`         | Accept, reject, cancel, history                    |
| `dashboard.spec.ts`         | Financial overview, expense/income summaries       |
| `savings.spec.ts`           | Personal & shared savings upsert                   |
| `salary.spec.ts`            | Salary upsert, household salaries                  |
| `timeline-navigation.spec.ts` | Month navigation, recurring overrides           |

```bash
# Run tests
cd backend && npm run test       # Backend (vitest run) — 55 spec files
cd frontend && npm run test      # Frontend (vitest run)
cd e2e && npm test               # E2E (playwright test) — requires running backend
```

---

## Key Patterns

### Auth Flow (Frontend)
`app.config.ts` uses `provideAppInitializer` to call `authService.refresh()` then `loadCurrentUser()` via `switchMap`. Access token is in-memory only; refresh token is in localStorage. The interceptor auto-refreshes on 401.

### Composite Endpoint Decorators (Backend)
Each module has `decorators/api-*.decorators.ts` bundling route + Swagger + throttle + HttpCode. All error responses use `ErrorResponseDto`.

### Global HttpExceptionFilter
All errors return consistent JSON with `timestamp` and `requestId`. Prisma errors auto-mapped (P2002->409, P2025->404).

### Approval Workflow
Shared expense changes (create/update/delete) and shared savings withdrawals create `ExpenseApproval` records with `requestedBy` user relation. Another household member must accept/reject. Accept/reject responses include full `requestedBy`/`reviewedBy` user objects.

### Expense Types
- **RECURRING MONTHLY**: Appears every month at full amount (supports per-month overrides)
- **RECURRING YEARLY FULL**: Appears once in the `paymentMonth` at full amount
- **RECURRING YEARLY INSTALLMENTS**: Spread across months at `amount / divisor` (MONTHLY=12, QUARTERLY=4, SEMI_ANNUAL=2)
- **ONE_TIME FULL**: Single expense at specific month/year
- **ONE_TIME INSTALLMENTS**: Spread over `installmentCount` payments at calculated per-installment amount

### Signal Stores (Frontend)
Each feature uses Angular signals for state management. Pattern: load/create/update/delete actions with loading/error signals.

### Caching (Backend)
`CacheService` wraps Redis with `getOrSet()`. `invalidateHousehold()` clears ALL caches for a household (expenses, approvals, savings, dashboard).

### JSDoc Recurring Cast
- **Alex** = OWNER (household creator)
- **Sam** = MEMBER (joined via code/invitation)
- **Jordan** = OUTSIDER (not in household yet)

---

## Redis Key Patterns

| Key                                         | Purpose                      | TTL       |
|---------------------------------------------|------------------------------|-----------|
| `verify:{email}`                            | Email verification code      | 10 min    |
| `reset:{token}`                             | Password reset token         | 1 hour    |
| `refresh:{token}`                           | Refresh token -> userId      | 7 days    |
| `user_sessions:{userId}`                    | Set of user's refresh tokens | 7 days    |
| `cache:dashboard:{householdId}:...`         | Dashboard overview/savings   | 120s      |
| `cache:approvals:pending:{householdId}`     | Pending approvals list       | 120s      |
| `cache:approvals:history:{householdId}:...` | Approval history             | 120s      |
| `delete_request:{requestId}`                | Account deletion request payload | 7 days |
| `delete_request_owner:{ownerId}`            | Owner's pending delete request ID | 7 days |
| `delete_request_target:{targetId}`          | Target member's pending delete request ID | 7 days |

---

## Commands

```bash
# Infrastructure
docker compose up -d          # Start PostgreSQL + Redis
docker compose down           # Stop containers

# Backend
cd backend
npm run start:dev             # Dev with hot reload (http://localhost:3000)
npm run build                 # Production build
npm run test                  # Run all tests (vitest run)
npm run test:cov              # Coverage report
npm run lint                  # ESLint with auto-fix
npm run format                # Prettier
npm run generate              # Regenerate Prisma client + DTOs
npx prisma migrate dev --config ./prisma.config.ts  # Run migrations
npm run prisma:studio         # Prisma Studio

# Frontend
cd frontend
npm start                     # ng serve (http://localhost:4200)
npx ng build                  # Production build -> dist/frontend/browser
npm run test                  # Run all tests (vitest run)
npm run test:cov              # Coverage report

# E2E (requires backend running + seeded DB)
cd e2e
npm test                      # Run all Playwright tests
npm run test:headed           # Run with browser visible
npm run test:ui               # Interactive Playwright UI
npm run test:debug            # Debug mode
```
