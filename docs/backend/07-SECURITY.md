# Security Measures

This document maps every security threat the SharedBudget backend defends against, the specific countermeasures implemented, and the known gaps that must be addressed before production deployment. It is designed so that every section can answer the interview question: "How does your app handle X?"

---

## 1. Threat Model

I organized the threat model around the six attack categories most relevant to a financial household app. For each threat, I list the attack scenario, the countermeasure, and the source file implementing it.

### 1.1 Credential Theft and Brute Force

**Attack:** An attacker submits thousands of email/password combinations against `POST /auth/login` to find valid credentials.

**Countermeasures:**

**Argon2id password hashing.** I chose Argon2id because it won the Password Hashing Competition (PHC) in 2015 and is the current OWASP recommendation. Argon2id is memory-hard (requires significant RAM per hash computation), making GPU-based attacks prohibitively expensive. Unlike bcrypt, which only measures CPU cost, Argon2id's `memoryCost` parameter directly controls RAM requirements per hash attempt.

```typescript
// Password hashing (simplified from auth.service.ts)
const hash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,    // 64 MB per hash
    timeCost: 3,          // 3 iterations
    parallelism: 4,       // 4 threads
});
```

Parameters are configurable via environment variables, allowing adjustment as hardware improves without code changes.

> **Source files:** `backend/src/auth/auth.service.ts`

**Rate limiting.** Auth endpoints have the strictest rate limits in the system:

| Endpoint | Limit | Block Duration |
|----------|-------|----------------|
| Login | 5 per 60s | 300s (5 min) |
| Register | 3 per 60s | 600s (10 min) |
| Reset password | 5 per 60s | 300s (5 min) |
| Forgot password | 3 per 600s | — |

The `blockDuration` is the key defense. After 5 failed login attempts in 60 seconds, the IP is blocked for 5 full minutes. A brute-force attacker can try at most 5 passwords per 5 minutes = 60 passwords per hour, making dictionary attacks impractical.

> **Source files:** `backend/src/auth/decorators/api-auth.decorators.ts`

**Constant-time comparison.** Argon2's `verify()` function performs constant-time comparison internally. This prevents timing attacks where an attacker measures response time differences between "wrong first character" and "wrong last character" to reconstruct the password hash.

### 1.2 Enumeration Prevention

**Attack:** An attacker probes `POST /auth/login` and `POST /auth/forgot-password` to discover which email addresses have registered accounts.

**Countermeasures:**

**Identical error messages.** The login endpoint returns `"Invalid email or password"` for both "email not found" and "wrong password" cases. The attacker cannot distinguish between:

```
Request:  { email: "exists@example.com",   password: "wrong" }
Response: { message: "Invalid email or password" }

Request:  { email: "noexist@example.com",  password: "anything" }
Response: { message: "Invalid email or password" }
```

**Silent forgot-password.** `POST /auth/forgot-password` always returns `"If an account with this email exists, a password reset link has been sent."` regardless of whether the email is registered. An attacker cannot distinguish between a valid and invalid email.

**Constant-time behavior.** Even when the email doesn't exist, the server performs a dummy Argon2 hash computation to prevent timing-based enumeration. Without this, "email not found" would return in 1ms while "wrong password" would take 200ms (the time to hash and compare), revealing which emails are registered.

> **Source files:** `backend/src/auth/auth.service.ts` — see login and forgotPassword methods

### 1.3 Session Hijacking

**Attack:** An attacker steals a JWT access token (from a compromised client, XSS, or network sniffing) and uses it to impersonate the user.

**Countermeasures:**

**Short-lived access tokens (15 minutes).** If an access token is stolen, it expires in 15 minutes. The blast radius is limited to 15 minutes of unauthorized access.

**Server-side refresh token storage.** Refresh tokens are stored in Redis with a 7-day TTL. When a user calls `POST /auth/refresh`, the old refresh token is deleted from Redis and a new one is issued (token rotation). A stolen refresh token can only be used once — the second use fails because the original has been deleted.

