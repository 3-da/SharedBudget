# SharedBudget — Project Index

> **Generated:** 2026-02-07 | **Backend Status:** Phase 1 Complete (44 endpoints) | **Frontend:** Pending

Quick navigation for developers and AI assistants working on this codebase.

---

## Quick Links

| Document                             | Purpose                                                     |
|--------------------------------------|-------------------------------------------------------------|
| [SPEC.md](./SPEC.md)                 | Business requirements, user stories, API endpoints          |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Tech stack, data model, infrastructure, caching             |
| [CLAUDE.md](./CLAUDE.md)             | Development rules for Claude Code (tests, logging, Swagger) |

---

## Tech Stack Summary

| Layer          | Technology      | Version                           |
|----------------|-----------------|-----------------------------------|
| Runtime        | Node.js         | 24.x LTS                          |
| Framework      | NestJS          | 11.x                              |
| ORM            | Prisma          | 7.3.0                             |
| Database       | PostgreSQL      | 18 (alpine)                       |
| Cache/Sessions | Redis           | 7 (alpine)                        |
| Auth           | JWT + Argon2    | passport-jwt 4.0.1, argon2 0.44.0 |
| Testing        | Vitest          | 4.0.18                            |
| API Docs       | @nestjs/swagger | 11.2.5                            |

---

## Module Index (15 modules, 125 source files)

| Module               | Endpoints | Files (src/spec) | Description                                                         |
|----------------------|-----------|------------------|---------------------------------------------------------------------|
| **auth**             | 8         | 15 / 3           | Registration, login, email verification, password reset, JWT tokens |
| **household**        | 11        | 11 / 4           | CRUD, invitations, membership, ownership transfer                   |
| **user**             | 3         | 7 / 3            | Profile management, password change                                 |
| **salary**           | 4         | 6 / 3            | Monthly salary tracking (default + current)                         |
| **personal-expense** | 5         | 8 / 5            | User's personal expenses (no approval)                              |
| **shared-expense**   | 5         | 8 / 5            | Household shared expenses (approval workflow)                       |
| **approval**         | 4         | 8 / 5            | Accept/reject proposed expense changes                              |
| **dashboard**        | 4         | 10 / 2           | Financial overview, savings, settlement                             |
| **session**          | --        | 2 / 1            | Redis session management (refresh tokens)                           |
| **mail**             | --        | 2 / 0            | Email service (placeholder, logs in dev)                            |
| **prisma**           | --        | 2 / 0            | PrismaService with @prisma/adapter-pg                               |
| **redis**            | --        | 2 / 0            | Redis module + throttler storage                                    |
| **common/cache**     | --        | 2 / 1            | CacheService (Redis-backed TTL cache)                               |
| **common/expense**   | --        | 3 / 1            | ExpenseHelperService, mappers                                       |
| **common**           | --        | 5 / 1            | DTOs, HttpExceptionFilter, logger, utils                            |

**Total: 44 API endpoints | 91 source files | 34 spec files**

---

## API Endpoints by Category

### Authentication (8 endpoints)
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

### Household (11 endpoints)
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

### User (3 endpoints)
```
GET /users/me           Get profile
PUT /users/me           Update profile (name)
PUT /users/me/password  Change password
```

### Salary (4 endpoints)
```
GET /salary/me                      My salary (current month)
PUT /salary/me                      Upsert my salary
GET /salary/household               All household salaries
GET /salary/household/:year/:month  Salaries for specific month
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
POST   /expenses/shared      Propose new expense -> approval
PUT    /expenses/shared/:id  Propose edit -> approval
DELETE /expenses/shared/:id  Propose delete -> approval
```

### Approvals (4 endpoints)
```
GET /approvals              List pending approvals
GET /approvals/history      Past approvals (with status filter)
PUT /approvals/:id/accept   Accept approval
PUT /approvals/:id/reject   Reject approval
```

### Dashboard (4 endpoints)
```
GET  /dashboard                       Full financial overview
GET  /dashboard/savings               Savings per member
GET  /dashboard/settlement            Settlement calculation
POST /dashboard/settlement/mark-paid  Mark as settled
```

*All endpoints prefixed with `/api/v1`*

---

## Data Model (9 models, 9 enums)

### Models
| Model               | Key Fields                                          | Purpose                    |
|---------------------|-----------------------------------------------------|----------------------------|
| User                | email, password, firstName, lastName, emailVerified | User accounts              |
| Household           | name, inviteCode, maxMembers                        | Budget groups              |
| HouseholdMember     | userId, householdId, role                           | Membership join table      |
| HouseholdInvitation | status, senderId, targetUserId                      | Email invitations          |
| Salary              | defaultAmount, currentAmount, month, year           | Monthly income tracking    |
| Expense             | name, amount, type, category, frequency             | Personal & shared expenses |
| ExpenseApproval     | action, status, proposedData                        | Change proposals           |
| Settlement          | amount, paidByUserId, paidToUserId                  | Settlement audit trail     |

