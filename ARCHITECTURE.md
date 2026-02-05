# Household Budget Tracker — Architecture & Technical Reference

**Document Version:** 3.0
**Created:** January 29, 2026 (Extracted from SPEC.md v2.0)
**Updated:** February 4, 2026 (Synced with current codebase state)

> **Related docs:**
> - `SPEC.md` — Business requirements, user stories, feature specs, API endpoints
> - `CLAUDE.md` — Development process rules for Claude Code
> - `docs/CONCEPTS.md` — Educational guide: Logger, Redis, Swagger explained

---

## Technology Stack

### Frontend
| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 19.2.4 | UI framework |
| Vite | 7.3.1 | Build tool + dev server with HMR |
| TypeScript | 5.9.x | Language (strict mode) |
| TailwindCSS | 4.1.x | Styling |
| Shadcn/UI | latest | UI component library |
| axios | 1.7.x | HTTP client with JWT interceptors |
| React Hook Form | 7.x | Form handling |
| Zod | latest | Schema validation |
| date-fns | 4.x | Date utilities |

### Backend
| Technology | Version | Purpose |
|-----------|---------|---------|
| Node.js | 24.13.0 LTS | Runtime |
| NestJS | 11.1.x | Framework |
| TypeScript | 5.9.x | Language (strict mode) |
| Prisma | 7.3.0 | ORM (Rust-free, @prisma/adapter-pg) |
| @nestjs/swagger | 11.2.5 | API documentation |
| @nestjs/throttler | 6.5.0 | Rate limiting (Redis-backed) |
| class-validator | 0.14.3 | Input validation |
| class-transformer | 0.5.1 | DTO transformation |
| ioredis | 5.9.2 | Redis client |
| @nestjs/jwt | 11.0.2 | JWT authentication |
| @nestjs/passport | 11.0.5 | Auth strategies |
| passport-jwt | 4.0.1 | JWT strategy |
| argon2 | 0.44.0 | Password hashing |
| nestjs-pino | 4.5.0 | Structured logging |
| pino | 10.3.0 | Logger |
| vitest | 4.0.18 | Testing framework |

### Database
| Technology | Version | Purpose |
|-----------|---------|---------|
| PostgreSQL | 18.1 | Primary database |
| Prisma | 7.3.0 | ORM + migrations (via @prisma/adapter-pg) |
| Redis | 7.2.x | Session storage + rate limiting + caching |

---

## Data Model (Prisma Schema)

**8 models, 9 enums**

### Enums
| Enum | Values | Purpose |
|------|--------|---------|
| HouseholdRole | OWNER, MEMBER | Member role in household |
| ExpenseType | PERSONAL, SHARED | Expense ownership type |
| ExpenseCategory | RECURRING, ONE_TIME | Expense recurrence |
| ExpenseFrequency | MONTHLY, YEARLY | Payment frequency |
| YearlyPaymentStrategy | FULL, INSTALLMENTS | How yearly expenses are paid |
| InstallmentFrequency | MONTHLY, QUARTERLY, SEMI_ANNUAL | Installment payment schedule (12, 4, or 2 payments/year) |
| ApprovalAction | CREATE, UPDATE, DELETE | Type of proposed change |
| ApprovalStatus | PENDING, ACCEPTED, REJECTED | Approval lifecycle state |
| InvitationStatus | PENDING, ACCEPTED, DECLINED, CANCELLED | Invitation lifecycle state |

### User
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| email | String | Unique, used for login |
| password | String | Argon2id hashed |
| firstName | String | Display name |
| lastName | String | Display name |
| emailVerified | Boolean | Default `false`, set `true` after verification |
| createdAt | DateTime | Auto-generated |
| updatedAt | DateTime | Auto-updated |
| deletedAt | DateTime? | Null = active. Non-null = soft-deleted |

### Household
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| name | String | e.g., "The Smiths" |
| inviteCode | String | Unique 8-char code for joining |
| maxMembers | Int | Default 2 (Phase 1) |
| createdAt | DateTime | Auto-generated |
| updatedAt | DateTime | Auto-updated |

### HouseholdMember
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| userId | UUID | FK → User |
| householdId | UUID | FK → Household |
| role | Enum | OWNER or MEMBER |
| joinedAt | DateTime | When user joined |

**Constraints:** Unique on (userId, householdId). userId is unique globally — a user can belong to only one household at a time.

