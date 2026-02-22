# SharedBudget -- Project Overview

SharedBudget is a household expense tracking application for couples who share a budget. Members track personal and shared expenses, manage salaries, accumulate savings, and settle debts monthly. Shared expense mutations require approval from the other household member before taking effect.

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | Angular + Angular Material (M3) | 21.1.x |
| Frontend dates | date-fns | 4.x |
| Frontend charts | chart.js | 4.5.x |
| Backend | NestJS | 11.1.x |
| ORM | Prisma (with @prisma/adapter-pg) | 7.3.0 |
| Database | PostgreSQL | 18.1 |
| Cache / Sessions | Redis (ioredis 5.9.2) | 7.2.x |
| Auth | JWT (passport-jwt 4.x) + Argon2 0.44.0 | -- |
| Testing | Vitest (unit) + Playwright (E2E) | 4.x |
| API docs | @nestjs/swagger | 11.2.5 |
| Logging | nestjs-pino + pino | 4.5.0 / 10.3.0 |
| Language | TypeScript | 5.7 (BE) / 5.9 (FE) |
| Runtime | Node.js | 24.13.0 LTS |

---

## Key Design Decisions

**JWT + Redis hybrid sessions.** Access tokens are stateless JWTs (15-minute TTL) verified locally with no Redis/DB call per request. Refresh tokens are random 32-byte hex strings stored in Redis (7-day TTL) for server-side revocation and rotation. This gives low-latency reads with immediate invalidation capability on password change.

**Angular signals over NgRx.** Each feature uses lightweight signal-based stores instead of a global state management library. Signals drive zoneless change detection, eliminating Zone.js overhead (~13KB) and providing an explicit reactivity model. NgRx would add ceremony disproportionate to the application's complexity.

**Prisma over TypeORM.** Schema-first single source of truth with auto-generated migrations. No lazy loading prevents N+1 surprises. The `@prisma/adapter-pg` adapter eliminates the Rust-based query engine binary, simplifying Docker builds.

**Cache-aside with Redis.** Read-heavy dashboard queries hit Redis first (sub-millisecond). Cache misses fall through to PostgreSQL. Write operations invalidate relevant cache keys. The same Redis instance serves three roles: caching, session storage, and rate limiting -- zero additional infrastructure.

**Approval workflow for shared mutations.** Any shared expense change (create, update, delete) or shared savings withdrawal produces a pending approval record. Another household member must accept or reject. This prevents unilateral changes to shared financial data.

**Standalone components + Feature-Sliced Design.** The Angular frontend uses standalone components organized into `core/`, `shared/`, and `features/` layers with a strict one-directional dependency graph. Features are lazy-loaded. No NgModules.

---

## Feature Scope

SharedBudget implements 15 user stories across these feature areas:

| # | Feature | Description |
|---|---------|-------------|
| 1 | Registration and email verification | Email/password registration with 6-digit verification code (Redis, 10-min TTL) |
| 2 | Login, logout, and password recovery | JWT tokens, refresh rotation, forgot/reset password with session invalidation |
| 2.5 | Household management | Create household, join by code, email invitations, transfer ownership, leave/remove |
| 3 | Salary management | Per-user monthly salary tracking (default + current), upsert semantics |
| 4 | Personal expense management | CRUD for personal recurring and one-time expenses, soft delete |
| 5 | Shared expense proposals | Propose create/update/delete for shared expenses (approval-gated) |
| 6 | Expense approval workflow | Accept/reject/cancel proposals, pending and history views |
| 7 | Yearly expense configuration | Pay-in-full or installment strategies (monthly, quarterly, semi-annual) |
| 8 | Settlement and debt tracking | Automatic net settlement calculation, mark-as-paid with audit trail |
| 9 | Financial dashboard | Aggregated income, expenses, savings, settlement, pending approval count |
| 10 | Account deletion | Multi-scenario deletion with GDPR-compliant anonymization |
| 11 | User experience | Responsive design, real-time calculations, form validation, accessibility |
| 12 | Savings withdrawal | Personal (immediate) and shared (approval-required) withdrawals |
| 13 | Caching and performance | Redis cache-aside with per-domain TTLs, granular and nuclear invalidation |
| 14 | Data persistence and security | Argon2id hashing, JWT guards, RBAC, rate limiting, enumeration prevention |

---

## Project Status

- **Backend**: Complete -- 63 endpoints across 11 controllers, 19 modules
- **Frontend**: Complete -- Angular 21, 9 features, 19 pages, 28 feature components, 7 signal stores
- **Testing**: 55 backend spec files (723 tests), 33 frontend spec files, 8 Playwright E2E suites
- **Phase 1 constraint**: Households limited to 2 members (couple). Phase 2 targets multi-member support.

---

## Constraints and Limitations

- **2-member household limit.** Settlement calculations, dashboard aggregations, and the `Settlement` model assume exactly 2 members. Multi-party support requires schema and query changes.
- **No real email delivery.** `MailService` logs emails in development. A production email provider (SendGrid, SES) is not integrated.
- **No cache warming.** The cache starts cold on each deployment. First requests pay full DB query cost.
- **Redis dangerous commands.** `FLUSHALL`, `FLUSHDB`, `CONFIG`, `DEBUG` are not disabled. Must be restricted before production via `rename-command` or Redis 7 ACLs.
- **Swagger disabled in production.** API documentation is available only in non-production environments (`/docs`).
