# SharedBudget -- Security

---

## Authentication Model

### Two-Token Pattern

SharedBudget uses a JWT + Redis hybrid session model:

```
+------------------+       +------------------+
| Access Token     |       | Refresh Token    |
| JWT, HS256       |       | 32-byte hex      |
| TTL: 15 min      |       | TTL: 7 days      |
| Stored: memory   |       | Stored: Redis +  |
| (frontend)       |       |   localStorage   |
+------------------+       +------------------+
        |                           |
        v                           v
  Every API request          POST /auth/refresh
  (Authorization header)     (when access expires)
        |                           |
        v                           v
  JwtStrategy.validate()     SessionService lookup
  No DB/Redis call           Redis: refresh:{token}
                             Rotation: delete old,
                             issue new pair
```

**Access token**: Stateless JWT signed with HS256 (`JWT_ACCESS_SECRET`). Payload: `{ sub: userId, email }`. Verified locally -- no Redis or database call per request. 15-minute expiration limits the window if a token is compromised.

**Refresh token**: 32 bytes from `crypto.randomBytes`, hex-encoded to 64 characters. Not a JWT -- no payload needed since all session data lives in Redis. Stored at `refresh:{token}` with 7-day TTL.

**Token rotation**: Every `/auth/refresh` call deletes the old refresh token and issues a new one. A stolen token can be used only once. If the attacker uses it first, the legitimate user's next refresh fails, signaling compromise.

**Frontend persistence**:
- Access token: in-memory only (lost on reload, restored via refresh)
- Refresh token: `localStorage` key `sb_refresh_token`

### Session Tracking

Two Redis data structures per user:

| Key | Type | Purpose |
|-----|------|---------|
| `refresh:{token}` | String | Maps token to userId (lookup path) |
| `user_sessions:{userId}` | Set | All active tokens for the user (reverse index) |

The Set enables bulk invalidation: `SMEMBERS` retrieves all tokens, then pipeline `DEL` removes them in one round-trip.

### Session Invalidation

`SessionService.invalidateAllSessions(userId)` deletes every refresh token across all devices. Triggered on:

- Password change (`PUT /users/me/password`)
- Password reset (`POST /auth/reset-password`)
- Account deletion (`DELETE /users/me`)

Uses Redis pipeline (not individual `DEL` commands) for batch efficiency.

### Global Auth Guard

`JwtAuthGuard` is registered as `APP_GUARD` in `AppModule`. Every endpoint requires authentication **by default**. Public endpoints opt out via `@Public()` decorator. This inversion ensures a forgotten decorator results in an overly-restrictive endpoint (annoying) rather than an unauthenticated one (vulnerability).

---

## Password Hashing -- Argon2id

Argon2id was chosen over bcrypt because it is memory-hard. Each hash attempt requires configurable RAM allocation, making GPU-based cracking economically impractical. Argon2 won the Password Hashing Competition (2015) and is the current OWASP recommendation.

**Configuration** (via environment variables):

| Parameter | Default | Purpose |
|-----------|---------|---------|
| `ARGON2_MEMORY_COST` | 65536 | 64 MB per hash |
| `ARGON2_TIME_COST` | 3 | 3 iterations |
| `ARGON2_PARALLELISM` | 1 | 1 thread |

`argon2.verify()` is constant-time internally, preventing timing side-channel attacks.

---

## Enumeration Prevention

The system returns identical responses for different failure conditions to prevent attackers from discovering which emails are registered.

**Registration**: Returns `"We've sent a verification code to your email."` whether the email is new or already exists. If the email exists, the method returns early without sending a code.

**Login**: Returns `"Incorrect email or password."` for both "email not found" and "wrong password" cases. The `emailVerified` check uses a different error (403) because it is not a credentials failure.

**Forgot password**: Returns `"If an account with this email exists, a password reset link has been sent."` regardless of email existence.

---

## Role-Based Access Control (RBAC)

Two roles: **OWNER** (household creator) and **MEMBER** (joined via invite).

**OWNER-only operations**: transfer ownership, regenerate invite code, invite by email, remove member, cancel invitation, initiate deletion request, cancel deletion request.

**Any member operations**: create/view expenses, propose shared expense changes, accept/reject approvals, manage salary, manage savings, view dashboard.

Role checks are performed **inside service methods**, not in route guards. Authorization logic is context-dependent (e.g., OWNER cannot leave without transferring ownership first), which does not fit cleanly into generic `@Roles()` guards.

**Membership-first pattern**: Every service method that touches shared resources calls `ExpenseHelperService.requireMembership(userId)` as its first operation. This derives `householdId` from the authenticated user -- never from the request body. Prevents IDOR attacks even if an attacker knows another household's resource IDs.

**HTTP status semantics**:
- 401 Unauthorized: Identity unknown (missing, expired, or invalid JWT)
- 403 Forbidden: Identity known, action not permitted (wrong role, self-review, etc.)

---

## Rate Limiting

Provided by `@nestjs/throttler` with `ThrottlerRedisStorage`. Counters stored in Redis for consistency across multiple backend instances.

### Rate Limit Tiers

**Tier 1 -- Authentication actions (strictest)**:

