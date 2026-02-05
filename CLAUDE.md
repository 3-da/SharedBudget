# Claude Code Guidelines for SharedBudget

This file contains **process rules** for Claude Code when working on this project.

> **Related documentation (read only when needed for the current task):**
> - `SPEC.md` — Business requirements, user stories, feature specs, API endpoints
> - `ARCHITECTURE.md` — Tech stack, data model, project structure, caching, Docker, CI/CD
> - `docs/CONCEPTS.md` — Educational guide: Logger, Redis, Swagger explained

---

## ⚠️ Mandatory Rules (ALWAYS follow these)

### 1. Unit Tests Are NOT Optional
Every piece of new code that contains logic **MUST** have unit tests written **immediately** — not later, not in a follow-up PR.

- Write tests right after writing the service method (before moving to the controller)
- If you create a new service method → write its `.spec.ts` tests before proceeding
- If you modify an existing method → update or add tests covering the change
- Only skip tests for pure boilerplate with zero logic (module imports, re-exports)

### 2. Every Service Must Have a Logger
Every service class must include:
```typescript
private readonly logger = new Logger(ServiceName.name);
```
Log meaningful events at appropriate levels. See the Logging Standards section below.

### 3. Every Endpoint Must Have Swagger Documentation
Every controller endpoint must use composite decorators that include Swagger metadata. See the Swagger Standards section below.

### 4. Think Before You Code
Before implementing, ask yourself:
- Does this need tests? → **Yes, almost always.**
- Does this need logging? → **Yes, if it's a service with business logic.**
- Does this need Swagger docs? → **Yes, if it's a controller endpoint.**

---

## Development Workflow

When implementing new functionality, follow this exact order:

### Step 1: Service Implementation
- Write the service method with business logic
- Add appropriate logging (see Logging Standards)
- **Immediately write unit tests** for this method (see Unit Test Standards)

### Step 2: Controller Endpoint
- Add the controller endpoint
- Use custom composite decorators (e.g., `@LoginEndpoint()`) that bundle:
  - HTTP method and route
  - Swagger documentation (`@ApiOperation`, `@ApiResponse`)
  - Throttling configuration (`@Throttle`)
  - HTTP status code (`@HttpCode`)

### Step 3: DTO Validation
- Create or update DTOs with `@ApiProperty()` decorators
- Add `class-validator` decorators for input validation

### Step 4: Verify
- Run existing tests to make sure nothing is broken
- Ensure new tests pass

---

## Logging Standards

### Log Levels
| Level   | When to use                          | Example                                                      |
|---------|--------------------------------------|--------------------------------------------------------------|
| `log`   | Successful operations                | `this.logger.log(\`User logged in: ${userId}\`)`             |
| `warn`  | Failed attempts, suspicious activity | `this.logger.warn(\`Failed login attempt: ${email}\`)`       |
| `debug` | Detailed info for debugging          | `this.logger.debug(\`Token refreshed for user: ${userId}\`)` |
| `error` | Exceptions, unexpected failures      | `this.logger.error(\`Database error: ${error.message}\`)`    |

### What NOT to log
- Passwords, tokens, or secrets — **never**
- Full request/response bodies (use nestjs-pino if needed)
- PII beyond what's necessary (prefer userId over email where possible)

---

## Swagger Standards

### DTOs — Always add `@ApiProperty()`
```typescript
@ApiProperty({
    example: 'user@example.com',
    description: 'User email address'
})
@IsEmail()
email: string;
```

### Endpoint Decorators — Use composite decorators
Create composite decorators in `decorators/api-*.decorators.ts`:
```typescript
import { ErrorResponseDto } from '../../common/dto/error-response.dto';

export function MyEndpoint() {
    return applyDecorators(
        Post('route'),
        ApiOperation({ summary: 'Short description', description: 'Detailed description' }),
        ApiResponse({ status: 200, description: 'Success case', type: ResponseDto }),
        ApiResponse({ status: 400, description: 'Validation error', type: ErrorResponseDto }),
        ApiResponse({ status: 401, description: 'Unauthorized', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests', type: ErrorResponseDto }),
        Throttle({ default: { limit: 5, ttl: 60000 } }),
        HttpCode(HttpStatus.OK),
    );
}
```
> **Rule:** Every error `ApiResponse` (4xx, 5xx) **must** include `type: ErrorResponseDto`.
> Success responses use their own DTO. This ensures Swagger shows the full error shape.