**Session invalidation on password change.** When a user changes their password, `SessionService.invalidateAllSessions()` deletes every refresh token in Redis for that user. All active sessions across all devices are immediately terminated. The attacker's stolen token becomes worthless.

**Explicit logout.** `POST /auth/logout` deletes the refresh token from Redis. This is server-side invalidation, not just "delete the token from the client." Even if the client fails to delete its local copy, the server rejects any refresh attempt.

> **Source files:** `backend/src/session/session.service.ts`, `backend/src/auth/auth.service.ts`

### 1.4 Mass Assignment / Property Injection

**Attack:** An attacker sends extra fields in a request body to modify properties they shouldn't:

```json
POST /expenses/personal
{
    "name": "Rent",
    "amount": 500,
    "householdId": "attacker-household-id",
    "userId": "admin-user-id",
    "isAdmin": true
}
```

**Countermeasures:**

**ValidationPipe with `whitelist: true`.** This is the single most important security setting in `main.ts`:

```typescript
// backend/src/main.ts
app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
```

`whitelist: true` strips any property that is not decorated with a `class-validator` decorator in the DTO. The extra `householdId`, `userId`, and `isAdmin` fields are silently discarded because they don't exist on `CreatePersonalExpenseDto`. The DTO acts as an **explicit allowlist** — only declared properties pass through.

**Server-derived identity.** The `userId` and `householdId` are never taken from the request body. They are derived from:
- `userId`: extracted from the JWT token's `sub` claim by `JwtStrategy.validate()`
- `householdId`: looked up from the database via `ExpenseHelperService.requireMembership(userId)`

Even if an attacker could inject these fields past the DTO whitelist, the service layer ignores them and uses server-derived values.

### 1.5 SQL Injection

**Attack:** An attacker injects SQL code through input fields:

```json
{ "name": "'; DROP TABLE expenses; --" }
```

**Countermeasure:**

**Prisma parameterized queries.** Prisma ORM uses parameterized queries by design. There is no string concatenation in any database query in the entire codebase. The Prisma client generates SQL like:

```sql
SELECT * FROM "Expense" WHERE "name" = $1
```

The `$1` placeholder is filled by the database driver, not by string interpolation. SQL injection is structurally impossible — not prevented by careful coding, but by architecture. There are zero uses of raw SQL in the codebase.

> **Source files:** All service files use `this.prisma.modelName.method()`, never raw SQL

### 1.6 Insecure Direct Object Reference (IDOR)

**Attack:** An attacker changes the expense ID in a URL to access another household's expenses:

```
GET /expenses/shared/other-household-expense-id
```

**Countermeasure:**

**Membership-first authorization.** Every service method that touches shared resources calls `ExpenseHelperService.requireMembership(userId)` as its **first operation**. This function:

1. Looks up the user's household membership from the database
2. Returns the `householdId` if the user is a member
3. Throws `NotFoundException` if the user has no household

All subsequent database queries use this server-derived `householdId`:

```typescript
// Pattern used in every shared resource service
const membership = await this.expenseHelper.requireMembership(userId);
const expenses = await this.prisma.expense.findMany({
    where: {
        householdId: membership.householdId,  // Server-derived, not from request
        type: ExpenseType.SHARED,
        deletedAt: null,
    },
});
```

Users never pass a `householdId` in any request. It is always derived from their authenticated identity. Even if an attacker knows another household's expense ID, the query `WHERE householdId = attacker-household-id AND id = other-expense-id` returns zero results because the expense belongs to a different household.

> **Source files:** `backend/src/common/expense/expense-helper.service.ts`

### 1.7 Cross-Site Request Forgery (CSRF)

**Attack:** A malicious website makes authenticated requests to the SharedBudget API using the victim's browser cookies.

**Why CSRF is not applicable:**

SharedBudget uses JWT bearer tokens, not cookies. The access token is stored in JavaScript memory (a variable), not in a cookie. The browser does not automatically attach it to cross-origin requests. An attacker's website cannot read the token from memory of a different origin.

