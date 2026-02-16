# Household Budget Tracker — Architecture & Technical Reference

**Updated:** February 14, 2026

> **Related docs:**
> - `PROJECT_INDEX.md` — Project overview, API endpoints, structure, commands
> - `SPEC.md` — Business requirements, user stories, feature specs
> - `CLAUDE.md` — Development process rules for Claude Code
> - `docs/FRONTEND_ARCHITECTURE.md` — Frontend architecture deep-dive (15 sections)
> - `docs/backend/01-08` — Backend architecture deep-dive (8 documents)

---

## Technology Stack

### Frontend
| Technology       | Version  | Purpose                                                 |
|------------------|----------|---------------------------------------------------------|
| Angular          | 21.1.x   | UI framework (standalone components, signals, zoneless) |
| Angular CLI      | 21.1.x   | Build tool + dev server with HMR                        |
| TypeScript       | 5.9.x    | Language (strict mode)                                  |
| Angular Material | 21.1.x   | UI component library (Material Design 3)                |
| Angular CDK      | 21.1.x   | Component Dev Kit (layout, a11y, overlays)              |
| HttpClient       | built-in | HTTP client with JWT interceptors                       |
| Reactive Forms   | built-in | Form handling with validation                           |
| Vitest           | 4.x      | Unit testing framework (Angular 21 default)             |
| date-fns         | 4.x      | Date utilities                                          |
| chart.js         | 4.5.x    | Charts (bar, line)                                      |

### Backend
| Technology        | Version     | Purpose                             |
|-------------------|-------------|-------------------------------------|
| Node.js           | 24.13.0 LTS | Runtime                             |
| NestJS            | 11.1.x      | Framework                           |
| TypeScript        | 5.7.x       | Language (strict mode)              |
| Prisma            | 7.3.0       | ORM (Rust-free, @prisma/adapter-pg) |
| @nestjs/swagger   | 11.2.5      | API documentation                   |
| @nestjs/throttler | 6.5.0       | Rate limiting (Redis-backed)        |
| class-validator   | 0.14.3      | Input validation                    |
| class-transformer | 0.5.1       | DTO transformation                  |
| ioredis           | 5.9.2       | Redis client                        |
| @nestjs/jwt       | 11.0.2      | JWT authentication                  |
| @nestjs/passport  | 11.0.5      | Auth strategies                     |
| passport-jwt      | 4.0.1       | JWT strategy                        |
| argon2            | 0.44.0      | Password hashing                    |
| nestjs-pino       | 4.5.0       | Structured logging                  |
| pino              | 10.3.0      | Logger                              |
| vitest            | 4.0.18      | Testing framework                   |

### Database
| Technology | Version | Purpose                                   |
|------------|---------|-------------------------------------------|
| PostgreSQL | 18.1    | Primary database                          |
| Prisma     | 7.3.0   | ORM + migrations (via @prisma/adapter-pg) |
| Redis      | 7.2.x   | Session storage + rate limiting + caching |

---

## Data Model (Prisma Schema)

**11 models, 10 enums**

### Enums
| Enum                  | Values                                 | Purpose                                                  |
|-----------------------|----------------------------------------|----------------------------------------------------------|
| HouseholdRole         | OWNER, MEMBER                          | Member role in household                                 |
| ExpenseType           | PERSONAL, SHARED                       | Expense ownership type                                   |
| ExpenseCategory       | RECURRING, ONE_TIME                    | Expense recurrence                                       |
| ExpenseFrequency      | MONTHLY, YEARLY                        | Payment frequency                                        |
| YearlyPaymentStrategy | FULL, INSTALLMENTS                     | How yearly expenses are paid                             |
| InstallmentFrequency  | MONTHLY, QUARTERLY, SEMI_ANNUAL        | Installment payment schedule (12, 4, or 2 payments/year) |
| ApprovalAction        | CREATE, UPDATE, DELETE                 | Type of proposed change                                  |
| ApprovalStatus        | PENDING, ACCEPTED, REJECTED, CANCELLED | Approval lifecycle state                                 |
| InvitationStatus      | PENDING, ACCEPTED, DECLINED, CANCELLED | Invitation lifecycle state                               |
| PaymentStatus         | PENDING, PAID, CANCELLED               | Expense payment tracking                                 |