---

## Unit Test Standards

### File naming
- `*.spec.ts` for unit tests
- `*.e2e-spec.ts` for end-to-end tests

### Structure — AAA Pattern (Arrange-Act-Assert)
```typescript
describe('ServiceName', () => {
    beforeEach(async () => { /* setup mocks and module */ });

    describe('methodName', () => {
        it('should [expected behavior] when [condition]', async () => {
            // Arrange
            mockDependency.method.mockResolvedValue(value);

            // Act
            const result = await service.method(input);

            // Assert
            expect(result).toBe(expected);
            expect(mockDependency.method).toHaveBeenCalledWith(expectedArgs);
        });
    });
});
```

### Test cases to always include
1. **Happy path** — successful operation
2. **Validation failures** — invalid input
3. **Not found** — resource doesn't exist
4. **Unauthorized** — invalid credentials/tokens
5. **Security** — enumeration prevention (same response for exists/not exists)
6. **Boundary values (Grenzwert)** — test at the exact edges of valid ranges
   - DTO fields with `@MinLength`/`@MaxLength`: test at min, at max, and one beyond each
   - Numeric boundaries: test `members.length === maxMembers` (at-limit) and `maxMembers - 1` (one-below)
   - Include: empty strings, whitespace-only, extremely long inputs
7. **Error message assertions** — always assert the exact message string, not just exception type
   - Every `rejects.toThrow(ExceptionType)` MUST also verify the message text
   - Pattern: `rejects.toThrow('Exact user-facing message')`
   - This prevents regressions in user-facing error text
8. **Edge cases** — unusual but valid states
   - Self-referential actions (user targeting themselves)
   - Empty collections (no members, no invitations)
   - Race-condition guards (user already joined between check and action)

### DTO Validation Tests
Only test DTOs that contain **validation** (`class-validator` decorators) or **transformation** (`class-transformer` decorators) logic. Skip tests for data-only DTOs (response DTOs with only `@ApiProperty()`).

**When to test:** DTO imports from `class-validator` or `class-transformer`
**When to skip:** DTO only imports from `@nestjs/swagger` (pure data shape)

Test `class-validator` rules directly by transforming and validating plain objects:
```typescript
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

describe('MyDto', () => {
    it('should reject when name is too short', async () => {
        const dto = plainToInstance(MyDto, { name: '' });
        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].constraints).toHaveProperty('minLength');
    });

    it('should accept when name is at minimum length', async () => {
        const dto = plainToInstance(MyDto, { name: 'AB' }); // @MinLength(2)
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
    });
});
```

---

## Code Style

### Services
- One responsibility per method
- Use dependency injection
- Private helper methods for reusable logic
- Return typed responses (DTOs or interfaces)

### Method Comments — Required for Non-Obvious Methods
If a service method's purpose is **not immediately clear** from its name alone, add a full JSDoc comment with these sections:

1. **What it does** — One-liner describing the action and who can perform it
2. **Use case** — When and why this method is called (the flow it belongs to)
3. **Scenario** — A concrete story using the **recurring cast** (see below), so flows are easy to follow across the entire codebase
4. **`@param`** — Every parameter with a short description
5. **`@returns`** — What the method returns on success
6. **`@throws`** — Every exception the method can throw, **in the same order as the validation checks** in the code

Skip comments for self-explanatory CRUD (e.g., `create`, `getById`, `delete`).

#### Recurring Cast
Use these names **consistently** in all JSDoc scenarios throughout the app:

| Name       | Role      | Description                                                       |
|------------|-----------|-------------------------------------------------------------------|
| **Alex**   | OWNER     | The household creator and administrator                           |
| **Sam**    | MEMBER    | A household member (joined via code or invitation)                |
| **Jordan** | OUTSIDER  | A registered user not yet in any household (invitee, applicant)   |

