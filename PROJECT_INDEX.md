# SharedBudget — Project Index

> **Generated:** 2026-02-05 | **Backend Status:** Phase 1 Complete (44 endpoints) | **Frontend:** Pending

Quick navigation for developers and AI assistants working on this codebase.

---

## Quick Links

| Document | Purpose |
|----------|---------|
| [SPEC.md](./SPEC.md) | Business requirements, user stories, API endpoints |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Tech stack, data model, infrastructure, caching |
| [CLAUDE.md](./CLAUDE.md) | Development rules for Claude Code (tests, logging, Swagger) |

---

## Tech Stack Summary

| Layer | Technology | Version |
|-------|------------|---------|
| Runtime | Node.js | 24.13.0 LTS |
| Framework | NestJS | 11.1.x |
| ORM | Prisma | 7.3.0 |
| Database | PostgreSQL | 18.1 |
| Cache/Sessions | Redis | 7.2.x |
| Auth | JWT + Argon2 | passport-jwt 4.0.1, argon2 0.44.0 |
| Testing | Vitest | 4.0.18 |
| API Docs | @nestjs/swagger | 11.2.5 |

---

## Module Index (14 modules)

| Module | Endpoints | Files | Description |
|--------|-----------|-------|-------------|
| **auth** | 8 | 12 | Registration, login, email verification, password reset, JWT tokens |
| **household** | 11 | 14 | CRUD, invitations, membership, ownership transfer |
| **user** | 3 | 8 | Profile management, password change |
| **salary** | 4 | 8 | Monthly salary tracking (default + current) |
| **personal-expense** | 5 | 10 | User's personal expenses (no approval) |
| **shared-expense** | 5 | 10 | Household shared expenses (approval workflow) |
| **approval** | 4 | 10 | Accept/reject proposed expense changes |
| **dashboard** | 4 | 12 | Financial overview, savings, settlement |
| **session** | — | 3 | Redis session management (refresh tokens) |
| **mail** | — | 2 | Email service (placeholder, logs in dev) |
| **prisma** | — | 2 | PrismaService with @prisma/adapter-pg |
| **redis** | — | 2 | Redis module + throttler storage |
| **common** | — | 9 | Shared utilities (DTOs, filters, expense helpers, logger) |
| **generated** | — | — | Auto-generated Prisma client + DTOs (DO NOT EDIT) |

**Total: 44 API endpoints**

---

## API Endpoints by Category

### Authentication (8 endpoints)
```
POST /auth/register          Register + send verification code
POST /auth/verify-code       Verify email → auto-login
POST /auth/resend-code       Resend verification code
POST /auth/login             Login → JWT tokens
POST /auth/refresh           Refresh access token
POST /auth/logout            Invalidate refresh token
POST /auth/forgot-password   Request password reset email
POST /auth/reset-password    Reset password with token
```

### Household (11 endpoints)
```
POST   /household                       Create household
GET    /household/mine                  Get my household
POST   /household/regenerate-code       New invite code (OWNER)
POST   /household/invite                Invite by email (OWNER)
GET    /household/invitations/pending   My pending invitations
POST   /household/invitations/:id/respond  Accept/decline
DELETE /household/invitations/:id       Cancel invitation
POST   /household/join                  Join by invite code
POST   /household/leave                 Leave household
DELETE /household/members/:userId       Remove member (OWNER)
POST   /household/transfer-ownership    Transfer OWNER role
```

### User (3 endpoints)
```
GET /users/me           Get profile
PUT /users/me           Update profile (name)
PUT /users/me/password  Change password
```

### Salary (4 endpoints)
```
GET /salary/me                     My salary (current month)
PUT /salary/me                     Upsert my salary
GET /salary/household              All household salaries
GET /salary/household/:year/:month Salaries for specific month
```