### HouseholdInvitation
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| status | Enum | PENDING, ACCEPTED, DECLINED, CANCELLED |
| householdId | UUID | FK → Household (cascade delete) |
| senderId | UUID | FK → User (household owner who invited) |
| targetUserId | UUID | FK → User (invited user) |
| createdAt | DateTime | Auto-generated |
| respondedAt | DateTime? | When target user responded |

**Indexes:** (targetUserId, status), (householdId, status), (senderId)
**Lifecycle:** Owner invites → target accepts/declines → or owner cancels. On household delete, invitations cascade.

### Salary
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| userId | UUID | FK → User |
| householdId | UUID | FK → Household |
| defaultAmount | Decimal(12,2) | Baseline monthly salary |
| currentAmount | Decimal(12,2) | Actual salary this month |
| month | Int | 1-12 |
| year | Int | e.g., 2026 |
| createdAt | DateTime | Auto-generated |
| updatedAt | DateTime | Auto-updated |

**Constraints:** Unique on (userId, month, year). One salary record per user per month.

### Expense
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| householdId | UUID | FK → Household |
| createdById | UUID | FK → User (who created it) |
| name | String | VarChar(100) |
| amount | Decimal(12,2) | Total amount in EUR |
| type | Enum | PERSONAL or SHARED |
| category | Enum | RECURRING or ONE_TIME |
| frequency | Enum | MONTHLY or YEARLY |
| yearlyPaymentStrategy | Enum? | FULL or INSTALLMENTS (null if monthly) |
| installmentFrequency | Enum? | MONTHLY, QUARTERLY, or SEMI_ANNUAL (null if not INSTALLMENTS) |
| paymentMonth | Int? | 1-12, which month to pay in full (null if not FULL) |
| paidByUserId | UUID? | FK → User. Null = split among members |
| month | Int? | For ONE_TIME expenses: which month |
| year | Int? | For ONE_TIME expenses: which year |
| deletedAt | DateTime? | Null = active. Non-null = soft-deleted |
| createdAt | DateTime | Auto-generated |
| updatedAt | DateTime | Auto-updated |

**Notes:**
- Personal expenses: `createdById` is the owner, only they can manage it
- Shared expenses: any household member can propose changes (goes through approval)
- ONE_TIME expenses have month/year to scope them; RECURRING expenses repeat every month
- `paidByUserId = null` means split equally among household members
- `paidByUserId = <userId>` means that specific person pays the full amount
- `installmentFrequency` replaced the earlier `installmentCount` design — uses an enum for type safety

**Indexes:** (householdId, type), (createdById)

### ExpenseApproval
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| expenseId | UUID? | FK → Expense (null for CREATE actions) |
| householdId | UUID | FK → Household |
| action | Enum | CREATE, UPDATE, or DELETE |
| status | Enum | PENDING, ACCEPTED, or REJECTED |
| requestedById | UUID | FK → User (who proposed the change) |
| reviewedById | UUID? | FK → User (who reviewed) |
| message | String? | Reviewer's comment (max 500 chars) |
| proposedData | JSON? | For CREATE/UPDATE: the full proposed expense data |
| createdAt | DateTime | Auto-generated |
| reviewedAt | DateTime? | When review happened |

**Workflow:**
- CREATE: `proposedData` holds the full new expense. On accept → expense is created.
- UPDATE: `proposedData` holds the changed fields. On accept → expense is updated.
- DELETE: No `proposedData` needed. On accept → expense is soft-deleted (`deletedAt` set).

**Indexes:** (householdId, status), (requestedById)

### Settlement
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| householdId | UUID | FK → Household |
| month | Int | 1-12, month that was settled |
| year | Int | Year that was settled |
| amount | Decimal(12,2) | Net amount settled in EUR |
| paidByUserId | UUID | FK → User (who owed the money and paid) |
| paidToUserId | UUID | FK → User (who was owed and received) |
| paidAt | DateTime | When the settlement was marked as paid |

**Constraints:** Unique on (householdId, month, year). One settlement record per household per month.
**Purpose:** Audit trail for when "Mark as Settled" is used. The dashboard checks for an existing record to show `isSettled` status.

---

## Caching Strategy (Redis)

### TTL Configuration
| Data | TTL | Rationale |
|------|-----|-----------|
| User sessions (refresh tokens) | 7 days | Long-lived auth |
| Salaries | 5 minutes | Rarely changes |
| Summary/dashboard calculations | 2 minutes | Moderate freshness |
| Expense lists | 1 minute | Changes more often |
| Settlement data | 2 minutes | Moderate freshness |

**Note:** Data caching (salaries, expenses, summaries) is planned but not yet implemented. Currently only auth-related Redis keys are in use.

