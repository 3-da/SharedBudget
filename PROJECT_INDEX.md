# SharedBudget — Project Index

> **Generated:** 2026-02-08 | **Backend:** Complete (44 endpoints) | **Frontend:** Complete (Angular 21)

A household budget management app where members track personal/shared expenses, manage salaries, and settle debts.

---

## Quick Links

| Document                             | Purpose                                                     |
|--------------------------------------|-------------------------------------------------------------|
| [SPEC.md](./SPEC.md)                 | Business requirements, user stories, API endpoints          |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Tech stack, data model, infrastructure, caching             |
| [CLAUDE.md](./CLAUDE.md)             | Development rules for Claude Code (tests, logging, Swagger) |
| [TODO.md](./TODO.md)                 | Task tracking                                               |

---

## Tech Stack

| Layer          | Technology                              | Version          |
|----------------|-----------------------------------------|------------------|
| Frontend       | Angular + Angular Material (M3)         | 21.1.x           |
| Frontend Dates | date-fns                                | 4.x              |
| Backend        | NestJS                                  | 11.x             |
| ORM            | Prisma (with @prisma/adapter-pg)        | 7.3.0            |
| Database       | PostgreSQL                              | 18 (alpine)      |
| Cache/Sessions | Redis (ioredis)                         | 7 (alpine)       |
| Auth           | JWT (passport-jwt) + Argon2             | passport-jwt 4.x |
| Testing        | Vitest (both frontend and backend)      | 4.x              |
| API Docs       | @nestjs/swagger                         | 11.2.5           |
| Language       | TypeScript                              | 5.7 (BE) / 5.9 (FE) |

---

## Project Structure

```
SharedBudget/
├── backend/                    # NestJS 11 REST API
│   ├── src/
│   │   ├── main.ts             # Entry point (port 3000)
│   │   ├── app.module.ts       # Root module
│   │   ├── auth/               # Register, login, verify, password reset, refresh
│   │   ├── user/               # Profile CRUD, change password
│   │   ├── household/          # Household CRUD, membership, invitations
│   │   ├── salary/             # Salary upsert, monthly tracking
│   │   ├── personal-expense/   # Personal expense CRUD
│   │   ├── shared-expense/     # Shared expense proposals (approval-gated)
│   │   ├── approval/           # Accept/reject shared expense changes
│   │   ├── dashboard/          # Financial overview, settlement calc, mark-paid
│   │   ├── session/            # Redis session management
│   │   ├── common/             # Filters, DTOs, helpers, logger, cache, utils
│   │   ├── prisma/             # PrismaService (PostgreSQL via @prisma/adapter-pg)
│   │   ├── redis/              # Redis module + throttler storage
│   │   ├── mail/               # Email service (placeholder, logs in dev)
│   │   └── generated/          # Auto-generated Prisma client + DTOs (DO NOT EDIT)
│   └── prisma/
│       └── schema.prisma       # 8 models, 9 enums
├── frontend/                   # Angular 21 SPA
│   └── src/app/
│       ├── main.ts             # Bootstrap (zoneless)
│       ├── app.ts              # Root component
│       ├── app.routes.ts       # Top-level routing
│       ├── app.config.ts       # Providers config
│       ├── core/               # Auth, API, error handling, layout
│       │   ├── api/            # ApiService (centralized HTTP)
│       │   ├── auth/           # TokenService, AuthService, interceptor, guard
│       │   ├── error/          # Global ErrorHandlerService
│       │   └── layout/         # ShellComponent, ToolbarComponent, SidenavComponent
│       ├── shared/             # Pipes, directives, reusable components
│       │   ├── pipes/          # CurrencyEurPipe, MonthlyEquivalentPipe, RelativeTimePipe
│       │   ├── directives/     # AutoFocusDirective, PositiveNumberDirective
│       │   └── components/     # LoadingSpinner, EmptyState, CurrencyDisplay, ConfirmDialog, PageHeader
│       └── features/           # Feature modules (lazy-loaded routes)
│           ├── auth/           # Login, register, verify-code, forgot/reset password
│           ├── household/      # Create, join, manage members, invitations
│           ├── salary/         # Salary overview + form
│           ├── personal-expenses/ # List + form pages
│           ├── shared-expenses/   # List + form pages
│           ├── approvals/      # Pending/history approval lists
│           ├── dashboard/      # Income, expenses, savings, settlement cards
│           └── settings/       # Profile + change password forms
├── docker-compose.yml          # PostgreSQL 18 + Redis 7
├── CLAUDE.md                   # Development guidelines
├── SPEC.md                     # Business requirements & API spec
├── ARCHITECTURE.md             # Tech stack & data model
└── TODO.md                     # Task tracking
```