### User
| Field         | Type      | Notes                                          |
|---------------|-----------|------------------------------------------------|
| id            | UUID      | Primary key                                    |
| email         | String    | Unique, used for login                         |
| password      | String    | Argon2id hashed                                |
| firstName     | String    | Display name                                   |
| lastName      | String    | Display name                                   |
| emailVerified | Boolean   | Default `false`, set `true` after verification |
| createdAt     | DateTime  | Auto-generated                                 |
| updatedAt     | DateTime  | Auto-updated                                   |
| deletedAt     | DateTime? | Null = active. Non-null = soft-deleted         |

### Household
| Field      | Type     | Notes                          |
|------------|----------|--------------------------------|
| id         | UUID     | Primary key                    |
| name       | String   | e.g., "The Smiths"             |
| inviteCode | String   | Unique 8-char code for joining |
| maxMembers | Int      | Default 2 (Phase 1)            |
| createdAt  | DateTime | Auto-generated                 |
| updatedAt  | DateTime | Auto-updated                   |

### HouseholdMember
| Field       | Type     | Notes            |
|-------------|----------|------------------|
| id          | UUID     | Primary key      |
| userId      | UUID     | FK → User        |
| householdId | UUID     | FK → Household   |
| role        | Enum     | OWNER or MEMBER  |
| joinedAt    | DateTime | When user joined |

**Constraints:** Unique on (userId, householdId). userId is unique globally — a user can belong to only one household at a time.

### HouseholdInvitation
| Field        | Type      | Notes                                   |
|--------------|-----------|-----------------------------------------|
| id           | UUID      | Primary key                             |
| status       | Enum      | PENDING, ACCEPTED, DECLINED, CANCELLED  |
| householdId  | UUID      | FK → Household (cascade delete)         |
| senderId     | UUID      | FK → User (household owner who invited) |
| targetUserId | UUID      | FK → User (invited user)                |
| createdAt    | DateTime  | Auto-generated                          |
| respondedAt  | DateTime? | When target user responded              |

**Indexes:** (targetUserId, status), (householdId, status), (senderId)

### Salary
| Field         | Type          | Notes                    |
|---------------|---------------|--------------------------|
| id            | UUID          | Primary key              |
| userId        | UUID          | FK → User                |
| householdId   | UUID          | FK → Household           |
| defaultAmount | Decimal(12,2) | Baseline monthly salary  |
| currentAmount | Decimal(12,2) | Actual salary this month |
| month         | Int           | 1-12                     |
| year          | Int           | e.g., 2026               |
| createdAt     | DateTime      | Auto-generated           |
| updatedAt     | DateTime      | Auto-updated             |

**Constraints:** Unique on (userId, month, year). One salary record per user per month.

### Expense
| Field                 | Type          | Notes                                                         |
|-----------------------|---------------|---------------------------------------------------------------|
| id                    | UUID          | Primary key                                                   |
| householdId           | UUID          | FK → Household                                                |
| createdById           | UUID          | FK → User (who created it)                                    |
| name                  | String        | VarChar(100)                                                  |
| amount                | Decimal(12,2) | Total amount in EUR                                           |
| type                  | Enum          | PERSONAL or SHARED                                            |
| category              | Enum          | RECURRING or ONE_TIME                                         |
| frequency             | Enum          | MONTHLY or YEARLY                                             |
| yearlyPaymentStrategy | Enum?         | FULL or INSTALLMENTS (null if monthly)                        |
| installmentFrequency  | Enum?         | MONTHLY, QUARTERLY, or SEMI_ANNUAL (null if not INSTALLMENTS) |
| installmentCount      | Int?          | Number of installment payments (for ONE_TIME INSTALLMENTS)    |
| paymentMonth          | Int?          | 1-12, which month to pay in full (null if not FULL)           |
| paidByUserId          | UUID?         | FK → User. Null = split among members                         |
| month                 | Int?          | For ONE_TIME expenses: which month                            |
| year                  | Int?          | For ONE_TIME expenses: which year                             |
| deletedAt             | DateTime?     | Null = active. Non-null = soft-deleted                        |
| createdAt             | DateTime      | Auto-generated                                                |
| updatedAt             | DateTime      | Auto-updated                                                  |

