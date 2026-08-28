# SharedBudget backend

The backend is a NestJS 11 API for authentication, households, income, expenses, savings, approvals, settlements, and invitations. It uses Prisma 7 with PostgreSQL, Redis for sessions/cache/throttling, Pino logging, and Resend for production email delivery.

## Main areas

- `src/auth/` — registration, verification, login, refresh, logout, and password recovery
- `src/household/` — household membership, invitations, ownership, and member management
- `src/personal-expense/` and `src/shared-expense/` — private records and approval-gated shared changes
- `src/salary/`, `src/saving/`, and `src/dashboard/` — monthly finance data and household calculations
- `src/approval/` — pending decisions and review history
- `src/common/` — cache, decorators, filters, guards, DTOs, and utilities
- `prisma/` — schema and migrations
- `scripts/seed-demo.ts` — targeted portfolio demo reset

## Environment

Copy `.env.example` to `.env` and configure PostgreSQL, Redis, JWT secrets, `FRONTEND_URL`, and optional Resend credentials. The application validates required settings during startup.

Swagger is available at `http://localhost:3000/docs` outside production. API routes use the `/api/v1` prefix.

## Commands

Run these from `backend/`:

```bash
npm install
npx prisma generate --config ./prisma.config.ts
npx prisma migrate dev --config ./prisma.config.ts
npm run start:dev

npm run lint
npm run test              # 58 Vitest spec files, 1,143 tests
npm run test:cov
npm run build
```

## Demo data

```bash
npm run seed:demo
```

The command rebuilds the backend and replaces the three public demo identities plus their related household records:

- `alex@demo.com`
- `sam@demo.com`
- `jordan@demo.com`

All use `Demo1234!`. The seeded household contains twelve months of income and savings, expenses, settlements, and decisions. Other users are not deleted.

Set `SEED_DEMO_DATA=true` in the portfolio deployment to run the targeted reset during container startup. `DEMO_REFERENCE_MONTH=YYYY-MM` optionally anchors the history to a fixed month.

## Production

Railway builds `Dockerfile`, applies Prisma migrations, optionally resets the demo accounts, and starts `dist/src/main`. Production uses Neon PostgreSQL and Upstash Redis. Swagger is disabled in production.

## Verification

Backend changes should pass:

```bash
npm run lint
npm run test
npm run build
```

The repository-level Playwright suite starts an isolated backend and database in GitHub Actions. CI seeds the portfolio identities as well as its dedicated test users so the public demo login is verified end to end.
