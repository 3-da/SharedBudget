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
export function MyEndpoint() {
    return applyDecorators(
        Post('route'),
        ApiOperation({ summary: 'Short description', description: 'Detailed description' }),
        ApiResponse({ status: 200, description: 'Success case', type: ResponseDto }),
        ApiResponse({ status: 400, description: 'Validation error' }),
        ApiResponse({ status: 401, description: 'Unauthorized' }),
        ApiResponse({ status: 429, description: 'Too many requests' }),
        Throttle({ default: { limit: 5, ttl: 60000 } }),
        HttpCode(HttpStatus.OK),
    );
}
```

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

---

## Code Style

### Services
- One responsibility per method
- Use dependency injection
- Private helper methods for reusable logic
- Return typed responses (DTOs or interfaces)

### Error Handling
- Use NestJS built-in exceptions (`UnauthorizedException`, `ForbiddenException`, etc.)
- Don't expose internal errors to clients
- Log errors before throwing

### Security Checklist
- [ ] Hash passwords with argon2
- [ ] Use constant-time comparison for tokens
- [ ] Don't reveal if email exists (enumeration prevention)
- [ ] Invalidate sessions on password change
- [ ] Rate limit sensitive endpoints
- [ ] Redact sensitive data in logs

---

## Quick Reference

### Redis Key Patterns
| Pattern                  | Purpose                      | TTL    |
|--------------------------|------------------------------|--------|
| `verify:{email}`         | Email verification code      | 10 min |
| `reset:{token}`          | Password reset token         | 1 hour |
| `refresh:{token}`        | Refresh token → userId       | 7 days |
| `user_sessions:{userId}` | Set of user's refresh tokens | No TTL |

### Environment Variables
```env
AUTH_VERIFICATION_CODE_TTL=600
AUTH_REFRESH_TOKEN_TTL=604800
AUTH_RESET_TOKEN_TTL=3600
```

### Project Structure
```
backend/src/
├── auth/
│   ├── decorators/     # Custom decorators (endpoint, param)
│   ├── dto/            # Request/Response DTOs
│   ├── guards/         # Auth guards
│   ├── strategies/     # Passport strategies
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   └── auth.module.ts
├── mail/
├── prisma/
├── redis/
└── common/
    └── logger/         # Pino logger config
```