```typescript
/**
 * Transfers the OWNER role from the current owner to another member.
 * The current owner becomes a regular MEMBER. Both users must belong
 * to the same household.
 *
 * Use case: Required before the owner can leave a non-empty household.
 * Allows the household to change hands without disbanding.
 *
 * Scenario: Alex no longer manages finances and wants to hand off
 * control. Alex transfers ownership to Sam — Sam becomes the new
 * OWNER and Alex becomes a MEMBER who can now leave freely.
 *
 * @param ownerId - The ID of the authenticated user (must be current OWNER)
 * @param targetUserId - The ID of the member receiving ownership
 * @returns The updated household with new roles reflected in the member list
 * @throws {NotFoundException} If the owner is not a member of any household
 * @throws {ForbiddenException} If the caller is not the household OWNER
 * @throws {ForbiddenException} If the owner tries to transfer to themselves
 * @throws {NotFoundException} If the target user is not in the same household
 */
```

### Error Handling
- Use NestJS built-in exceptions (`UnauthorizedException`, `ForbiddenException`, etc.)
- Don't expose internal errors to clients
- Log errors before throwing
- A global `HttpExceptionFilter` (registered via `APP_FILTER` in `app.module.ts`) catches **all** exceptions and returns a consistent shape with `timestamp` and `requestId` — services do NOT need to handle this themselves
- Services should still throw specific `HttpException` subclasses with clear messages — the filter passes them through as-is
- Prisma errors that slip through uncaught are mapped automatically (P2002 → 409, P2025 → 404)

### Security Checklist
- [ ] Hash passwords with argon2
- [ ] Use constant-time comparison for tokens
- [ ] Don't reveal if email exists (enumeration prevention)
- [ ] Invalidate sessions on password change
- [ ] Rate limit sensitive endpoints
- [ ] Redact sensitive data in logs

### Pre-Production Checklist — Redis Hardening
These are **not blockers for development** but **must be resolved before production deployment**.

- [ ] **Enable TLS encryption** — `redis.module.ts` connects without TLS (`new Redis({...})` has no `tls` option). Add `tls: {}` to ioredis config and configure Redis server with certificates. Critical if Redis runs on a separate host.
- [ ] **Bind Docker port to localhost only** — `docker-compose.yml` maps `${REDIS_PORT:-6379}:6379` which binds to `0.0.0.0`. Change to `127.0.0.1:${REDIS_PORT:-6379}:6379` or remove the port mapping entirely and use Docker internal networking.
- [ ] **Add ioredis retry/reconnect strategy** — `redis.module.ts` creates the client with no `retryStrategy`, `maxRetriesPerRequest`, or error handling. Add reconnect config so the app survives brief Redis outages instead of throwing unhandled errors.
- [ ] **Disable dangerous Redis commands** — The Redis server allows `FLUSHALL`, `FLUSHDB`, `CONFIG`, `DEBUG` by default. Use `rename-command` in `redis.conf` or Redis 7 ACLs to disable them in production.

---

## Quick Reference

### Redis Key Patterns
| Pattern                  | Purpose                      | TTL    |
|--------------------------|------------------------------|--------|
| `verify:{email}`         | Email verification code      | 10 min |
| `reset:{token}`          | Password reset token         | 1 hour |
| `refresh:{token}`        | Refresh token → userId       | 7 days |
| `user_sessions:{userId}` | Set of user's refresh tokens | 7 days (refreshed on new token) |

### Environment Variables
```env
# Auth TTLs (seconds)
AUTH_VERIFICATION_CODE_TTL=600      # 10 min
AUTH_REFRESH_TOKEN_TTL=604800       # 7 days
AUTH_RESET_TOKEN_TTL=3600           # 1 hour

# JWT
JWT_ACCESS_SECRET=<secret>
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_SECRET=<secret>

# Argon2
ARGON2_MEMORY_COST=65536
ARGON2_TIME_COST=3
ARGON2_PARALLELISM=1

# Household
HOUSEHOLD_MAX_MEMBERS=2
INVITE_CODE_LENGTH=8
```