CORS is restricted to a single configurable origin:

```typescript
// backend/src/main.ts
app.enableCors({ origin: corsOrigin, credentials: true });
```

The browser enforces CORS by rejecting preflight requests from unauthorized origins.

### Interview Questions This Section Answers
- "What threats does your application defend against?"
- "How do you prevent brute-force attacks on login?"
- "How do you prevent email enumeration?"
- "What happens if a JWT token is stolen?"
- "How do you prevent users from accessing other households' data?"
- "Is your application vulnerable to SQL injection?"
- "Why don't you need CSRF protection?"

---

## 2. Input Validation and Sanitization

### 2.1 Defense in Depth

Input validation occurs at three layers:

| Layer | Technology | What It Catches |
|-------|-----------|-----------------|
| DTO validation | class-validator | Type mismatches, missing required fields, out-of-range values |
| Whitelist stripping | ValidationPipe `whitelist: true` | Unknown/extra fields (mass assignment) |
| Database constraints | Prisma schema + PostgreSQL | Unique violations, foreign key violations, enum mismatches |

Each layer catches different classes of errors. DTO validation is the primary defense and catches most invalid input before it reaches the service layer. Database constraints are the last line of defense, catching edge cases that slip through application logic (e.g., race conditions on unique constraints).

### 2.2 Validation Decorator Stack

Every input DTO field has both Swagger and validation decorators. Here's the full pattern from the most complex DTO:

```typescript
// backend/src/shared-expense/dto/create-shared-expense.dto.ts
@ApiProperty({ example: 'Monthly Rent', description: 'Expense name', minLength: 1, maxLength: 100 })
@IsString()
@IsNotEmpty()
@MinLength(1)
@MaxLength(100)
name: string;

@ApiProperty({ example: 500.0, description: 'Amount in EUR', minimum: 1 })
@IsNumber()
@Min(1)
amount: number;

@ApiProperty({ enum: ExpenseCategory, example: 'RECURRING' })
@IsEnum(ExpenseCategory)
category: ExpenseCategory;
```

The validation decorators provide:
- **Type checking**: `@IsString()`, `@IsNumber()`, `@IsInt()`, `@IsEnum()`
- **Presence checking**: `@IsNotEmpty()`, `@IsOptional()`
- **Range checking**: `@Min()`, `@Max()`, `@MinLength()`, `@MaxLength()`
- **Format checking**: `@IsEmail()`, `@IsUUID()`
- **Conditional checking**: `@ValidateIf()` for context-dependent fields

### 2.3 Enum Validation

Enums are validated at both compile time (TypeScript) and runtime (class-validator):

```typescript
@IsEnum(ExpenseCategory)
category: ExpenseCategory;
```

The `ExpenseCategory` enum is auto-generated by Prisma from the database schema. This creates a single source of truth: `schema.prisma` → Prisma enum → TypeScript type → `@IsEnum()` validation. If a new category is added to the schema, the TypeScript compiler catches any code that doesn't handle it.

### 2.4 Validation Error Response Shape

When validation fails, the global `HttpExceptionFilter` formats the response consistently:

```json
{
    "statusCode": 400,
    "message": [
        "name must be longer than or equal to 1 characters",
        "amount must not be less than 1",
        "category must be one of the following values: RECURRING, ONE_TIME"
    ],
    "error": "Bad Request",
    "timestamp": "2026-02-14T12:00:00.000Z",
    "requestId": "abc-123-def"
}
```

The `message` field is an array when multiple validations fail simultaneously. The frontend can display all errors at once, improving the user experience (vs. fixing one error at a time).

### Interview Questions This Section Answers
- "How do you validate user input?"
- "What happens if a client sends extra fields in the request body?"
- "How do you handle enum validation?"
- "What does defense in depth mean in the context of input validation?"

---

## 3. Error Handling Security

### 3.1 The Global Exception Filter

All errors pass through a single `HttpExceptionFilter` registered globally via `APP_FILTER`:

