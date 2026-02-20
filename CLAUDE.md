# Claude Code Guidelines for SharedBudget

This file contains **process rules** for Claude Code when working on this project.

> **Related documentation (read only when needed for the current task):**
> - `PROJECT_INDEX.md` — Project overview, API endpoints, structure, commands
> - `SPEC.md` — Business requirements, user stories, feature specs
> - `ARCHITECTURE.md` — Tech stack, data model, caching, auth flow, infrastructure
> - `docs/FRONTEND_ARCHITECTURE.md` — Frontend deep-dive (15 sections, interview-ready)
> - `docs/backend/01-08` — Backend deep-dive (8 documents: database, auth, architecture, approvals, caching, API, security, testing)

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
| **Riley**  | DELETED   | A user whose account has been anonymized (for deletion scenarios) |

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

### Redis-Based Workflows
Some features use Redis for temporary state instead of database tables:
- **Email verification codes:** `verify:{email}` with 10-min TTL
- **Password reset tokens:** `reset:{token}` with 1-hour TTL
- **Account deletion requests:** `delete_request:{id}` with 7-day TTL (3 keys per request)

Pattern: Store JSON payload with TTL, use pipeline for atomic multi-key writes, clean up all related keys on resolution.

### Security Checklist
- [ ] Hash passwords with argon2
- [ ] Use constant-time comparison for tokens
- [ ] Don't reveal if email exists (enumeration prevention)
- [ ] Invalidate sessions on password change
- [ ] Rate limit sensitive endpoints
- [ ] Redact sensitive data in logs

### Pre-Production Checklist — Redis Hardening
These are **not blockers for development** but **must be resolved before production deployment**.

- [x] **Enable TLS encryption** — Controlled via `REDIS_TLS=true` env var (defaults to `false`). Set `REDIS_TLS=true` on Render when Redis runs on a separate host with TLS. Docker Compose keeps `REDIS_TLS=false`.
- [x] **Bind Docker port to localhost only** — `docker-compose.yml` binds Redis to `127.0.0.1:${REDIS_PORT:-6379}:6379`.
- [x] **Add ioredis retry/reconnect strategy** — `redis.module.ts` has `retryStrategy`, `maxRetriesPerRequest`, `reconnectOnError`, and `error`/`reconnecting` event handlers.
- [ ] **Disable dangerous Redis commands** — The Redis server allows `FLUSHALL`, `FLUSHDB`, `CONFIG`, `DEBUG` by default. Use `rename-command` in `redis.conf` or Redis 7 ACLs to disable them in production.

---

## Quick Reference

> For project structure, API endpoints, and commands see [`PROJECT_INDEX.md`](./PROJECT_INDEX.md).
> For data model, environment variables, and Redis key patterns see [`ARCHITECTURE.md`](./ARCHITECTURE.md).