**Notes:**
- Personal expenses: `createdById` is the owner, only they can manage it
- Shared expenses: any household member can propose changes (goes through approval)
- ONE_TIME expenses have month/year to scope them; RECURRING expenses repeat every month
- `paidByUserId = null` means split equally among household members
- `paidByUserId = <userId>` means that specific person pays the full amount

**Indexes:** (householdId, type), (createdById)

### ExpenseApproval
| Field         | Type      | Notes                                             |
|---------------|-----------|---------------------------------------------------|
| id            | UUID      | Primary key                                       |
| expenseId     | UUID?     | FK → Expense (null for CREATE actions)            |
| householdId   | UUID      | FK → Household                                    |
| action        | Enum      | CREATE, UPDATE, or DELETE                         |
| status        | Enum      | PENDING, ACCEPTED, REJECTED, or CANCELLED         |
| requestedById | UUID      | FK → User (who proposed the change)               |
| reviewedById  | UUID?     | FK → User (who reviewed)                          |
| message       | String?   | Reviewer's comment (max 500 chars)                |
| proposedData  | JSON?     | For CREATE/UPDATE: the full proposed expense data |
| createdAt     | DateTime  | Auto-generated                                    |
| reviewedAt    | DateTime? | When review happened                              |

**Workflow:**
- CREATE: `proposedData` holds the full new expense. On accept → expense is created.
- UPDATE: `proposedData` holds the changed fields. On accept → expense is updated.
- DELETE: No `proposedData` needed. On accept → expense is soft-deleted (`deletedAt` set).
- CANCEL: Original requester can cancel own pending approval.

**Indexes:** (householdId, status), (requestedById)

### Settlement
| Field        | Type          | Notes                                   |
|--------------|---------------|-----------------------------------------|
| id           | UUID          | Primary key                             |
| householdId  | UUID          | FK → Household                          |
| month        | Int           | 1-12, month that was settled            |
| year         | Int           | Year that was settled                   |
| amount       | Decimal(12,2) | Net amount settled in EUR               |
| paidByUserId | UUID          | FK → User (who owed the money and paid) |
| paidToUserId | UUID          | FK → User (who was owed and received)   |
| paidAt       | DateTime      | When the settlement was marked as paid  |

**Constraints:** Unique on (householdId, month, year). One settlement record per household per month.

#### Phase 1 Constraints

The current Settlement model is designed for **exactly 2 members** per household:
- Direct foreign keys `paidByUserId` and `paidToUserId` represent a one-to-one payment flow
- Each settlement record encodes a single debt direction (payer → payee)
- Works well for households with 2 people but becomes problematic with 4+ members

**Phase 2 (Multi-Party Settlements)** would require:
- A **multi-party debt graph model** that can represent complex settlement scenarios (e.g., one person paying multiple creditors in a single settlement)
- Possibly a join table `SettlementParticipant(settlementId, userId, role: 'payer'|'receiver', amount)` to track variable-member payoff chains
- Alternative: Explicit `SettlementFlow` records for each debt edge in the graph

**Dashboard Impact:**
- Current aggregation queries assume 2 members and would fail or produce incorrect totals with 4+ members
- `getPendingApprovalsCount`, settlement history summaries, and expense breakdowns are currently written for binary households
- Refactoring would require parameterized queries that dynamically handle variable member counts


### ExpensePaymentStatus
| Field     | Type          | Notes                                    |
|-----------|---------------|------------------------------------------|
| id        | UUID          | Primary key                              |
| expenseId | UUID          | FK → Expense                             |
| month     | Int           | 1-12                                     |
| year      | Int           | e.g., 2026                               |
| status    | Enum          | PENDING, PAID, or CANCELLED              |
| paidById  | UUID?         | FK → User (who marked it paid)           |
| paidAt    | DateTime?     | When marked as paid                      |

**Constraints:** Unique on (expenseId, month, year).

### RecurringOverride
| Field     | Type          | Notes                                    |
|-----------|---------------|------------------------------------------|
| id        | UUID          | Primary key                              |
| expenseId | UUID          | FK → Expense                             |
| month     | Int           | 1-12                                     |
| year      | Int           | e.g., 2026                               |
| amount    | Decimal(12,2) | Overridden amount for this month         |
| skipped   | Boolean       | If true, expense is skipped this month   |

