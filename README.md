# SharedBudget

A production-grade household budget management app where couples collaboratively track expenses, manage salaries, savings, and settle debts — with a real-time approval workflow for shared financial decisions.

**Try it live:** [sharedbudget.vercel.app](https://sharedbudget.vercel.app) | [API Docs (Swagger)](https://sharedbudget-api.onrender.com/docs)

> The backend runs on Render's free tier — first request may take ~30s to cold-start.

---

## Try It Now

The fastest way to explore the app is with the pre-seeded demo accounts. Open two browser windows (one regular, one incognito) to simulate a real household:

### Step 1: Log in as the household owner

| Field    | Value              |
|----------|--------------------|
| Email    | `alex@test.com`    |
| Password | `TestPassword123!` |

### Step 2: Log in as the household member (incognito window)

| Field    | Value              |
|----------|--------------------|
| Email    | `sam@test.com`     |
| Password | `TestPassword456!` |

### What to try

| Action                       | Where          | What you'll see                                                        |
|------------------------------|----------------|------------------------------------------------------------------------|
| **View the dashboard**       | Both windows   | Income breakdown, expense split, savings, who-owes-whom settlement     |
| **Add a personal expense**   | As Alex        | Instantly appears — no approval needed                                 |
| **Propose a shared expense** | As Alex        | Creates a pending approval for Sam                                     |
| **Accept or reject it**      | As Sam         | Expense takes effect (or is discarded), settlement recalculates        |
| **Add a salary**             | As either user | Dashboard updates with new income figures                              |
| **Manage savings**           | As either user | Personal savings are instant; shared savings withdrawal needs approval |
| **Check approval history**   | Either window  | Full audit trail with timestamps, messages, and status filters         |
| **Mark settlement as paid**  | As the debtor  | Clears the "you owe" balance                                           |

### Want to test the full registration flow?

Create your own account at [sharedbudget.vercel.app/auth/register](https://sharedbudget.vercel.app/auth/register). You'll go through:
- Email/password registration with validation
- 6-digit email verification (check your inbox — powered by [Resend](https://resend.com))
- Household creation with auto-generated invite code
- Inviting another user by email or sharing the code

There's also a third demo account without a household — use it to test joining via invite code:

| Field    | Value              |
|----------|--------------------|
| Email    | `jordan@test.com`  |
| Password | `TestPassword789!` |

---

## What This Project Demonstrates

I built SharedBudget as a full-stack portfolio project to demonstrate production-level engineering skills across the entire stack. Here's what I focused on and why.

### Backend Engineering (NestJS 11)

| Skill                         | How it's demonstrated                                                                                                                            |
|-------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------|
| **API Design**                | 54 RESTful endpoints across 11 feature modules, versioned under `/api/v1`, fully documented with Swagger/OpenAPI                                 |
| **Authentication & Security** | JWT access/refresh token rotation, Argon2id password hashing, Redis-backed sessions, rate limiting, CORS, Helmet headers, enumeration prevention |
| **Database Design**           | 11 Prisma models with 10 enums, proper indexing, soft-delete patterns, referential integrity across cascading deletes                            |
| **Caching Strategy**          | Redis caching with TTL-based invalidation (1-5 min), atomic pipeline writes, cache-aside pattern for dashboard queries                           |
| **Business Logic**            | Approval workflow state machine for shared expenses and savings withdrawals — a real-world collaborative decision pattern                        |
| **Error Handling**            | Global exception filter with consistent error shape (`timestamp`, `requestId`), Prisma error auto-mapping (P2002 -> 409, P2025 -> 404)           |
| **Testing**                   | 55 spec files with 723+ unit tests covering happy paths, edge cases, boundary values, security scenarios, and error message assertions           |
| **Code Quality**              | Structured logging (Pino), composite endpoint decorators (DRY), strict TypeScript, consistent patterns across all modules                        |
| **GDPR Compliance**           | Account deletion with full data anonymization — preserves referential integrity while removing all PII                                           |

### Frontend Engineering (Angular 21)

| Skill              | How it's demonstrated                                                                                                         |
|--------------------|-------------------------------------------------------------------------------------------------------------------------------|
| **Modern Angular** | Standalone components, signals for state management, zoneless change detection (no NgZone) — cutting-edge Angular 21 features |
| **UI/UX**          | Material Design 3 theming, responsive layout, loading states, error handling, empty states, optimistic updates                |
| **Architecture**   | 9 lazy-loaded feature modules, 58 components, signal-based stores, typed HTTP interceptors for auth                           |
| **Form Handling**  | Reactive forms with real-time validation, cross-field validators, and accessible error messaging                              |
| **Testing**        | 39 component and service spec files using Vitest                                                                              |

### DevOps & Infrastructure

| Skill                | How it's demonstrated                                                                                                                                       |
|----------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Containerization** | Docker Compose with 5 services (PostgreSQL, Redis, Backend, Frontend, Nginx reverse proxy)                                                                  |
| **CI-ready**         | Separate build and runtime stages, environment-based configuration                                                                                          |
| **Cloud Deployment** | Vercel (frontend CDN) + Render (backend, PostgreSQL, Redis) — all on free tier                                                                              |
| **Documentation**    | 13 documentation files covering every layer: specs, architecture, API reference, frontend deep-dive, backend deep-dive (8 docs), and development guidelines |

### Engineering Process

| Practice                        | How it's applied                                                                                                   |
|---------------------------------|--------------------------------------------------------------------------------------------------------------------|
| **Spec-driven development**     | Every feature documented with acceptance criteria in `SPEC.md` before implementation                               |
| **Backend-first approach**      | All 54 endpoints built and tested (723+ tests) before starting the frontend                                        |
| **Systematic bug fixing**       | 8 tracked sprints of iterative fixes, 34/35 planned tasks completed                                                |
| **AI-assisted development**     | Claude Code as pair programmer with strict rules enforced via `CLAUDE.md` (mandatory tests, logging, Swagger docs) |
| **Comprehensive documentation** | Not just README — full architecture docs, deep-dives, and process guidelines                                       |

---

## Tech Stack

| Layer          | Technology                                                                  |
|----------------|-----------------------------------------------------------------------------|
| **Frontend**   | Angular 21.1, Angular Material 21.1 (M3), TypeScript 5.9, Signals, Zoneless |
| **Backend**    | NestJS 11, TypeScript 5.7, Prisma 7 ORM                                     |
| **Database**   | PostgreSQL 18, Redis 7 (sessions, caching, rate limiting)                   |
| **Auth**       | JWT (access + refresh tokens), Argon2id password hashing                    |
| **Testing**    | Vitest (94 spec files, 723+ tests), Playwright (10 E2E suites)              |
| **API Docs**   | Swagger/OpenAPI (auto-generated, 54 endpoints)                              |
| **Deployment** | Vercel (frontend), Render (backend + PostgreSQL + Redis)                    |
| **DevOps**     | Docker Compose, Nginx reverse proxy                                         |

---

## Architecture

```
Frontend (Angular 21)              Backend (NestJS 11)              Data Layer
+---------------------+          +---------------------+          +------------------+
| 58 Components       |  HTTP   | 11 Feature Modules  |  Prisma  | PostgreSQL 18    |
| Signal-based Stores | ------> | 54 REST Endpoints   | -------> | 11 Models        |
| Auth Interceptor    |  JWT    | Composite Decorators|          | 10 Enums         |
| 9 Lazy-loaded Routes|         | Global Exception    |          +------------------+
| Material Design 3   |         |   Filter            |  ioredis | Redis 7          |
+---------------------+         | Rate Limiting       | -------> | Sessions & Cache |
                                | Pino Structured Logs|          | Throttle Storage |
                                +---------------------+          +------------------+
```

**Key architectural decisions:**
- **Zoneless Angular** — signals drive change detection, eliminating NgZone overhead
- **Composite endpoint decorators** — each endpoint bundles route + Swagger + throttle + HTTP status in one decorator
- **Redis caching** with TTL-based invalidation (1-5 min depending on data volatility)
- **Global HttpExceptionFilter** — consistent error shape with `timestamp` and `requestId`
- **Prisma error auto-mapping** — database constraint violations mapped to proper HTTP status codes
- **Approval workflow** — state machine for collaborative financial decisions (create/update/delete/withdraw)

---

## Features

### Authentication & Security
- Email/password registration with 6-digit email verification (Redis-backed, 10-min TTL)
- JWT access tokens (15-min) + refresh tokens (7-day) with automatic rotation
- Password reset via email link (1-hour TTL)
- Rate limiting on all auth endpoints (Redis-backed throttling)
- Argon2id password hashing, Helmet security headers, CORS
- Account deletion with full data anonymization (GDPR-ready)

### Household Management
- Create a household and get an 8-character invite code
- Join via invite code (instant) or email invitation (accept/decline flow)
- Owner can: transfer ownership, remove members, regenerate invite code
- Members can leave freely; owners must transfer ownership first

### Expense Tracking
- **Personal expenses**: private to you; visible to household for budget calculations
- **Shared expenses**: any member can propose; changes require approval from other members
- Monthly, yearly (pay-in-full or installments), and one-time expense types
- Soft-delete, per-month payment tracking, recurring amount overrides

### Approval Workflow
- Shared expense changes (create/update/delete) create pending approvals
- Shared savings withdrawals also require approval (`WITHDRAW_SAVINGS` action)
- Accept with optional message, reject with required explanation
- Full approval history with status filtering
- Self-review prevention, duplicate approval guards

### Financial Dashboard
- Income summary (default + current salary per member)
- Expense breakdown (personal per member + shared total, monthly equivalents)
- Savings calculation (income - expenses - shared expense share)
- Settlement: "You owe Sam 125" or "Sam owes you 125" with mark-as-settled
- Pending approvals count badge

### Savings Management
- Personal savings: add/withdraw instantly
- Shared savings: add instantly, withdraw requires household approval
- Per-month tracking with running balance calculations

---

## Project Structure

```
SharedBudget/
├── backend/                    # NestJS 11 REST API
│   ├── src/
│   │   ├── auth/               # Register, verify, login, refresh, password reset
│   │   ├── household/          # CRUD, join/leave, invite, transfer ownership
│   │   ├── user/               # Profile, password change, account deletion
│   │   ├── salary/             # Salary upsert, monthly tracking
│   │   ├── personal-expense/   # Personal expense CRUD
│   │   ├── shared-expense/     # Shared expense proposals with approval
│   │   ├── approval/           # Accept/reject/cancel approvals
│   │   ├── dashboard/          # Financial overview, settlement
│   │   ├── expense-payment/    # Per-month payment tracking
│   │   ├── recurring-override/ # Override recurring amounts per month
│   │   ├── saving/             # Personal & shared savings
│   │   ├── common/             # Filters, DTOs, helpers, cache, utils
│   │   └── prisma/             # PrismaService (PostgreSQL via @prisma/adapter-pg)
│   └── prisma/
│       └── schema.prisma       # 11 models, 10 enums
├── frontend/                   # Angular 21 SPA
│   └── src/app/
│       ├── core/               # Auth, API service, error handler, layout shell
│       ├── shared/             # Pipes, directives, validators, reusable components
│       └── features/           # 9 lazy-loaded feature modules (58 components)
├── e2e/                        # Playwright E2E tests (10 test suites)
├── docker-compose.yml          # PostgreSQL + Redis + Backend + Frontend + Nginx
└── docs/                       # 13 documentation files
```

---

## Running Locally

### Prerequisites
- Node.js 24+
- Docker & Docker Compose

### Option A: Node.js + Docker (database only)

```bash
git clone https://github.com/3-da/SharedBudget.git
cd SharedBudget

# Install dependencies
cd backend && npm install && cd ..
cd frontend && npm install && cd ..

# Start PostgreSQL + Redis
docker compose up -d postgres redis

# Set up backend
cd backend
cp .env.example .env
# Edit .env — use the docker-compose defaults:
#   DB_USER=sharedbudget  DB_PASSWORD=sharedbudget_secret  DB_NAME=sharedbudget
#   REDIS_PASSWORD=redis_secret
#   DATABASE_URL=postgresql://sharedbudget:sharedbudget_secret@localhost:5432/sharedbudget?schema=public
#   Generate JWT secrets: node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
npx prisma migrate dev --config ./prisma.config.ts
npm run generate
npm run start:dev    # http://localhost:3000 (Swagger at /docs)

# Run frontend (new terminal)
cd frontend
npm start            # http://localhost:4200
```

### Option B: Full Docker (no Node.js required)

```bash
git clone https://github.com/3-da/SharedBudget.git
cd SharedBudget

# Create backend/.env (see Option A for values)
cp backend/.env.example backend/.env
# Edit backend/.env with the docker-compose defaults listed above

# Build and start all 5 services
docker compose up --build    # http://localhost (via Nginx)
```

### Running tests

```bash
# Backend: 55 spec files, 723+ tests
cd backend && npm run test

# Frontend: 39 spec files
cd frontend && npm run test

# E2E: 10 Playwright suites (requires backend + frontend running)
cd e2e && npm test
```

---

## User Stories

These stories illustrate how real users interact with SharedBudget. They map directly to the features you can try with the demo accounts above.

### Story 1: Getting Started Together

> Alex and Sam just moved in together. Alex registers on SharedBudget, verifies the email, and creates a household called "Our Place." The app generates an invite code `AB12CD34`. Alex shares this code with Sam, who registers and joins the household by entering the code. They now share a financial dashboard.

**What it exercises:** Registration, email verification, household creation, invite code joining.

### Story 2: Tracking Personal Spending

> Sam wants to track a personal gym membership ($40/month). Sam adds it as a personal monthly expense under the "Health" category. The expense appears on Sam's side of the dashboard, reducing Sam's calculated savings. Alex can see that Sam has personal expenses (for fair budget calculations), but can't modify or delete them.

**What it exercises:** Personal expense CRUD, expense categories, frequency handling, dashboard calculations, privacy boundaries.

### Story 3: Proposing a Shared Expense

> Alex finds a great deal on a streaming service — $15/month. Alex proposes it as a shared expense. This doesn't take effect immediately — instead, Sam gets a pending approval notification. Sam reviews the proposal, sees the $15/month amount, and accepts it with the message "Good find!" The expense is now active for both members, split equally on the dashboard.

**What it exercises:** Shared expense proposals, approval workflow, notification badge, accept with message, settlement recalculation.

### Story 4: Disagreeing on a Shared Expense

> Alex proposes adding a $200/month cleaning service. Sam thinks it's too expensive and rejects it with the explanation "Let's find something cheaper first." The expense is discarded — it never appears on the dashboard. Alex can see the rejection reason in the approval history and can propose a different amount later.

**What it exercises:** Approval rejection with required explanation, approval history, expense lifecycle.

### Story 5: Managing Salaries and Settling Debts

> Alex earns $3,000/month and Sam earns $2,500/month. Both enter their salaries. The dashboard now shows the full household income ($5,500), each person's expenses, and the net settlement. If shared expenses total $1,000/month (split $500 each), but Alex paid for all of them, the dashboard shows "Sam owes Alex $500." Sam clicks "Mark as Settled" after transferring the money.

**What it exercises:** Salary management, dashboard income/expense breakdown, settlement calculations, mark-as-paid flow.

### Story 6: Building and Withdrawing Savings

> Alex and Sam decide to save for a vacation. Each month, both add to a shared savings pot. Alex contributes $200, Sam contributes $150. The savings page tracks the running balance. When Alex wants to withdraw $300 for booking flights, the withdrawal doesn't happen instantly — Sam gets an approval request. Sam approves it, and the shared savings balance is reduced.

**What it exercises:** Personal vs shared savings, running balance tracking, `WITHDRAW_SAVINGS` approval action, savings timeline.

### Story 7: Handling Yearly Expenses

> Their annual apartment insurance costs $1,200/year. Alex adds it as a yearly shared expense and selects "pay in full" — the dashboard shows $100/month equivalent for budget planning. Later, they switch their internet plan to a yearly contract with quarterly installments, and the app tracks each installment payment separately.

**What it exercises:** Yearly expense strategies (pay-in-full vs installments), monthly equivalent calculations, payment tracking.

### Story 8: Leaving and Transferring Ownership

> After a year, Alex wants to move out. Since Alex is the household owner, the app requires transferring ownership first. Alex transfers ownership to Sam, who becomes the new owner. Now Alex (as a regular member) can leave the household. Alex's historical data remains in the system for Sam's records, but Alex can now create or join a different household.

**What it exercises:** Ownership transfer, role-based permissions, member departure, data preservation.

---

## Documentation

This project includes 13 documentation files — written alongside the code, not as an afterthought:

| Document                                                           | What it covers                                                                              |
|--------------------------------------------------------------------|---------------------------------------------------------------------------------------------|
| [`SPEC.md`](./SPEC.md)                                             | Business requirements, 15 user stories with acceptance criteria                             |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md)                             | Full data model (11 models), auth chain, caching strategy, deployment                       |
| [`PROJECT_INDEX.md`](./PROJECT_INDEX.md)                           | Quick reference — all 54 endpoints, module map, test commands                               |
| [`CLAUDE.md`](./CLAUDE.md)                                         | Development process rules (tests, logging, Swagger, code style)                             |
| [`docs/FRONTEND_ARCHITECTURE.md`](./docs/FRONTEND_ARCHITECTURE.md) | Frontend deep-dive: signals, stores, routing, auth flow, theming                            |
| [`docs/backend/01-08`](./docs/backend/)                            | Backend deep-dive: database, auth, architecture, approvals, caching, API, security, testing |

---

## License

MIT License — see [LICENSE](./LICENSE) for details.