### Project Structure
```
backend/src/
├── auth/
│   ├── decorators/     # Custom decorators (endpoint, param)
│   ├── dto/            # Request/Response DTOs (8 DTOs)
│   ├── guards/         # Auth guards (JWT)
│   ├── strategies/     # Passport strategies (JWT)
│   ├── auth.controller.ts
│   ├── auth.controller.spec.ts
│   ├── auth.service.ts
│   ├── auth.service.spec.ts
│   └── auth.module.ts
├── household/
│   ├── decorators/     # Composite endpoint decorators (10 decorators)
│   ├── dto/            # Request/Response DTOs (7 DTOs)
│   ├── household.controller.ts
│   ├── household.controller.spec.ts
│   ├── household.service.ts               # CRUD + membership (join by code, leave, remove, transfer)
│   ├── household.service.spec.ts
│   ├── household-invitation.service.ts    # Email invitation lifecycle (invite, respond, cancel)
│   ├── household-invitation.service.spec.ts
│   └── household.module.ts
├── user/
│   ├── decorators/     # Composite endpoint decorators (3 decorators)
│   ├── dto/            # DTOs (update-profile, change-password, user-profile-response)
│   ├── user.controller.ts                 # 3 endpoints (get profile, update, change password)
│   ├── user.controller.spec.ts
│   ├── user.service.ts
│   ├── user.service.spec.ts
│   └── user.module.ts
├── salary/
│   ├── decorators/     # Composite endpoint decorators (4 decorators)
│   ├── dto/            # DTOs (upsert-salary, salary-response)
│   ├── salary.controller.ts               # 4 endpoints (get my, upsert, household, by month)
│   ├── salary.controller.spec.ts
│   ├── salary.service.ts
│   ├── salary.service.spec.ts
│   └── salary.module.ts
├── personal-expense/
│   ├── decorators/     # Composite endpoint decorators (5 decorators)
│   ├── dto/            # DTOs (create, update, list-query, response)
│   ├── personal-expense.controller.ts     # 5 endpoints (list, create, get, update, delete)
│   ├── personal-expense.controller.spec.ts
│   ├── personal-expense.service.ts
│   ├── personal-expense.service.spec.ts
│   └── personal-expense.module.ts
├── shared-expense/
│   ├── decorators/     # Composite endpoint decorators (5 decorators)
│   ├── dto/            # DTOs (create, update, list-query, response)
│   ├── shared-expense.controller.ts       # 5 endpoints (list, get, propose create/update/delete)
│   ├── shared-expense.controller.spec.ts
│   ├── shared-expense.service.ts
│   ├── shared-expense.service.spec.ts
│   └── shared-expense.module.ts
├── approval/
│   ├── decorators/     # Composite endpoint decorators (4 decorators)
│   ├── dto/            # DTOs (accept, reject, list-query, response)
│   ├── approval.controller.ts             # 4 endpoints (list pending, history, accept, reject)
│   ├── approval.controller.spec.ts
│   ├── approval.service.ts                # Approval review logic (accept with transaction, reject)
│   ├── approval.service.spec.ts
│   └── approval.module.ts
├── dashboard/
│   ├── decorators/     # Composite endpoint decorators (4 decorators)
│   ├── dto/            # DTOs (dashboard-response, expense-summary, member-income, member-savings, settlement-response, mark-settlement-paid-response)
│   ├── dashboard.controller.ts            # 4 endpoints (overview, savings, settlement, mark-paid)
│   ├── dashboard.controller.spec.ts
│   ├── dashboard.service.ts               # Financial aggregation, settlement calc, mark-paid
│   ├── dashboard.service.spec.ts
│   └── dashboard.module.ts
├── session/
│   ├── session.service.ts                 # Redis session ops (store, get, remove, invalidate all)
│   ├── session.service.spec.ts
│   └── session.module.ts
├── mail/               # Email service (placeholder — logs in dev)
├── prisma/             # PrismaService with @prisma/adapter-pg
├── redis/              # Redis module + throttler storage
├── generated/          # Auto-generated Prisma client + DTOs (DO NOT EDIT)
└── common/
    ├── dto/            # Shared DTOs (ErrorResponseDto, MessageResponseDto)
    ├── expense/        # Shared expense utilities (ExpenseHelperService, mappers)
    ├── filters/        # Global exception filter (HttpExceptionFilter)
    ├── logger/         # Pino logger config with sensitive data redaction
    └── utils/          # Utility functions (pickDefined)
```
