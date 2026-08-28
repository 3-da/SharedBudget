# SharedBudget

[![CI](https://github.com/3-da/SharedBudget/actions/workflows/ci.yml/badge.svg?branch=develop)](https://github.com/3-da/SharedBudget/actions/workflows/ci.yml)

SharedBudget is a production-deployed household finance application for couples. It combines personal and shared expense tracking, income, savings, settlements, invitations, and an approval workflow that prevents either household member from changing shared finances unilaterally.

**Live application:** [sharedbudget.vercel.app](https://sharedbudget.vercel.app)

## Live demo

No setup or README credentials are required.

1. Open [the login page](https://sharedbudget.vercel.app/auth/login).
2. Click **Open live demo**.
3. Explore the prepared Alex household immediately.

The portfolio environment contains twelve months of income and savings history, recurring personal and shared expenses, settlements, invitations, and pending decisions. The demo accounts are reset automatically when the production backend starts, so every visitor gets a useful starting point.

### Optional two-person workflow

To review the collaboration flow from both sides, keep Alex open and sign in as Sam in a private browser window:

| Account | Email | Password | Purpose |
|---|---|---|---|
| Alex | `alex@demo.com` | `Demo1234!` | Household owner and one-click public demo account |
| Sam | `sam@demo.com` | `Demo1234!` | Household member who can review Alex's proposals |
| Jordan | `jordan@demo.com` | `Demo1234!` | User without a household; join with invite code `DEMO2026` |

### Suggested product tour

| Area | What to try |
|---|---|
| Household snapshot | Review income, expenses, savings, and the current settlement |
| My expenses | Add or edit a private recurring expense |
| Shared expenses | Propose a household expense and review its approval state |
| Income | Inspect the seeded twelve-month salary history and chart |
| Savings | Compare personal and shared savings history |
| Decisions | Accept, reject, or cancel a pending shared-finance proposal |
| Invitations | Review household invitation and join-by-code flows |

## Product capabilities

- Email registration and verification, secure login, refresh-token rotation, and password recovery
- Household creation, invite codes, email invitations, ownership transfer, and member removal
- Personal and approval-gated shared expenses with monthly, yearly, one-time, and installment schedules
- Monthly income history, personal/shared savings, and recurring amount overrides
- Household dashboard with income, expenses, savings, decisions, and who-owes-whom settlement
- Approval history with accept, reject, cancel, message, and audit metadata
- Responsive light/dark interface with accessible forms, loading states, empty states, and error feedback
- GDPR-oriented account deletion and data anonymization

## Engineering highlights

### Backend

- NestJS 11 API versioned under `/api/v1`
- Prisma 7 with PostgreSQL and explicit migrations
- Redis-backed sessions, cache-aside reads, throttling, and token revocation
- JWT access tokens, rotating refresh tokens, Argon2id hashing, Helmet, CORS, and request validation
- Resend email delivery with a development console fallback
- Pino structured logging and consistent API error responses
- Automatic, targeted demo-data reset for the three public portfolio accounts

### Frontend

- Angular 21 standalone components and lazy-loaded feature routes
- Signals and zoneless change detection
- Angular Material 3 with a shared responsive design system
- Typed HTTP services, authentication interceptor, route guards, and signal-based feature stores
- Chart.js financial history visualizations
- One-click public demo access through the same production authentication path as a normal login

### Delivery and verification

- GitHub Actions runs backend lint, backend tests, frontend tests, both production builds, and Playwright E2E tests
- 58 backend spec files with 1,143 tests
- 43 frontend spec files with 323 tests
- 10 Playwright suites defining 80 Chromium cases; the current CI run passes 74 with 6 intentionally skipped
- Vercel production frontend with API proxying to Railway
- Railway backend with PostgreSQL on Neon and Redis on Upstash
- Docker Compose environment for local PostgreSQL, Redis, backend, frontend, and Nginx

## Architecture

```text
Browser
  |
  v
Angular 21 SPA on Vercel
  |  /api/v1
  v
NestJS 11 API on Railway
  |----------------------|
  v                      v
PostgreSQL on Neon       Redis on Upstash
financial records        sessions, cache, throttling
```

Shared expense changes and shared savings withdrawals create decisions instead of mutating household data immediately. Another member must accept or reject the proposal before the shared state changes.

## Technology

| Layer | Technology |
|---|---|
| Frontend | Angular 21.1, Angular Material 21.1, TypeScript 5.9, RxJS, Chart.js, date-fns |
| Backend | NestJS 11, TypeScript 5.7, Prisma 7, Pino, Resend |
| Data | PostgreSQL 18, Redis 7 |
| Security | JWT, Argon2id, Helmet, CORS, validation, rate limiting |
| Testing | Vitest 4, Playwright |
| Delivery | GitHub Actions, Docker, Vercel, Railway, Neon, Upstash |

## Repository layout

```text
SharedBudget/
|-- backend/             NestJS API, Prisma schema, migrations, and demo seeder
|-- frontend/            Angular application and design system
|-- e2e/                 Playwright browser suites and test fixtures
|-- docs/handbook/       Architecture, data, API, security, testing, and deployment
|-- .github/workflows/   Build, test, and E2E automation
|-- docker-compose.yml   Complete local stack
`-- PROJECT_INDEX.md     Codebase orientation map
```

## Run locally

### Prerequisites

- Node.js 22+
- Docker Desktop with Docker Compose

### Install and start infrastructure

```bash
git clone https://github.com/3-da/SharedBudget.git
cd SharedBudget

cd backend && npm install && cd ..
cd frontend && npm install && cd ..
cd e2e && npm install && cd ..

docker compose up -d postgres redis
```

Copy `backend/.env.example` to `backend/.env`, then set the PostgreSQL, Redis, JWT, frontend URL, and optional Resend values described in that file.

### Prepare and start the backend

```bash
cd backend
npx prisma generate --config ./prisma.config.ts
npx prisma migrate dev --config ./prisma.config.ts
npm run seed:demo
npm run start:dev
```

The API starts at `http://localhost:3000/api/v1`. Swagger is available locally at `http://localhost:3000/docs`.

`npm run seed:demo` replaces only `alex@demo.com`, `sam@demo.com`, and `jordan@demo.com` plus their related demo records. Do not run it against an environment where those addresses belong to real users.

### Start the frontend

In another terminal:

```bash
cd frontend
npm start
```

Open `http://localhost:4200`.

### Run verification

```bash
cd backend && npm run lint && npm run test && npm run build
cd ../frontend && npm run test && npm run build
cd ../e2e && npm test -- --project=chromium
```

The Playwright suite requires PostgreSQL, Redis, the backend, and the frontend. Its global setup creates isolated test accounts; CI also seeds the public demo accounts to verify the one-click demo end to end.

## Deployment

- Frontend: Vercel project `sharedbudget`, production alias [sharedbudget.vercel.app](https://sharedbudget.vercel.app)
- Backend: Railway service `sb-backend`
- Production demo reset: `SEED_DEMO_DATA=true`
- Optional fixed demo month: `DEMO_REFERENCE_MONTH=YYYY-MM`

Production Swagger is intentionally disabled. The public frontend proxies `/api/*` requests to the Railway service and applies security headers through `vercel.json`.

## Documentation

| Document | Purpose |
|---|---|
| [Project index](./PROJECT_INDEX.md) | Entry points, modules, major flows, and code locations |
| [Technical handbook](./docs/handbook/) | Architecture, data model, API, security, testing, and deployment |
| [Backend guide](./backend/README.md) | API setup, commands, environment, and demo seeding |
| [Frontend guide](./frontend/README.md) | SPA structure, commands, and API integration |

## License

See [LICENSE](./LICENSE).