### Personal Expenses (5 endpoints)
```
GET    /expenses/personal      List my personal expenses
POST   /expenses/personal      Create personal expense
GET    /expenses/personal/:id  Get expense details
PUT    /expenses/personal/:id  Update expense
DELETE /expenses/personal/:id  Soft-delete expense
```

### Shared Expenses (5 endpoints)
```
GET    /expenses/shared      List shared expenses
GET    /expenses/shared/:id  Get shared expense
POST   /expenses/shared      Propose new expense → approval
PUT    /expenses/shared/:id  Propose edit → approval
DELETE /expenses/shared/:id  Propose delete → approval
```

### Approvals (4 endpoints)
```
GET /approvals          List pending approvals
GET /approvals/history  Past approvals (with status filter)
PUT /approvals/:id/accept  Accept approval
PUT /approvals/:id/reject  Reject approval
```

### Dashboard (4 endpoints)
```
GET  /dashboard                  Full financial overview
GET  /dashboard/savings          Savings per member
GET  /dashboard/settlement       Settlement calculation
POST /dashboard/settlement/mark-paid  Mark as settled
```

*All endpoints prefixed with `/api/v1`*

---

## Data Model (9 models, 9 enums)

### Models
| Model | Key Fields | Purpose |
|-------|------------|---------|
| User | email, password, firstName, lastName, emailVerified | User accounts |
| Household | name, inviteCode, maxMembers | Budget groups |
| HouseholdMember | userId, householdId, role | Membership join table |
| HouseholdInvitation | status, senderId, targetUserId | Email invitations |
| Salary | defaultAmount, currentAmount, month, year | Monthly income tracking |
| Expense | name, amount, type, category, frequency | Personal & shared expenses |
| ExpenseApproval | action, status, proposedData | Change proposals |
| Settlement | amount, paidByUserId, paidToUserId | Settlement audit trail |

### Enums
| Enum | Values |
|------|--------|
| HouseholdRole | OWNER, MEMBER |
| ExpenseType | PERSONAL, SHARED |
| ExpenseCategory | RECURRING, ONE_TIME |
| ExpenseFrequency | MONTHLY, YEARLY |
| YearlyPaymentStrategy | FULL, INSTALLMENTS |
| InstallmentFrequency | MONTHLY, QUARTERLY, SEMI_ANNUAL |
| ApprovalAction | CREATE, UPDATE, DELETE |
| ApprovalStatus | PENDING, ACCEPTED, REJECTED |
| InvitationStatus | PENDING, ACCEPTED, DECLINED, CANCELLED |

---

## Test Files (33 spec files)

| Category | Files |
|----------|-------|
| **Auth** | auth.service.spec.ts, auth.controller.spec.ts, auth-dto.spec.ts |
| **Household** | household.service.spec.ts, household.controller.spec.ts, household-invitation.service.spec.ts, household-dto.spec.ts |
| **User** | user.service.spec.ts, user.controller.spec.ts, user-dto.spec.ts |
| **Salary** | salary.service.spec.ts, salary.controller.spec.ts, upsert-salary.dto.spec.ts |
| **Personal Expense** | personal-expense.service.spec.ts, personal-expense.controller.spec.ts, create-personal-expense.dto.spec.ts, update-personal-expense.dto.spec.ts, list-personal-expenses-query.dto.spec.ts |
| **Shared Expense** | shared-expense.service.spec.ts, shared-expense.controller.spec.ts, create-shared-expense.dto.spec.ts, update-shared-expense.dto.spec.ts, list-shared-expenses-query.dto.spec.ts |
| **Approval** | approval.service.spec.ts, approval.controller.spec.ts, accept-approval.dto.spec.ts, reject-approval.dto.spec.ts, list-approvals-query.dto.spec.ts |
| **Dashboard** | dashboard.service.spec.ts, dashboard.controller.spec.ts |
| **Common** | session.service.spec.ts, expense-helper.service.spec.ts, http-exception.filter.spec.ts, cache.service.spec.ts |