```typescript
// backend/src/common/filters/http-exception.filter.ts
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(HttpExceptionFilter.name);

    catch(exception: unknown, host: ArgumentsHost): void {
        const requestId: string = request.id ?? 'unknown';
        const { statusCode, message, error } = this.resolveException(exception);
        httpAdapter.reply(ctx.getResponse(),
            { statusCode, message, error, timestamp, requestId },
            statusCode
        );
    }
}
```

The `@Catch()` decorator with no arguments catches **everything** — HttpExceptions, Prisma errors, plain Error objects, even thrown strings. Nothing escapes unhandled.

### 3.2 Three Exception Categories

The filter classifies exceptions into three categories:

**Category 1: HttpException (application-thrown errors).** These are intentional errors thrown by service code using NestJS exceptions (`NotFoundException`, `ForbiddenException`, etc.). The filter passes through the original status code and message because the developer chose them deliberately.

**Category 2: PrismaClientKnownRequestError (database constraint violations).** These are errors that Prisma throws when database constraints are violated. The filter maps them to safe HTTP responses:

| Prisma Code | Meaning | HTTP Response | Message |
|-------------|---------|---------------|---------|
| P2002 | Unique constraint violation | 409 Conflict | "A record with this value already exists" |
| P2025 | Record not found | 404 Not Found | "Record not found" |
| All others | Various DB errors | 500 Internal Server Error | "Internal server error" |

The **critical security detail**: Prisma's original error message (e.g., `"Unique constraint failed on the constraint: Expense_name_householdId_key"`) reveals the database schema — table names, column names, constraint names. The filter replaces it with a generic message. The original is logged server-side for debugging.

**Category 3: Unknown errors (everything else).** Any uncaught exception that isn't an HttpException or PrismaError gets a generic 500 response. The error is logged with its full stack trace server-side, but the client only sees:

```json
{
    "statusCode": 500,
    "message": "Internal server error",
    "error": "Internal Server Error"
}
```

No stack traces, no class names, no file paths. The `requestId` field allows correlating the client error with server logs for debugging, without exposing server internals.

### 3.3 Consistent Error Shape

Every error response in the system has the same shape (the `ErrorResponseDto`):

```typescript
// backend/src/common/dto/error-response.dto.ts
{
    statusCode: number;           // HTTP status code
    message: string | string[];   // Error message(s)
    error: string;                // HTTP error name
    timestamp: string;            // ISO 8601 timestamp
    requestId: string;            // UUID for log correlation
}
```

This consistency allows the frontend to parse every error with a single handler. The `message` field is a `string | string[]` union because ValidationPipe returns an array of validation errors while other exceptions return a single string.

### 3.4 Structured Logging

I use `nestjs-pino` for structured JSON logging with several security-relevant features:

- **Request ID correlation**: Every log entry includes the request ID, enabling end-to-end tracing without exposing the ID mechanism to clients.
- **Sensitive field redaction**: The Pino configuration redacts fields like `password`, `token`, and `authorization` from log output.
- **Error-level logging**: Unknown errors and unmapped Prisma errors are logged at error level, triggering alerting in production.
- **No stack traces in responses**: Stack traces appear only in server logs, never in HTTP responses.

### Interview Questions This Section Answers
- "How does your application handle errors?"
- "What information do error responses reveal to clients?"
- "How do you prevent database schema leakage through error messages?"
- "How do you correlate client errors with server logs?"

---

## 4. Authorization Model

### 4.1 Authentication: Opt-Out, Not Opt-In

The `JwtAuthGuard` is registered as a global guard in `AppModule`. **Every endpoint requires authentication by default.** Endpoints that should be publicly accessible use the `@Public()` custom decorator to bypass the guard:

```typescript
@Public()
@LoginEndpoint()
login(@Body() dto: LoginDto) { ... }
```

This is a deliberate inversion. In an opt-in model (add `@UseGuards(JwtAuthGuard)` to protected endpoints), forgetting the decorator creates an unauthenticated endpoint — a security vulnerability. In opt-out mode, forgetting `@Public()` makes an endpoint too restrictive — annoying, but not a security hole.