### Redis Key Patterns (Currently Active)
| Pattern | Purpose | TTL |
|---------|---------|-----|
| `verify:{email}` | Email verification code | 10 min |
| `reset:{token}` | Password reset token | 1 hour |
| `refresh:{token}` | Refresh token → userId | 7 days |
| `user_sessions:{userId}` | Set of user's refresh tokens | 7 days (refreshed on new token) |

### Cache Invalidation
- Cache is invalidated on any write operation for the household
- Cache keys are scoped per household to prevent data leaks
- Cache misses fall back to fresh database query

---

## Error Handling

### Global Exception Filter
A global `HttpExceptionFilter` is registered via `APP_FILTER` in `app.module.ts`. It catches **all** unhandled exceptions and returns a consistent JSON shape:

```json
{
  "statusCode": 409,
  "message": "User already belongs to a household",
  "error": "Conflict",
  "timestamp": "2026-02-01T12:00:00.000Z",
  "requestId": "abc-123-def"
}
```

For validation errors (400), `message` is an array:
```json
{
  "statusCode": 400,
  "message": ["email must be an email", "name should not be empty"],
  "error": "Bad Request",
  "timestamp": "2026-02-01T12:00:00.000Z",
  "requestId": "abc-123-def"
}
```

### Exception Categories

| Category | Detection | Status | Behavior |
|----------|-----------|--------|----------|
| **HttpException** | `instanceof HttpException` | From exception | Message + status passed through |
| **Prisma P2002** | Unique constraint violation | 409 Conflict | `"A record with this value already exists"` |
| **Prisma P2025** | Record not found | 404 Not Found | `"Record not found"` |
| **Unknown** | Everything else | 500 Internal Server Error | Logged at `error` level, generic message returned |

### Key Files
- `common/dto/error-response.dto.ts` — Swagger DTO for the error shape
- `common/dto/message-response.dto.ts` — Simple `{ message }` response DTO
- `common/filters/http-exception.filter.ts` — The filter implementation
- `common/filters/http-exception.filter.spec.ts` — 13 unit tests

### Request ID
The `requestId` is extracted from `request.id`, which is set by Pino's `genReqId` (see `common/logger/logger.module.ts`). It uses the `x-request-id` header if present, otherwise generates a UUID. This ties error responses to log entries for debugging.

---

## Project Structure

