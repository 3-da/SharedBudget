# SharedBudget — project overlay

Repo-specific instructions layered on top of the global canon.

Before changing code, read `CLAUDE.md` completely. It is the authoritative project workflow and contains mandatory rules for unit tests, service logging, Swagger decorators, DTO validation, security and Redis-backed flows.

## Stack

NestJS 11 · Prisma 7 · PostgreSQL · Redis · Angular 21 · Vitest · Playwright. This is a two-package repository with `backend/` and `frontend/`, not a root workspace.

## Conventions

- New or changed business logic ships with unit tests in the same change.
- Every service has a Nest logger and avoids logging secrets or unnecessary PII.
- Every endpoint uses the project's composite Swagger decorators; error responses use `ErrorResponseDto`.
- Read `PROJECT_INDEX.md` for structure and commands; read the relevant file under `docs/handbook/` before changing architecture, data, APIs, security, tests or deployment.

## Gotchas

- Temporary verification, password-reset and account-deletion state lives in Redis rather than database tables.
- Demo accounts are intentionally seeded and documented.
- Production Redis must disable dangerous administrative commands before deployment.