### 4.2 Role-Based Authorization

There are two roles: `OWNER` (household creator) and `MEMBER` (joined via invite). Role checks are performed **in service methods**, not in guards:

```typescript
// Example: only OWNER can remove members
if (membership.role !== HouseholdRole.OWNER) {
    throw new ForbiddenException('Only the household owner can remove members');
}
```

I chose in-service role checks over guard-based authorization because the authorization logic is context-dependent. For example, "leave household" is allowed for any member, but the OWNER must transfer ownership first. This conditional logic doesn't fit cleanly into a generic `@Roles('OWNER')` guard.

### 4.3 403 vs. 401 Semantics

The application uses these HTTP status codes precisely:

| Code | Meaning | Example |
|------|---------|---------|
| 401 Unauthorized | Identity unknown (no token, expired token, invalid token) | Missing or expired JWT |
| 403 Forbidden | Identity known, but action not permitted | MEMBER tries to remove another MEMBER |

This distinction helps the frontend decide whether to redirect to login (401) or show a permission error (403).

### Interview Questions This Section Answers
- "How do you handle authorization?"
- "Why are role checks in services instead of guards?"
- "What's the difference between 401 and 403 in your application?"
- "How do you ensure new endpoints are authenticated by default?"

---

## 5. Pre-Production Hardening Checklist

These are documented, known items that demonstrate security awareness. I framed them as a checklist rather than hiding them because acknowledging security gaps is better than ignoring them.

### 5.1 Redis TLS Encryption

**Current state:** The Redis connection in `redis.module.ts` uses unencrypted TCP. Data in transit (session tokens, cached responses, rate limit counters) can be read by anyone with network access.

**Fix:** Add `tls: {}` to the ioredis configuration. Requires Redis server to be configured with TLS certificates.

**Risk level:** Critical if Redis runs on a separate host. Low risk if Redis runs on localhost or within Docker internal networking (same machine).

### 5.2 Docker Port Binding

**Current state:** `docker-compose.yml` maps Redis port as `${REDIS_PORT:-6379}:6379`, which binds to `0.0.0.0` (all network interfaces). The Redis port is accessible from the network.

**Fix:** Change to `127.0.0.1:${REDIS_PORT:-6379}:6379` or remove the port mapping entirely and use Docker internal networking. Application containers connect via Docker's internal DNS, so external port binding is unnecessary.

### 5.3 ioredis Retry Strategy

**Current state:** The Redis client has no `retryStrategy`, `maxRetriesPerRequest`, or error handling. If Redis goes down briefly (restart, maintenance), the application throws unhandled errors and all requests fail.

**Fix:** Add reconnect configuration:
```typescript
new Redis({
    retryStrategy: (times) => Math.min(times * 100, 3000),
    maxRetriesPerRequest: 3,
    enableOfflineQueue: true,
});
```

### 5.4 Dangerous Redis Commands

**Current state:** The Redis server allows `FLUSHALL`, `FLUSHDB`, `CONFIG`, and `DEBUG` commands. If an attacker gains Redis access, they can wipe all data or reconfigure the server.

**Fix:** Use `rename-command` in `redis.conf` or Redis 7+ ACLs to disable or rename these commands in production.

### Interview Questions This Section Answers
- "What security improvements are needed before going to production?"
- "How would you secure the Redis connection?"
- "What happens if Redis goes down?"

---

## Cross-References

- **Authentication flows (JWT, Argon2, sessions):** [02-AUTH.md](./02-AUTH.md)
- **Request lifecycle and global infrastructure:** [03-BACKEND.md](./03-BACKEND.md)
- **Redis caching and session storage:** [05-CACHING.md](./05-CACHING.md)
- **Rate limiting and DTO validation details:** [06-API.md](./06-API.md)
- **Security test cases (enumeration, boundary values):** [08-TESTING.md](./08-TESTING.md)