```
backend/
├── prisma/
│   ├── schema.prisma              # Data model (8 models, 9 enums)
│   └── prisma.config.ts           # Prisma configuration
├── src/
│   ├── main.ts                    # Bootstrap: Swagger, validation, CORS, API prefix
│   ├── app.module.ts              # Root module (imports all 14 modules)
│   ├── app.controller.ts          # Health check endpoint
│   │
│   ├── auth/
│   │   ├── decorators/
│   │   │   ├── api-auth.decorators.ts     # 8 composite endpoint decorators
│   │   │   └── current-user.decorator.ts  # @CurrentUser() param decorator
│   │   ├── dto/                   # 8 DTOs (register, login, verify, resend, refresh, reset, forgot, auth-response)
│   │   ├── guards/
│   │   │   └── jwt-auth.guard.ts  # Passport JWT guard
│   │   ├── strategies/
│   │   │   └── jwt.strategy.ts    # JWT validation & user extraction
│   │   ├── auth.controller.ts     # 8 endpoints
│   │   ├── auth.controller.spec.ts
│   │   ├── auth.service.ts        # Auth logic (register, verify, login, refresh, logout, password reset)
│   │   ├── auth.service.spec.ts
│   │   └── auth.module.ts
│   │
│   ├── household/
│   │   ├── decorators/
│   │   │   └── api-household.decorators.ts  # 10 composite endpoint decorators
│   │   ├── dto/                   # 7 DTOs (household-response, invitation-response, invite, join-by-code, respond, transfer, message-response)
│   │   ├── household.controller.ts          # 11 endpoints (CRUD + invitations + membership)
│   │   ├── household.controller.spec.ts
│   │   ├── household.service.ts             # CRUD + join by code + leave + remove + transfer ownership
│   │   ├── household.service.spec.ts
│   │   ├── household-invitation.service.ts  # Invite + respond + cancel + get pending
│   │   ├── household-invitation.service.spec.ts
│   │   └── household.module.ts
│   │
│   ├── user/
│   │   ├── decorators/
│   │   │   └── api-user.decorators.ts       # 3 composite endpoint decorators
│   │   ├── dto/                   # 3 DTOs (update-profile, change-password, user-profile-response)
│   │   ├── user.controller.ts     # 3 endpoints (get profile, update profile, change password)
│   │   ├── user.controller.spec.ts
│   │   ├── user.service.ts
│   │   ├── user.service.spec.ts
│   │   └── user.module.ts
│   │
│   ├── salary/
│   │   ├── decorators/
│   │   │   └── api-salary.decorators.ts     # 4 composite endpoint decorators
│   │   ├── dto/                   # 2 DTOs (upsert-salary, salary-response)
│   │   ├── salary.controller.ts   # 4 endpoints (get my, upsert my, household, household by month)
│   │   ├── salary.controller.spec.ts
│   │   ├── salary.service.ts
│   │   ├── salary.service.spec.ts
│   │   └── salary.module.ts
│   │
│   ├── personal-expense/
│   │   ├── decorators/
│   │   │   └── api-personal-expense.decorators.ts  # 5 composite endpoint decorators
│   │   ├── dto/                   # 4 DTOs (create, update, list-query, response)
│   │   ├── personal-expense.controller.ts   # 5 endpoints (list, create, get, update, delete)
│   │   ├── personal-expense.controller.spec.ts
│   │   ├── personal-expense.service.ts
│   │   ├── personal-expense.service.spec.ts
│   │   └── personal-expense.module.ts
│   │
│   ├── shared-expense/
│   │   ├── decorators/
│   │   │   └── api-shared-expense.decorators.ts    # 5 composite endpoint decorators
│   │   ├── dto/                   # 4 DTOs (create, update, list-query, response)
│   │   ├── shared-expense.controller.ts     # 5 endpoints (list, get, propose create/update/delete)
│   │   ├── shared-expense.controller.spec.ts
│   │   ├── shared-expense.service.ts
│   │   ├── shared-expense.service.spec.ts
│   │   └── shared-expense.module.ts
│   │
│   ├── approval/
│   │   ├── decorators/
│   │   │   └── api-approval.decorators.ts   # 4 composite endpoint decorators
│   │   ├── dto/                   # 4 DTOs (accept, reject, list-query, response)
│   │   ├── approval.controller.ts # 4 endpoints (list pending, history, accept, reject)
│   │   ├── approval.controller.spec.ts
│   │   ├── approval.service.ts    # Approval review logic (accept with transaction, reject)
│   │   ├── approval.service.spec.ts
│   │   └── approval.module.ts
│   │
│   ├── dashboard/
│   │   ├── decorators/
│   │   │   └── api-dashboard.decorators.ts  # 4 composite endpoint decorators
│   │   ├── dto/                   # 6 DTOs (dashboard-response, expense-summary, member-income, member-savings, settlement-response, mark-settlement-paid-response)
│   │   ├── dashboard.controller.ts # 4 endpoints (overview, savings, settlement, mark-paid)
│   │   ├── dashboard.controller.spec.ts
│   │   ├── dashboard.service.ts   # Financial aggregation, settlement calc, mark-paid
│   │   ├── dashboard.service.spec.ts
│   │   └── dashboard.module.ts
│   │
│   ├── session/
│   │   ├── session.service.ts     # Redis session operations (store, get, remove, invalidate all)
│   │   ├── session.service.spec.ts
│   │   └── session.module.ts
│   │
│   ├── mail/
│   │   ├── mail.service.ts        # 5 email methods (placeholder — logs in dev)
│   │   └── mail.module.ts         # Global module
│   │
│   ├── prisma/
│   │   ├── prisma.service.ts      # Extended PrismaClient with @prisma/adapter-pg
│   │   └── prisma.module.ts
│   │
│   ├── redis/
│   │   ├── redis.module.ts        # Global module (ioredis)
│   │   └── throttler-redis.storage.ts  # Custom NestJS throttler with Redis backend
│   │
│   ├── common/
│   │   ├── dto/
│   │   │   ├── error-response.dto.ts        # Shared ErrorResponseDto (Swagger schema for all errors)
│   │   │   └── message-response.dto.ts      # Simple { message } response DTO
│   │   ├── expense/
│   │   │   ├── expense-helper.module.ts     # Shared expense utility module
│   │   │   ├── expense-helper.service.ts    # requireMembership, findExpenseOrFail, validatePaidByUserId, checkNoPendingApproval
│   │   │   ├── expense-helper.service.spec.ts
│   │   │   └── expense.mappers.ts           # Prisma → DTO mappers (personal, shared, approval responses)
│   │   ├── filters/
│   │   │   ├── http-exception.filter.ts       # Global catch-all exception filter
│   │   │   └── http-exception.filter.spec.ts  # 13 unit tests
│   │   ├── logger/
│   │   │   └── logger.module.ts   # Pino logger with request logging + sensitive data redaction
│   │   └── utils/
│   │       └── pick-defined.ts    # Helper to filter undefined values from objects (for partial updates)
│   │
│   └── generated/                 # Auto-generated Prisma client + DTOs (DO NOT EDIT)
│
├── vitest.config.ts               # Vitest configuration
└── package.json
```