**Constraints:** Unique on (expenseId, month, year).

### Saving
| Field    | Type          | Notes                                    |
|----------|---------------|------------------------------------------|
| id       | UUID          | Primary key                              |
| userId   | UUID          | FK → User                                |
| amount   | Decimal(12,2) | Savings amount                           |
| month    | Int           | 1-12                                     |
| year     | Int           | e.g., 2026                               |
| isShared | Boolean       | true = shared savings, false = personal  |

**Constraints:** Unique on (userId, month, year, isShared).

### Data Model Relationships
```
User ──1:1──→ HouseholdMember ──N:1──→ Household
  │                                       │
  ├──1:N──→ Salary ─────────────N:1──────┘
  ├──1:N──→ Saving ─────────────N:1──────┘
  ├──1:N──→ Expense (creator) ──N:1──────┘
  │            │
  │            ├──1:N──→ ExpenseApproval ──N:1──→ Household
  │            │            ├── requestedBy → User
  │            │            └── reviewedBy → User (nullable)
  │            ├──1:N──→ ExpensePaymentStatus
  │            │            └── paidBy → User
  │            └──1:N──→ RecurringOverride
  │
  ├──1:N──→ HouseholdInvitation (sender)
  ├──1:N──→ HouseholdInvitation (target)
  ├──1:N──→ Settlement (paidBy)
  └──1:N──→ Settlement (paidTo)
```

---

## Authentication Chain (Full Stack)

```
┌──────────────────────────────────────────────────────┐
│ FRONTEND                                              │
│                                                       │
│ 1. Login → AuthService.login(email, password)         │
│ 2. AuthService → POST /auth/login                     │
│ 3. Response → handleAuthResponse():                   │
│    - Access token → in-memory (TokenService)          │
│    - Refresh token → localStorage                     │
│ 4. loadCurrentUser() → GET /users/me                  │
│    - currentUser signal updated                       │
│                                                       │
│ SUBSEQUENT REQUESTS:                                  │
│ 5. AuthInterceptor attaches Bearer token              │
│ 6. On 401 → AuthInterceptor refreshes automatically   │
│    - Concurrent 401s queued (BehaviorSubject)         │
│ 7. Refresh fails → clearAuth() → redirect to login   │
└──────────────────────────────┬────────────────────────┘
                               │
┌──────────────────────────────▼────────────────────────┐
│ BACKEND                                               │
│                                                       │
│ 1. JwtAuthGuard (on protected endpoints)              │
│ 2. Extract token from "Authorization: Bearer {token}" │
│ 3. JwtStrategy.validate():                            │
│    - Verify signature (JWT_ACCESS_SECRET)             │
│    - Check expiration (15 min)                        │
│    - Return { id, email } → req.user                  │
│ 4. Controller reads req.user.id (@CurrentUser)        │
│                                                       │
│ TOKEN GENERATION (AuthService.generateTokens):        │
│ - Access: JWT { sub: userId, email } signed HS256     │
│ - Refresh: 32-byte random hex → Redis                 │
│   Key: refresh:{token} → userId (TTL: 7 days)        │
│   Set: user_sessions:{userId} → [tokens] (TTL: 7d)   │
│                                                       │
│ SESSION INVALIDATION (password change/reset):         │
│ - SessionService.invalidateAllSessions(userId)        │
│ - Deletes ALL refresh:{token} keys for user           │
│ - Forces re-auth on every device                      │
└───────────────────────────────────────────────────────┘
```

### Frontend Bootstrap & Initialization

**Provider chain** (in `app.config.ts`):
1. `provideZonelessChangeDetection()` — No NgZone, signals drive change detection
2. `provideRouter(routes, withComponentInputBinding())` — Route params auto-bind to `@Input()`
3. `provideHttpClient(withInterceptors([authInterceptor]))` — Global auth token injection
4. `provideAnimationsAsync()` — Material animations (non-blocking)
5. `{ provide: ErrorHandler, useClass: GlobalErrorHandler }` — Snackbar error display
6. `provideAppInitializer(initializeAuth)` — Session restoration before first render

**Initialization flow:**
1. App boots → `initializeAuth()` runs before rendering
2. If refresh token exists in localStorage → call `/auth/refresh` → get new access token → load user profile
3. If no token → skip (user not logged in)
4. Auth interceptor ready for subsequent requests

