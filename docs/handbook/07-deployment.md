# SharedBudget -- Deployment

---

## Docker Compose (Local Development)

The `docker-compose.yml` provides PostgreSQL and Redis for local development:

| Service | Image | Port |
|---------|-------|------|
| PostgreSQL 18.1 | postgres:18-alpine | 5432 |
| Redis 7.2 | redis:7-alpine | 127.0.0.1:6379 |
| Backend (NestJS 11) | node:24-alpine | 3000 |
| Frontend (Angular 21) | node:24-alpine / nginx (prod) | 4200 (dev) / 3001 (prod) |

Redis port is bound to `127.0.0.1` only (localhost) to prevent network exposure.

### Starting the Stack

```bash
docker compose up -d              # Start PostgreSQL + Redis
cd backend && npm run start:dev   # Start API with hot reload (port 3000)
cd frontend && npm start          # Start Angular dev server (port 4200)
```

### Stopping

```bash
docker compose down               # Stop and remove containers
```

---

## Environment Variables

All required environment variables. Source: `ARCHITECTURE.md`.

### Application

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `NODE_ENV` | Environment mode | `development` | Yes |
| `PORT` | Backend server port | `3000` | Yes |
| `API_PREFIX` | URL prefix for all routes | `api/v1` | Yes |
| `CORS_ORIGIN` | Allowed frontend origin | `http://localhost:4200` | Yes |

### Database

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `DB_HOST` | PostgreSQL host | `localhost` | Yes |
| `DB_PORT` | PostgreSQL port | `5432` | Yes |
| `DB_NAME` | Database name | `sharedbudget` | Yes |
| `DB_USER` | Database user | `sharedbudget` | Yes |
| `DB_PASSWORD` | Database password | `<password>` | Yes |
| `DATABASE_URL` | Full connection string (used by Prisma) | `postgresql://user:pass@host:port/db` | Yes |

### Redis

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `REDIS_HOST` | Redis host | `localhost` | Yes |
| `REDIS_PORT` | Redis port | `6379` | Yes |
| `REDIS_PASSWORD` | Redis password | `<password>` | Yes |
| `REDIS_TLS` | Enable TLS for Redis connection | `true` | No (default: `false`) |

### JWT

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `JWT_ACCESS_SECRET` | Signing secret for access tokens | `<32+ char secret>` | Yes |
| `JWT_ACCESS_EXPIRATION` | Access token TTL | `15m` | Yes |
| `JWT_REFRESH_SECRET` | Signing secret for refresh tokens | `<32+ char secret>` | Yes |
| `JWT_REFRESH_EXPIRATION` | Refresh token TTL | `7d` | Yes |

### Auth TTLs

| Variable | Description | Default |
|----------|-------------|---------|
| `AUTH_VERIFICATION_CODE_TTL` | Email verification code TTL (seconds) | `600` (10 min) |
| `AUTH_REFRESH_TOKEN_TTL` | Refresh token TTL (seconds) | `604800` (7 days) |
| `AUTH_RESET_TOKEN_TTL` | Password reset token TTL (seconds) | `3600` (1 hour) |

### Argon2

| Variable | Description | Default |
|----------|-------------|---------|
| `ARGON2_MEMORY_COST` | Memory per hash (KB) | `65536` (64 MB) |
| `ARGON2_TIME_COST` | Iterations | `3` |
| `ARGON2_PARALLELISM` | Threads | `1` |

### Household

| Variable | Description | Default |
|----------|-------------|---------|
| `HOUSEHOLD_MAX_MEMBERS` | Maximum members per household | `2` |
| `INVITE_CODE_LENGTH` | Length of invite code | `8` |

### Cache TTLs

| Variable | Description | Default |
|----------|-------------|---------|
| `CACHE_TTL_USER_SESSION` | Session cache TTL (seconds) | `604800` (7 days) |
| `CACHE_TTL_SALARIES` | Salary cache TTL (seconds) | `300` (5 min) |
| `CACHE_TTL_SUMMARY` | Dashboard/settlement cache TTL (seconds) | `120` (2 min) |
| `CACHE_TTL_EXPENSES` | Expense list cache TTL (seconds) | `60` (1 min) |
| `CACHE_TTL_SETTLEMENT` | Settlement cache TTL (seconds) | `120` (2 min) |

---

## Production Deployment

### Target Infrastructure

| Component | Platform | Notes |
|-----------|----------|-------|
| Backend API | Render (Web Service) | NestJS, auto-deploy from Git |
| PostgreSQL | Render (Managed Database) | PostgreSQL 18 |
| Redis | Render (Managed Redis) | Redis 7 with TLS |
| Frontend | Vercel | Static Angular build |

### Backend Build

```bash
cd backend
npm run build           # NestJS production build
npm run start:prod      # Start production server
```

### Frontend Build

```bash
cd frontend
npx ng build            # Production build
# Output: dist/frontend/browser/
```

The `dist/frontend/browser/` directory is deployed as static files.

### Database Migrations

```bash
cd backend
npx prisma migrate deploy    # Apply unapplied migrations (no generation)
```

Run before starting the backend in production. Tracked in `_prisma_migrations` table.

### Redis TLS Configuration

Set `REDIS_TLS=true` on Render where Redis runs on a separate host with TLS. Docker Compose keeps `REDIS_TLS=false` (Redis on localhost).

The `redis.module.ts` conditionally adds `tls: {}` to the ioredis configuration based on this variable.

---

## Build and Development Commands

### Infrastructure

```bash
docker compose up -d          # Start PostgreSQL + Redis
docker compose down           # Stop containers
```

### Backend

```bash
cd backend
npm run start:dev             # Dev with hot reload (port 3000)
npm run build                 # Production build
npm run test                  # Run all tests (vitest run)
npm run test:cov              # Coverage report
npm run lint                  # ESLint with auto-fix
npm run format                # Prettier
npm run generate              # Regenerate Prisma client + DTOs
npx prisma migrate dev --config ./prisma.config.ts   # Run migrations (dev)
npm run prisma:studio         # Prisma Studio GUI
```

### Frontend

```bash
cd frontend
npm start                     # ng serve (port 4200)
npx ng build                  # Production build -> dist/frontend/browser
npm run test                  # Run all tests (vitest run)
npm run test:cov              # Coverage report
```

### E2E Tests

```bash
cd e2e
npm test                      # Run all Playwright tests (headless)
npm run test:headed           # With browser visible
npm run test:ui               # Interactive Playwright UI
npm run test:debug            # Debug mode
```

E2E tests require a running backend with a seeded database.

### Demo Data Seeding

```bash
cd backend
npm run seed                  # Seed demo data for development
```

---

## Startup Order

1. Start PostgreSQL and Redis (`docker compose up -d`)
2. Run database migrations (`npx prisma migrate deploy`)
3. Start backend (`npm run start:dev` or `npm run start:prod`)
4. Start frontend (`npm start` for dev, or deploy `dist/frontend/browser/` for prod)

The backend connects to PostgreSQL and Redis on startup via `PrismaService.onModuleInit()` and the Redis module. If either service is unavailable, the backend fails to start.

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

---

## Health and Monitoring

**Structured logging**: nestjs-pino outputs JSON in production. Every log entry includes a `requestId` for end-to-end tracing.

**Sensitive field redaction**: Pino configuration redacts `password`, `token`, and `authorization` fields from logs.

**Swagger**: Available at `/docs` in non-production environments. Disabled in production.

**Redis connectivity**: `redis.module.ts` includes `retryStrategy`, `maxRetriesPerRequest: 3`, `reconnectOnError`, and error/reconnecting event handlers. Logs connection failures.