---

## Docker & Containerization

### Services in docker-compose.yml
| Service | Image | Port |
|---------|-------|------|
| PostgreSQL 18.1 | postgres:18-alpine | 5432 |
| Redis 7.2 | redis:7-alpine | 6379 |
| Backend (NestJS 11) | node:24-alpine | 3000 |
| Frontend (React 19 + Vite 7) | node:24-alpine → nginx (prod) | 5173 dev / 3001 prod |

---

## CI/CD with GitHub Actions

### Workflows
1. **test.yml** — Lint, format, type-check, unit/integration tests on every PR
2. **docker-build.yml** — Build and push Docker images
3. **database-migration.yml** — Validate Prisma migrations
4. **deploy.yml** — Deploy to staging (future)
5. **code-quality.yml** — Security scanning, dependency checks

---

## Testing Strategy

### Current Test Files
| File | Coverage |
|------|----------|
| `auth.service.spec.ts` | Register, verify, login, refresh, logout, forgot/reset password |
| `auth.controller.spec.ts` | All 8 auth endpoints |
| `auth-dto.spec.ts` | DTO validation for auth DTOs |
| `household.service.spec.ts` | Create, get, regenerate code, join by code, leave, remove, transfer |
| `household.controller.spec.ts` | All 11 household endpoints |
| `household-invitation.service.spec.ts` | Invite, respond (accept/decline), cancel, get pending |
| `household-dto.spec.ts` | DTO validation for household DTOs |
| `user.service.spec.ts` | Get profile, update profile, change password |
| `user.controller.spec.ts` | All 3 user endpoints |
| `user-dto.spec.ts` | DTO validation for user DTOs |
| `session.service.spec.ts` | Store, get, remove, invalidate all sessions |
| `salary.service.spec.ts` | Get my, upsert, household salaries, by month |
| `salary.controller.spec.ts` | All 4 salary endpoints |
| `upsert-salary.dto.spec.ts` | DTO validation for salary upsert |
| `personal-expense.service.spec.ts` | List, create, get, update, delete personal expenses |
| `personal-expense.controller.spec.ts` | All 5 personal expense endpoints |
| `create-personal-expense.dto.spec.ts` | DTO validation with conditional fields |
| `update-personal-expense.dto.spec.ts` | DTO validation for partial updates |
| `list-personal-expenses-query.dto.spec.ts` | Query filter validation |
| `shared-expense.service.spec.ts` | List, get, propose create/update/delete |
| `shared-expense.controller.spec.ts` | All 5 shared expense endpoints |
| `create-shared-expense.dto.spec.ts` | DTO validation with paidByUserId |
| `update-shared-expense.dto.spec.ts` | DTO validation for shared expense updates |
| `list-shared-expenses-query.dto.spec.ts` | Query filter validation |
| `approval.service.spec.ts` | List pending, history, accept (with transaction), reject |
| `approval.controller.spec.ts` | All 4 approval endpoints |
| `accept-approval.dto.spec.ts` | Optional message validation |
| `reject-approval.dto.spec.ts` | Required message validation |
| `list-approvals-query.dto.spec.ts` | Status filter validation |
| `dashboard.service.spec.ts` | Overview, savings, settlement calc, mark-paid |
| `dashboard.controller.spec.ts` | All 4 dashboard endpoints |
| `expense-helper.service.spec.ts` | requireMembership, findExpenseOrFail, validatePaidByUserId, checkNoPendingApproval |
| `http-exception.filter.spec.ts` | HttpException, validation arrays, Prisma P2002/P2025, unknown errors, metadata |

### Test Framework
- **Runner:** Vitest with `@nestjs/testing`
- **Mocking:** `vi.fn()` for all dependencies
- **Pattern:** AAA (Arrange-Act-Assert)
- **Naming:** `should [expected behavior] when [condition]`