**Run tests:** `cd backend && npm run test`

---

## Key Patterns

### Composite Endpoint Decorators
Each module has `decorators/api-*.decorators.ts` bundling route + Swagger + throttle:
```typescript
export function MyEndpoint() {
    return applyDecorators(
        Post('route'),
        ApiOperation({ summary: '...', description: '...' }),
        ApiResponse({ status: 200, type: ResponseDto }),
        ApiResponse({ status: 400, type: ErrorResponseDto }),
        Throttle({ default: { limit: 5, ttl: 60000 } }),
        HttpCode(HttpStatus.OK),
    );
}
```

### Error Response Shape
All errors return consistent JSON via global `HttpExceptionFilter`:
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request",
  "timestamp": "2026-02-05T12:00:00.000Z",
  "requestId": "abc-123"
}
```

### Approval Workflow
Shared expense changes (create/update/delete) don't modify data directly — they create `ExpenseApproval` records that must be accepted by another household member.

### JSDoc Recurring Cast
Use these names in scenario descriptions:
- **Alex** = OWNER (household creator)
- **Sam** = MEMBER (joined via code/invitation)
- **Jordan** = OUTSIDER (not in household yet)

---

## Redis Key Patterns

| Key | Purpose | TTL |
|-----|---------|-----|
| `verify:{email}` | Email verification code | 10 min |
| `reset:{token}` | Password reset token | 1 hour |
| `refresh:{token}` | Refresh token → userId | 7 days |
| `user_sessions:{userId}` | Set of user's refresh tokens | 7 days |

---

## Commands

```bash
# Development
cd backend
npm run start:dev    # Start with hot reload
npm run build        # Build for production

# Testing
npm run test         # Run all tests
npm run test:watch   # Watch mode
npm run test:cov     # Coverage report

# Code Quality
npm run lint         # ESLint with auto-fix
npm run format       # Prettier

# Prisma
npx prisma generate --config ./prisma.config.ts  # Regenerate client + DTOs
npx prisma migrate dev --config ./prisma.config.ts  # Run migrations

# Docker
docker compose up -d    # Start PostgreSQL + Redis
docker compose down     # Stop containers
```

---

## Directory Structure

```
SharedBudget/
├── backend/
│   ├── src/
│   │   ├── auth/           # 8 endpoints, 12 files
│   │   ├── household/      # 11 endpoints, 14 files
│   │   ├── user/           # 3 endpoints, 8 files
│   │   ├── salary/         # 4 endpoints, 8 files
│   │   ├── personal-expense/  # 5 endpoints, 10 files
│   │   ├── shared-expense/    # 5 endpoints, 10 files
│   │   ├── approval/       # 4 endpoints, 10 files
│   │   ├── dashboard/      # 4 endpoints, 12 files
│   │   ├── session/        # Redis sessions, 3 files
│   │   ├── mail/           # Email placeholder, 2 files
│   │   ├── prisma/         # PrismaService, 2 files
│   │   ├── redis/          # Redis module, 2 files
│   │   ├── common/         # Shared utils, 9 files
│   │   │   ├── cache/      # CacheService
│   │   │   ├── dto/        # ErrorResponseDto, MessageResponseDto
│   │   │   ├── expense/    # ExpenseHelperService, mappers
│   │   │   ├── filters/    # HttpExceptionFilter
│   │   │   ├── logger/     # Pino config
│   │   │   └── utils/      # pickDefined
│   │   ├── generated/      # Auto-generated (DO NOT EDIT)
│   │   ├── app.module.ts   # Root module
│   │   └── main.ts         # Bootstrap
│   └── prisma/
│       └── schema.prisma   # 9 models, 9 enums
├── SPEC.md                 # Business requirements
├── ARCHITECTURE.md         # Technical reference
├── CLAUDE.md               # Dev process rules
└── docker-compose.yml      # PostgreSQL + Redis
```