### Enums
| Enum                  | Values                                 |
|-----------------------|----------------------------------------|
| HouseholdRole         | OWNER, MEMBER                          |
| ExpenseType           | PERSONAL, SHARED                       |
| ExpenseCategory       | RECURRING, ONE_TIME                    |
| ExpenseFrequency      | MONTHLY, YEARLY                        |
| YearlyPaymentStrategy | FULL, INSTALLMENTS                     |
| InstallmentFrequency  | MONTHLY, QUARTERLY, SEMI_ANNUAL        |
| ApprovalAction        | CREATE, UPDATE, DELETE                 |
| ApprovalStatus        | PENDING, ACCEPTED, REJECTED            |
| InvitationStatus      | PENDING, ACCEPTED, DECLINED, CANCELLED |

---

## Test Coverage (34 spec files)

| Category             | Files                                                                                                                                                                      |
|----------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Auth**             | auth.service.spec, auth.controller.spec, auth-dto.spec                                                                                                                     |
| **Household**        | household.service.spec, household.controller.spec, household-invitation.service.spec, household-dto.spec                                                                   |
| **User**             | user.service.spec, user.controller.spec, user-dto.spec                                                                                                                     |
| **Salary**           | salary.service.spec, salary.controller.spec, upsert-salary.dto.spec                                                                                                        |
| **Personal Expense** | personal-expense.service.spec, personal-expense.controller.spec, create-personal-expense.dto.spec, update-personal-expense.dto.spec, list-personal-expenses-query.dto.spec |
| **Shared Expense**   | shared-expense.service.spec, shared-expense.controller.spec, create-shared-expense.dto.spec, update-shared-expense.dto.spec, list-shared-expenses-query.dto.spec           |
| **Approval**         | approval.service.spec, approval.controller.spec, accept-approval.dto.spec, reject-approval.dto.spec, list-approvals-query.dto.spec                                         |
| **Dashboard**        | dashboard.service.spec, dashboard.controller.spec                                                                                                                          |
| **Common**           | session.service.spec, expense-helper.service.spec, http-exception.filter.spec, cache.service.spec                                                                          |

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
  "timestamp": "2026-02-07T12:00:00.000Z",
  "requestId": "abc-123"
}
```

### Approval Workflow
Shared expense changes (create/update/delete) don't modify data directly -- they create `ExpenseApproval` records that must be accepted by another household member.

### Caching
`CacheService` wraps Redis with typed get/set/delete. Used in salary and expense services to cache frequently read data with configurable TTL.

### JSDoc Recurring Cast
Use these names in scenario descriptions:
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
npm run generate     # Regenerate client + DTOs (with auto-format)
npx prisma migrate dev --config ./prisma.config.ts  # Run migrations
npm run prisma:studio  # Open Prisma Studio

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
│   │   ├── auth/              # 8 endpoints, 18 files
│   │   ├── household/         # 11 endpoints, 15 files
│   │   ├── user/              # 3 endpoints, 10 files
│   │   ├── salary/            # 4 endpoints, 9 files
│   │   ├── personal-expense/  # 5 endpoints, 13 files
│   │   ├── shared-expense/    # 5 endpoints, 13 files
│   │   ├── approval/          # 4 endpoints, 13 files
│   │   ├── dashboard/         # 4 endpoints, 12 files
│   │   ├── session/           # Redis sessions, 3 files
│   │   ├── mail/              # Email placeholder, 2 files
│   │   ├── prisma/            # PrismaService, 2 files
│   │   ├── redis/             # Redis module, 2 files
│   │   ├── common/            # Shared utils, 13 files
│   │   │   ├── cache/         # CacheService (Redis-backed)
│   │   │   ├── dto/           # ErrorResponseDto, MessageResponseDto
│   │   │   ├── expense/       # ExpenseHelperService, mappers
│   │   │   ├── filters/       # HttpExceptionFilter
│   │   │   ├── logger/        # Pino config
│   │   │   └── utils/         # pickDefined
│   │   ├── generated/         # Auto-generated Prisma client + DTOs (DO NOT EDIT)
│   │   ├── app.module.ts      # Root module
│   │   └── main.ts            # Bootstrap
│   └── prisma/
│       └── schema.prisma      # 9 models, 9 enums
├── SPEC.md                    # Business requirements
├── ARCHITECTURE.md            # Technical reference
├── CLAUDE.md                  # Dev process rules
├── PROJECT_INDEX.md           # This file
└── docker-compose.yml         # PostgreSQL + Redis
```