---

## Backend Modules (8 feature + 7 infrastructure)

| Module               | Controller | Service(s)                                 | Endpoints | Purpose                                          |
|----------------------|-----------|-------------------------------------------|-----------|--------------------------------------------------|
| **auth**             | Yes       | AuthService                               | 8         | Register, verify, login, refresh, logout, pwd reset |
| **household**        | Yes       | HouseholdService, HouseholdInvitationService | 10     | CRUD, join/leave, invite, transfer ownership     |
| **user**             | Yes       | UserService                               | 3         | Profile get/update, change password              |
| **salary**           | Yes       | SalaryService                             | 4         | Upsert salary, get own/household/monthly         |
| **personal-expense** | Yes       | PersonalExpenseService                    | 5         | CRUD for personal expenses                       |
| **shared-expense**   | Yes       | SharedExpenseService                      | 5         | Propose create/update/delete (needs approval)    |
| **approval**         | Yes       | ApprovalService                           | 4         | List pending/history, accept, reject             |
| **dashboard**        | Yes       | DashboardService                          | 4         | Overview, savings, settlement, mark-paid         |
| session              | No        | SessionService                            | -         | Redis session CRUD                               |
| cache                | No        | CacheService                              | -         | Redis caching layer                              |
| prisma               | No        | PrismaService                             | -         | Database client                                  |
| redis                | No        | -                                         | -         | Redis connection + throttler storage             |
| mail                 | No        | MailService                               | -         | Email placeholder (logs in dev)                  |
| expense-helper       | No        | ExpenseHelperService                      | -         | Shared expense mappers and utilities             |
| logger               | No        | -                                         | -         | Pino logger config with redaction                |

**Total: 44 API endpoints across 8 controllers**

---

## Frontend Feature Map

| Feature              | Pages                           | Components                                     | Store | Service |
|----------------------|---------------------------------|------------------------------------------------|-------|---------|
| **auth**             | Login, Register, VerifyCode, ForgotPassword, ResetPassword | PasswordField, CodeInput | -     | AuthService (core) |
| **household**        | HouseholdDetail, PendingInvitations | CreateHouseholdForm, JoinByCodeForm, InviteDialog, MemberList | HouseholdStore | HouseholdService, InvitationService |
| **salary**           | SalaryOverview                  | SalaryForm, SalarySummaryCard                  | SalaryStore | SalaryService |
| **personal-expenses**| PersonalExpenseList, PersonalExpenseFormPage | ExpenseCard, ExpenseForm              | PersonalExpenseStore | PersonalExpenseService |
| **shared-expenses**  | SharedExpenseList, SharedExpenseFormPage | SharedExpenseCard                     | SharedExpenseStore | SharedExpenseService |
| **approvals**        | ApprovalList                    | ApprovalCard, RejectDialog                     | ApprovalStore | ApprovalService |
| **dashboard**        | Dashboard                       | IncomeSummaryCard, ExpenseSummaryCard, SavingsCard, SettlementCard | DashboardStore | DashboardService |
| **settings**         | Settings                        | ProfileForm, ChangePasswordForm                | -     | - (uses UserService via core) |

**15 pages | 20+ components | 6 signal stores | 9 API services**

---

## API Endpoints (44 total, all prefixed with `/api/v1`)

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

### Household (10)
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