| Endpoint | Limit | Window | Block Duration |
|----------|-------|--------|----------------|
| Register | 3 | 60s | 600s (10 min) |
| Login | 5 | 60s | 300s (5 min) |
| Verify code | 5 | 60s | 300s (5 min) |
| Reset password | 5 | 60s | 300s (5 min) |

**Tier 2 -- Email-triggering endpoints**:

| Endpoint | Limit | Window |
|----------|-------|--------|
| Resend code | 3 | 600s (10 min) |
| Forgot password | 3 | 600s (10 min) |

**Tier 3 -- Standard (authenticated)**:

| Endpoint | Limit | Window |
|----------|-------|--------|
| Refresh / Logout | 30 | 60s |
| All other endpoints | 100 | 60s |

Exceeded limits return 429 with `Retry-After` headers.

---

## Input Validation and Mass Assignment Prevention

**ValidationPipe** registered globally with `whitelist: true` and `transform: true`:
- `whitelist: true` strips any properties not declared in the DTO. Prevents mass assignment.
- `transform: true` converts plain JSON to typed class instances, enabling class-transformer decorators.

**Server-derived identity**: `userId` comes from the JWT `sub` claim. `householdId` is looked up from the database via `requireMembership()`. Neither is taken from request bodies.

**Three-layer defense in depth**:

| Layer | Technology | Catches |
|-------|-----------|---------|
| DTO validation | class-validator | Type mismatches, missing fields, out-of-range values |
| Whitelist stripping | ValidationPipe | Unknown/extra fields |
| Database constraints | Prisma + PostgreSQL | Unique violations, FK violations, enum mismatches |

---

## CORS

```typescript
app.enableCors({ origin: corsOrigin, credentials: true });
```

Restricted to a single configurable origin (`CORS_ORIGIN` env var). Default: `http://localhost:4200` in development. The `credentials: true` flag allows cookie and authorization header transmission.

CSRF is not applicable because SharedBudget uses JWT bearer tokens (not cookies). The browser does not automatically attach the token to cross-origin requests.

---

## SQL Injection Prevention

Prisma uses parameterized queries by design. There is no string concatenation in any database query and zero uses of raw SQL in the codebase. SQL injection is structurally impossible.

---

## GDPR -- Account Deletion and Anonymization

Account deletion follows three scenarios:

**Solo user / regular MEMBER**: Immediate anonymization. Personal expenses, savings, salary, and membership deleted. User row preserved with anonymized data.

**Sole OWNER (no members)**: Household deleted (cascades invitations), then user anonymized.

**OWNER with members (two-phase):**
1. Owner sends deletion request targeting a member (`POST /users/me/delete-account-request`). Stored in Redis with 7-day TTL (3 keys: `delete_request:{id}`, `delete_request_owner:{ownerId}`, `delete_request_target:{targetId}`).
2. Target accepts or rejects (`POST /users/me/delete-account-request/:id/respond`).
   - **Accept**: Target becomes OWNER. Old owner's data deleted, account anonymized.
   - **Reject**: Entire household deleted, owner anonymized.

**Anonymization replaces**:
- Email: `deleted_{uuid}@deleted.invalid`
- Password: re-hashed random value
- firstName: `"Deleted"`
- lastName: `"Account"`
- `deletedAt`: set to current timestamp

The user row is preserved for referential integrity (foreign keys from expenses, settlements, approvals). All sessions invalidated on deletion.

---

## OWASP Top 10 Coverage

| OWASP Category | Coverage |
|---------------|----------|
| A01 Broken Access Control | Global JWT guard (opt-out). Membership-first authorization. Server-derived identity. |
| A02 Cryptographic Failures | Argon2id password hashing. JWT HS256 with configurable secrets. |
| A03 Injection | Prisma parameterized queries. Zero raw SQL. |
| A04 Insecure Design | Approval workflow for shared mutations. Rate limiting on auth endpoints. |
| A05 Security Misconfiguration | Swagger disabled in production. Whitelist validation. Error messages sanitized. |
| A06 Vulnerable Components | Dependencies at current versions. Node.js 24 LTS. |
| A07 Auth Failures | Enumeration prevention. Token rotation. Session invalidation. Block durations. |
| A08 Data Integrity Failures | Input validation at DTO and DB level. Prisma $transaction for atomic operations. |
| A09 Logging Failures | Pino structured logging with request ID correlation. Sensitive field redaction. |
| A10 SSRF | No outbound HTTP calls from user input. |

---

## Pre-Production Hardening Checklist

| Item | Status | Notes |
|------|--------|-------|
| Redis TLS encryption | Done | Controlled via `REDIS_TLS=true` env var. Set on Render when Redis runs on separate host. |
| Docker port binding to localhost | Done | `127.0.0.1:${REDIS_PORT:-6379}:6379` in docker-compose.yml. |
| ioredis retry/reconnect strategy | Done | `retryStrategy`, `maxRetriesPerRequest`, `reconnectOnError`, error/reconnecting handlers in redis.module.ts. |
| Disable dangerous Redis commands | Pending | `FLUSHALL`, `FLUSHDB`, `CONFIG`, `DEBUG` still enabled. Use `rename-command` or Redis 7 ACLs in production. |
