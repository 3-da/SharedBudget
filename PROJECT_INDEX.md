# Project Index: SharedBudget

## Stack

Angular 21 and Angular Material frontend; NestJS 11 and Prisma 7 backend; PostgreSQL 18; Redis 7; Vitest and Playwright; Docker, GitHub Actions, Vercel, and Railway.

## Directory Layout

```text
backend/              NestJS API, Prisma schema/migrations, demo seeder
frontend/             Angular SPA, features, shared UI, design tokens
e2e/                  Playwright suites, fixtures, global setup
docs/handbook/        Product and engineering reference
.github/workflows/    CI pipeline
docker-compose.yml    Local PostgreSQL, Redis, API, SPA, and Nginx
```

## Entry Points

- `backend/src/main.ts` — Nest application bootstrap, security middleware, validation, and API prefix
- `backend/src/app.module.ts` — backend dependency graph and global providers
- `backend/scripts/seed-demo.ts` — targeted public demo-account reset
- `frontend/src/main.ts` — Angular bootstrap
- `frontend/src/app/app.config.ts` — providers, HTTP, auth initialization, and routing
- `frontend/src/app/app.routes.ts` — public and authenticated route boundaries
- `frontend/src/app/core/layout/shell.component.ts` — authenticated application shell
- `e2e/global-setup.ts` — isolated browser-test users and cleanup

## API Routes

All application routes use `/api/v1`. Swagger documents exact request and response shapes outside production.

| Domain | Controller | Responsibilities |
|---|---|---|
| Authentication | `AuthController` | Register, verify, resend code, login, refresh, logout, password recovery |
| Users | `UserController` | Profile, password changes, sessions, account deletion |
| Households | `HouseholdController` | Create, join, invitations, ownership, members, invite codes |
| Income | `SalaryController` | Current/default salary and household salary history |
| Personal expenses | `PersonalExpenseController` | Private expense create, read, update, and delete |
| Shared expenses | `SharedExpenseController` | Approval-gated shared expense proposals |
| Decisions | `ApprovalController` | Pending/history lists, accept, reject, and cancel |
| Dashboard | `DashboardController` | Household summary, savings history, settlement, mark paid |
| Payments | `ExpensePaymentController` | Per-period expense payment state |
| Overrides | `RecurringOverrideController` | Recurring amount and skip overrides |
| Savings | `SavingController` | Personal/shared saving records and withdrawals |

The exhaustive route list lives in [`docs/handbook/04-api-reference.md`](./docs/handbook/04-api-reference.md).

## Data Layer

- `backend/prisma/schema.prisma` — users, households, memberships, invitations, expenses, approvals, salaries, savings, payments, overrides, and settlements
- `backend/prisma/migrations/` — ordered PostgreSQL schema migrations
- `backend/src/prisma/prisma.service.ts` — application database client
- `backend/src/common/cache/cache.service.ts` — Redis cache-aside access and invalidation
- `backend/src/session/session.service.ts` — refresh-token session storage and revocation
- `backend/src/demo-data/` — deterministic salary/savings history and demo identities

## Frontend

| Area | Route group | Main page or component |
|---|---|---|
| Authentication | `/auth/*` | `LoginComponent`, registration, verification, password recovery |
| Household | `/household/*` | `HouseholdDetailComponent`, invitations, member details |
| Snapshot | `/dashboard` | `DashboardComponent` and financial summary cards |
| My expenses | `/personal-expenses/*` | personal list, form, and recurring timeline |
| Shared expenses | `/shared-expenses/*` | shared list, proposal form, and timeline |
| Income | `/salary` | `SalaryOverviewComponent` |
| Savings | `/savings` | `SavingsOverviewComponent` |
| Decisions | `/approvals` | `ApprovalListComponent` |
| Settings | `/settings` | profile, password, sessions, and deletion |

Shared frontend infrastructure:

- `frontend/src/app/core/auth/` — session restoration, tokens, interceptor, and guard
- `frontend/src/app/core/api/` — typed API boundary
- `frontend/src/app/core/layout/` — toolbar, navigation, and responsive shell
- `frontend/src/app/shared/components/` — charts, empty states, headers, month picker, and payment UI
- `frontend/src/styles/_variables.scss` — light/dark design tokens

## Key Flows

- Public demo: `LoginComponent.loginToPublicDemo()` → `AuthService.login()` → `AuthController.login()` → session creation → `/household`
- Session restore: application initializer → `AuthService.refresh()` → refresh-token rotation → `loadCurrentUser()`
- Shared expense proposal: shared expense form → `SharedExpenseService` → `SharedExpenseController` → pending `ExpenseApproval`
- Decision review: `ApprovalListComponent` → approval store/service → `ApprovalController` → accepted mutation or rejected proposal
- Household snapshot: dashboard store → dashboard service/controller → cached Prisma aggregation → summary cards
- Demo startup: Railway container → Prisma migrations → `seedDemoData()` → Nest application start
- CI release gate: unit tests/builds → seeded E2E database → Playwright Chromium suite

## Utilities

- `backend/src/common/utils/` — currency, date, email masking, and validation helpers
- `backend/src/common/decorators/` and feature `decorators/` — authorization and composite endpoint metadata
- `frontend/src/app/shared/utils/` — recurring timeline and monthly expense loading
- `frontend/src/app/shared/pipes/` — EUR currency and relative-time presentation
- `frontend/src/app/shared/validators/` — reusable reactive-form validation

## Verification

- Backend: 58 Vitest spec files, 1,143 tests
- Frontend: 43 Vitest spec files, 323 tests
- E2E: 10 Playwright suites, 80 Chromium cases in CI
- Workflow: `.github/workflows/ci.yml`