### User (3)
```
GET /users/me           Get profile
PUT /users/me           Update profile (name)
PUT /users/me/password  Change password
```

### Salary (4)
```
GET /salary/me                      My salary (current month)
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

### Approvals (4)
```
GET /approvals              List pending approvals
GET /approvals/history      Past approvals (with status filter)
PUT /approvals/:id/accept   Accept approval
PUT /approvals/:id/reject   Reject approval
```

### Dashboard (4)
```
GET  /dashboard                       Full financial overview
GET  /dashboard/savings               Savings per member
GET  /dashboard/settlement            Settlement calculation
POST /dashboard/settlement/mark-paid  Mark as settled
```

---

## Data Model (8 models, 9 enums)

| Model               | Key Fields                                          | Purpose                    |
|---------------------|-----------------------------------------------------|----------------------------|
| User                | email, password, firstName, lastName, emailVerified | User accounts              |
| Household           | name, inviteCode, maxMembers                        | Budget groups              |
| HouseholdMember     | userId, householdId, role (OWNER/MEMBER)            | Membership join table      |
| HouseholdInvitation | status, senderId, targetUserId                      | Email invitations          |
| Salary              | defaultAmount, currentAmount, month, year           | Monthly income tracking    |
| Expense             | name, amount, type, category, frequency             | Personal & shared expenses |
| ExpenseApproval     | action, status, proposedData                        | Change proposals           |
| Settlement          | amount, paidByUserId, paidToUserId, month, year     | Settlement audit trail     |

### Enums
| Enum                  | Values                                 |
|-----------------------|----------------------------------------|
| HouseholdRole         | OWNER, MEMBER                          |
| ExpenseType           | PERSONAL, SHARED                       |
| ExpenseCategory       | RECURRING, ONE_TIME                    |
| ExpenseFrequency      | MONTHLY, YEARLY                        |
| YearlyPaymentStrategy | FULL, INSTALLMENTS                     |
| InstallmentFrequency  | MONTHLY, QUARTERLY, SEMI_ANNUAL        |
| ApprovalAction        | CREATE, UPDATE, DELETE                  |
| ApprovalStatus        | PENDING, ACCEPTED, REJECTED            |
| InvitationStatus      | PENDING, ACCEPTED, DECLINED, CANCELLED |

---

## Test Coverage

| Area                | Spec Files | Scope                                               |
|---------------------|-----------|------------------------------------------------------|
| Backend unit        | 35        | Services, controllers, DTOs, filters, helpers        |
| Frontend unit       | 33        | Services, stores, pipes, directives, components      |
| **Total**           | **68**    |                                                      |

```bash
# Run tests
cd backend && npm run test       # Backend (vitest run)
cd frontend && npm run test      # Frontend (vitest run)
```

---

## Key Patterns

### Composite Endpoint Decorators (Backend)
Each module has `decorators/api-*.decorators.ts` bundling route + Swagger + throttle + HttpCode.

### Global HttpExceptionFilter
All errors return consistent JSON with `timestamp` and `requestId`. Prisma errors auto-mapped (P2002->409, P2025->404).

### Approval Workflow
Shared expense changes (create/update/delete) create `ExpenseApproval` records that another household member must accept/reject.

### Signal Stores (Frontend)
Each feature uses Angular signals for state management. Pattern: load/create/update/delete actions with loading/error signals.

### JSDoc Recurring Cast
- **Alex** = OWNER (household creator)
- **Sam** = MEMBER (joined via code/invitation)
- **Jordan** = OUTSIDER (not in household yet)

---

## Redis Key Patterns

| Key                      | Purpose                      | TTL    |
|--------------------------|------------------------------|--------|
| `verify:{email}`         | Email verification code      | 10 min |
| `reset:{token}`          | Password reset token         | 1 hour |
| `refresh:{token}`        | Refresh token -> userId      | 7 days |
| `user_sessions:{userId}` | Set of user's refresh tokens | 7 days |

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
npm run test                  # Run all tests
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
npm run test                  # Run all tests
npm run test:cov              # Coverage report
```