**Token persistence:**
- Access token: in-memory only (lost on reload, restored via refresh)
- Refresh token: localStorage key `sb_refresh_token` (7-day TTL server-side)

---

## Caching Strategy (Redis)

### TTL Configuration
| Data                           | TTL       | Rationale          |
|--------------------------------|-----------|--------------------|
| User sessions (refresh tokens) | 7 days    | Long-lived auth    |
| Salaries                       | 5 minutes | Rarely changes     |
| Summary/dashboard calculations | 2 minutes | Moderate freshness |
| Expense lists                  | 1 minute  | Changes more often |
| Settlement data                | 2 minutes | Moderate freshness |
| Approvals                      | 2 minutes | Moderate freshness |

### Redis Key Patterns
| Pattern                                         | Purpose                      | TTL                             |
|-------------------------------------------------|------------------------------|---------------------------------|
| `verify:{email}`                                | Email verification code      | 10 min                          |
| `reset:{token}`                                 | Password reset token         | 1 hour                          |
| `refresh:{token}`                               | Refresh token → userId       | 7 days                          |
| `user_sessions:{userId}`                        | Set of user's refresh tokens | 7 days (refreshed on new token) |
| `cache:dashboard:{householdId}:*`               | Dashboard overview/savings   | 120s                            |
| `cache:approvals:pending:{householdId}`         | Pending approvals list       | 120s                            |
| `cache:approvals:history:{householdId}:*`       | Approval history             | 120s                            |
| `cache:salaries:{householdId}:*`                | Household salaries           | 300s                            |
| `cache:personal-expenses:{userId}:*`            | Personal expense lists       | 60s                             |
| `cache:shared-expenses:{householdId}:*`         | Shared expense lists         | 60s                             |

### Cache Invalidation
- `CacheService.invalidateHousehold(householdId)` — Nuclear: clears ALL caches for a household
- Granular methods: `invalidateSalaries()`, `invalidatePersonalExpenses()`, `invalidateSharedExpenses()`, `invalidateDashboard()`, `invalidateApprovals()`, `invalidateSavings()`
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

| Category          | Detection                   | Status                    | Behavior                                          |
|-------------------|-----------------------------|---------------------------|---------------------------------------------------|
| **HttpException** | `instanceof HttpException`  | From exception            | Message + status passed through                   |
| **Prisma P2002**  | Unique constraint violation | 409 Conflict              | `"A record with this value already exists"`       |
| **Prisma P2025**  | Record not found            | 404 Not Found             | `"Record not found"`                              |
| **Unknown**       | Everything else             | 500 Internal Server Error | Logged at `error` level, generic message returned |

### Request ID
The `requestId` is extracted from `request.id`, which is set by Pino's `genReqId` (see `common/logger/logger.module.ts`). It uses the `x-request-id` header if present, otherwise generates a UUID.

---

## Docker & Containerization

### Services in docker-compose.yml
| Service               | Image                         | Port                 |
|-----------------------|-------------------------------|----------------------|
| PostgreSQL 18.1       | postgres:18-alpine            | 5432                 |
| Redis 7.2             | redis:7-alpine                | 6379                 |
| Backend (NestJS 11)   | node:24-alpine                | 3000                 |
| Frontend (Angular 21) | node:24-alpine → nginx (prod) | 4200 dev / 3001 prod |

---

## Performance Targets

### Frontend
| Metric                   | Target |
|--------------------------|--------|
| Lighthouse Score         | >90    |
| First Contentful Paint   | <1.5s  |
| Largest Contentful Paint | <2.5s  |
| Time to Interactive      | <2s    |
| Bundle Size (gzipped)    | <250KB |

### Backend
| Metric                  | Target |
|-------------------------|--------|
| API response (cached)   | <50ms  |
| API response (uncached) | <200ms |
| Database query time     | <100ms |
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
CORS_ORIGIN=http://localhost:4200

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

# Cache TTLs (seconds)
CACHE_TTL_USER_SESSION=604800
CACHE_TTL_SALARIES=300
CACHE_TTL_SUMMARY=120
CACHE_TTL_EXPENSES=60
CACHE_TTL_SETTLEMENT=120
```
