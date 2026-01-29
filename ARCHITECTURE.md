# Household Budget Tracker — Architecture & Technical Reference

**Document Version:** 1.0
**Created:** January 29, 2026 (Extracted from SPEC.md v2.0)

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
| Prisma | 7.2.x | ORM (Rust-free, TypeScript rewrite) |
| @nestjs/swagger | latest | API documentation |
| class-validator | latest | Input validation |
| class-transformer | latest | DTO transformation |
| ioredis | 5.x | Redis client |
| @nestjs/jwt | latest | JWT authentication |
| @nestjs/passport | latest | Auth strategies |
| argon2 | latest | Password hashing |
| vitest | latest | Testing framework |

### Database
| Technology | Version | Purpose |
|-----------|---------|---------|
| PostgreSQL | 18.1 | Primary database |
| Prisma | 7.2.x | ORM + migrations |
| Redis | 7.2.x | Caching + session storage |

---

## Data Model (Prisma Schema)

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

**Constraints:** Unique on (userId, householdId). A user can belong to only one household.

### Salary
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| userId | UUID | FK → User |
| householdId | UUID | FK → Household |
| defaultAmount | Decimal | Baseline monthly salary |
| currentAmount | Decimal | Actual salary this month |
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
| name | String | Max 100 chars |
| amount | Decimal | Total amount in EUR |
| type | Enum | PERSONAL or SHARED |
| category | Enum | RECURRING or ONE_TIME |
| frequency | Enum | MONTHLY or YEARLY |
| yearlyPaymentStrategy | Enum? | FULL or INSTALLMENTS (null if monthly) |
| installmentCount | Int? | 1, 2, 4, or 12 (null if monthly or FULL) |
| paymentMonth | Int? | 1-12, which month to pay in full (null if not FULL) |
| paidByUserId | UUID? | FK → User. Null = split among members |
| deletedAt | DateTime? | Null = active. Non-null = soft-deleted |
| month | Int? | For ONE_TIME expenses: which month |
| year | Int? | For ONE_TIME expenses: which year |
| createdAt | DateTime | Auto-generated |
| updatedAt | DateTime | Auto-updated |

**Notes:**
- Personal expenses: `createdById` is the owner, only they can manage it
- Shared expenses: any household member can propose changes (goes through approval)
- ONE_TIME expenses have month/year to scope them; RECURRING expenses repeat every month
- `paidByUserId = null` means split equally among household members
- `paidByUserId = <userId>` means that specific person pays the full amount

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
| message | String? | Reviewer's comment |
| proposedData | JSON? | For CREATE/UPDATE: the full proposed expense data |
| createdAt | DateTime | Auto-generated |
| reviewedAt | DateTime? | When review happened |

**Workflow:**
- CREATE: `proposedData` holds the full new expense. On accept → expense is created.
- UPDATE: `proposedData` holds the changed fields. On accept → expense is updated.
- DELETE: No `proposedData` needed. On accept → expense is soft-deleted (`deletedAt` set).

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

### Redis Key Patterns
| Pattern | Purpose | TTL |
|---------|---------|-----|
| `verify:{email}` | Email verification code | 10 min |
| `reset:{token}` | Password reset token | 1 hour |
| `refresh:{token}` | Refresh token → userId | 7 days |
| `user_sessions:{userId}` | Set of user's refresh tokens | No TTL |

### Cache Invalidation
- Cache is invalidated on any write operation for the household
- Cache keys are scoped per household to prevent data leaks
- Cache misses fall back to fresh database query

---

## Project Structure

```
backend/src/
├── auth/
│   ├── decorators/     # Custom decorators (endpoint, param)
│   ├── dto/            # Request/Response DTOs
│   ├── guards/         # Auth guards (JWT, etc.)
│   ├── strategies/     # Passport strategies (JWT, local)
│   ├── auth.controller.ts
│   ├── auth.controller.spec.ts
│   ├── auth.service.ts
│   ├── auth.service.spec.ts
│   └── auth.module.ts
├── mail/               # Email sending service
├── prisma/             # Prisma service + schema
├── redis/              # Redis module + service
└── common/
    └── logger/         # Pino logger configuration
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

### Unit Tests
- Backend: Auth logic, expense calculations, salary validation, settlement logic, approval workflow
- Frontend: Component rendering, form validation, currency formatting, auth context

### Integration Tests
- API endpoints with real PostgreSQL database
- Auth flow: register → login → refresh → access protected endpoint
- Approval workflow: propose → accept/reject → verify expense state
- Redis cache invalidation
- Multi-expense settlement calculations

### Coverage Targets
| Area | Target |
|------|--------|
| Backend overall | >80% |
| Frontend overall | >75% |
| Critical paths (auth, approvals, settlement) | 100% |

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
- Indexes on: userId, householdId, (userId + month + year), (householdId + type), (householdId + status)

---

## Environment Variables

```env
# Auth
AUTH_VERIFICATION_CODE_TTL=600
AUTH_REFRESH_TOKEN_TTL=604800
AUTH_RESET_TOKEN_TTL=3600

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/sharedbudget

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your-secret-key
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
```

---

## Development Phases

### Phase 1: Core MVP (Current Focus)
- Max 2 users per household (couple)
- User registration + login with JWT
- Household create/join with invite code
- Personal + shared expenses with full CRUD
- Approval workflow for shared expenses
- Monthly + yearly expense support with payment options
- Settlement calculation (50/50 or assigned)
- Financial dashboard with savings overview
- Redis caching
- Docker setup for all services

### Phase 2: Multi-Member Households (Future)
- Support N members per household
- Custom split ratios (proportional to income)
- Role-based permissions (admin, member, viewer)
- Expense categories and tags
- Monthly/yearly reports and charts
- Export to CSV/PDF
- Push notifications for approvals
- Multi-household support

---

*Extracted from SPEC.md v2.0 on January 29, 2026.*