### Test Cases Per Method
1. Happy path — successful operation
2. Validation failures — invalid input
3. Not found — resource doesn't exist
4. Unauthorized/Forbidden — wrong role or permissions
5. Security — enumeration prevention, race conditions
6. Boundary values — edge of valid ranges
7. Error message assertions — exact message string verification

### Coverage Targets
| Area | Target |
|------|--------|
| Backend overall | >80% |
| Frontend overall | >75% |
| Critical paths (auth, household, approvals, settlement) | 100% |

---

## Performance Targets

### Frontend
| Metric | Target |
|--------|--------|
| Lighthouse Score | >90 |
| First Contentful Paint | <1.5s |
| Largest Contentful Paint | <2.5s |
| Time to Interactive | <2s |
| Bundle Size (gzipped) | <250KB |

### Backend
| Metric | Target |
|--------|--------|
| API response (cached) | <50ms |
| API response (uncached) | <200ms |
| Database query time | <100ms |
| 99th percentile latency | <500ms |

### Database
- Connection pooling: 20-30 connections
- Indexes on: userId, householdId, (userId + month + year), (householdId + type), (householdId + status), (targetUserId + status), createdById, requestedById

---

## Environment Variables

```env
# App
NODE_ENV=development
PORT=3000
API_PREFIX=api/v1
CORS_ORIGIN=http://localhost:5173

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=sharedbudget
DB_USER=sharedbudget
DB_PASSWORD=<password>
DATABASE_URL=postgresql://<user>:<password>@<host>:<port>/<name>

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=<password>

# JWT
JWT_ACCESS_SECRET=<strong-secret-32-chars>
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_SECRET=<different-strong-secret-32-chars>
JWT_REFRESH_EXPIRATION=7d

# Auth TTLs (seconds)
AUTH_VERIFICATION_CODE_TTL=600       # 10 minutes
AUTH_REFRESH_TOKEN_TTL=604800        # 7 days
AUTH_RESET_TOKEN_TTL=3600            # 1 hour

# Argon2
ARGON2_MEMORY_COST=65536
ARGON2_TIME_COST=3
ARGON2_PARALLELISM=1

# Household
HOUSEHOLD_MAX_MEMBERS=2
INVITE_CODE_LENGTH=8

# Cache TTLs (seconds) — for future use
CACHE_TTL_USER_SESSION=604800
CACHE_TTL_SALARIES=300
CACHE_TTL_SUMMARY=120
CACHE_TTL_EXPENSES=60
CACHE_TTL_SETTLEMENT=120
```

---

## Development Phases

### Phase 1: Core MVP

#### ✅ Implemented
- User registration with email verification (6-digit code)
- JWT authentication with refresh token rotation
- Session management (store, retrieve, invalidate refresh tokens in Redis)
- Password reset flow (forgot → email → reset)
- User profile management (view, update name, change password)
- Household creation with invite code
- Join household by code (instant)
- Email-based household invitations (invite → accept/decline → cancel)
- Leave household / remove member / transfer ownership
- Role-based access (OWNER vs MEMBER)
- Salary management (upsert per user per month, household view)
- Personal expense CRUD (create, list, get, update, soft-delete with query filters)
- Shared expense proposals (propose create/update/delete → creates approval)
- Expense approval workflow (list pending, history, accept with transaction, reject)
- Settlement calculation (who owes whom, context-aware messages)
- Mark settlement as paid (audit trail with duplicate prevention)
- Financial dashboard (income, expenses, savings, settlement, pending approvals)
- Shared expense helper utilities (membership validation, expense lookup, mapper functions)
- Rate limiting with Redis-backed throttler
- Structured logging with Pino (sensitive data redaction)
- Swagger/OpenAPI documentation
- Global exception filter (consistent error shape with `timestamp` + `requestId`)
- Comprehensive unit tests (33 spec files covering all services, controllers, and DTOs)
- Mail service placeholder (logs in dev)

#### 🔲 Remaining (Phase 1)
- Redis data caching (salaries, expenses, summaries, settlements)
- Frontend (React 19 + Vite 7)
- Docker setup for all services
- CI/CD with GitHub Actions

### Phase 2: Multi-Member Households (Future)
- Support N members per household
- Custom split ratios (proportional to income)
- Extended role-based permissions (admin, member, viewer)
- Expense categories and tags
- Monthly/yearly reports and charts
- Export to CSV/PDF
- Push notifications for approvals
- Multi-household support
- Real email provider integration (Resend, SendGrid)

---

*Extracted from SPEC.md v2.0 on January 29, 2026. Updated February 4, 2026.*
