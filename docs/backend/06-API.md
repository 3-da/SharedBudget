# REST API Design

This document covers the API layer of SharedBudget: how endpoints are structured, how input is validated before it reaches business logic, how Swagger documentation is generated automatically, and how rate limiting protects against abuse.

---

## 1. API Design Philosophy

### 1.1 RESTful Resources with Pragmatic Deviations

I followed REST conventions where they make sense and deviated where they don't. The general rule: **use nouns for resources, HTTP methods for verbs.**

```
GET    /expenses/personal      → list personal expenses (resource collection)
POST   /expenses/personal      → create a personal expense (create resource)
PUT    /expenses/personal/:id  → update a personal expense (replace resource)
DELETE /expenses/personal/:id  → soft-delete a personal expense
```

But several operations don't map cleanly to CRUD. For these, I used action endpoints:

```
POST /auth/refresh             → exchange refresh token for new access token
POST /household/join           → join household by invite code
POST /household/leave          → leave current household
POST /household/transfer-ownership → transfer OWNER role to another member
```

The alternative — modelling "join" as `POST /household/:id/members` — would require the user to know the household ID, which they don't have yet (they only have an invite code). The action endpoint reflects the actual user intent.

> **Source file:** `backend/src/main.ts`

### 1.2 URL Versioning

Every endpoint is prefixed with `/api/v1`:

```typescript
// backend/src/main.ts
const apiPrefix = configService.get('API_PREFIX', 'api/v1');
app.setGlobalPrefix(apiPrefix);
```

I chose URL-based versioning (`/api/v1`) over header-based versioning (`Accept: application/vnd.sharedbudget.v1+json`) because URL versioning is:
- Visible in browser dev tools and logs
- Easy to route at the load balancer level
- Self-documenting in Swagger

The version is configurable via the `API_PREFIX` environment variable, so a v2 can coexist with v1 during migration.

### 1.3 HTTP Method Semantics

| Method | Semantics in SharedBudget | Idempotent? |
|--------|--------------------------|-------------|
| GET | Read resources. Never mutates. | Yes |
| POST | Create resources or trigger actions (login, join, refresh). | No |
| PUT | Full replacement or **upsert** (salary, savings). POST for actions (withdraw, delete requests). | Yes |
| DELETE | Soft-delete (expenses) or hard-delete (invitations, overrides). | Yes |

**Why all auth endpoints use POST:** Credentials and tokens must never appear in URLs, query strings, or server access logs. `GET /auth/login?email=alex@example.com&password=secret` would leak credentials into browser history, proxy logs, and referrer headers. Every auth endpoint uses POST with a request body.

**Why PUT for upserts:** Salary and savings use PUT semantics (`PUT /salary/me`) because the operation is idempotent — calling it twice with the same data produces the same result. The server creates the record if it doesn't exist, or updates it if it does. This simplifies the client: no need to check existence before deciding between POST and PUT.

### 1.4 CORS Configuration

```typescript
// backend/src/main.ts
const corsOrigin = configService.get('CORS_ORIGIN', 'http://localhost:4200');
app.enableCors({ origin: corsOrigin, credentials: true });
```

CORS is restricted to a single configurable origin. In development, this is the Angular dev server (`localhost:4200`). In production, it would be the deployment domain. The `credentials: true` flag allows the browser to send cookies (not currently used, but ready for future cookie-based auth if needed).

### Interview Questions This Section Answers
- "Why did you prefix all routes with /api/v1?"
- "When did you deviate from REST conventions and why?"
- "Why are all auth endpoints POST instead of GET?"
- "Why use PUT for salary upserts instead of POST for create and PATCH for update?"

---

## 2. Endpoint Inventory

SharedBudget has **54 endpoints across 11 controllers**. Every endpoint requires JWT authentication except the 8 auth endpoints marked with `@Public()`.

### 2.1 Authentication (8 endpoints)

| Method | Path | Purpose | Auth | Throttle |
|--------|------|---------|------|----------|
| POST | `/auth/register` | Register new user, send verification code | Public | 3/60s, block 600s |
| POST | `/auth/verify-code` | Verify email with 6-digit code, auto-login | Public | 5/60s, block 300s |
| POST | `/auth/resend-code` | Resend verification code | Public | 3/600s |
| POST | `/auth/login` | Authenticate, return JWT tokens | Public | 5/60s, block 300s |
| POST | `/auth/refresh` | Exchange refresh token for new tokens | Public | 30/60s |
| POST | `/auth/logout` | Invalidate refresh token in Redis | Public | 30/60s |
| POST | `/auth/forgot-password` | Send password reset email | Public | 3/600s |
| POST | `/auth/reset-password` | Reset password using token from email | Public | 5/60s, block 300s |

Auth endpoints have the strictest rate limits. Registration and forgot-password are limited to 3 requests per 60 seconds (or 10 minutes) because they trigger emails. Login allows 5 attempts before a 5-minute block — enough for typos but not enough for brute force.

### 2.2 Household (11 endpoints)

| Method | Path | Purpose | Role |
|--------|------|---------|------|
| POST | `/household` | Create household | Any |
| GET | `/household/mine` | Get my household with members | Any |
| POST | `/household/regenerate-code` | Generate new invite code | OWNER |
| POST | `/household/invite` | Invite user by email | OWNER |
| GET | `/household/invitations/pending` | List my pending invitations | Any |
| POST | `/household/invitations/:id/respond` | Accept or decline invitation | Any |
| DELETE | `/household/invitations/:id` | Cancel sent invitation | OWNER |
| POST | `/household/join` | Join household by invite code | Any |
| POST | `/household/leave` | Leave household | MEMBER |
| DELETE | `/household/members/:userId` | Remove member | OWNER |
| POST | `/household/transfer-ownership` | Transfer OWNER role | OWNER |

The household controller is the largest because household management has the most distinct operations. Notice that "leave" and "remove" are separate endpoints even though both result in membership deletion — they have different authorization rules (any member can leave, only OWNER can remove others) and different side effects (OWNER cannot leave without first transferring ownership).

### 2.3 User (8 endpoints)

| Method | Path | Purpose | Role |
|--------|------|---------|------|
| GET | `/users/me` | Get own profile | - |
| PUT | `/users/me` | Update profile (name) | - |
| PUT | `/users/me/password` | Change password | - |
| DELETE | `/users/me` | Delete account (anonymizes user data) | - |
| POST | `/users/me/delete-account-request` | Request account deletion (owner with members) | OWNER |
| GET | `/users/me/pending-delete-requests` | List pending deletion requests targeting me | - |
| POST | `/users/me/delete-account-request/:id/respond` | Accept or reject deletion request | - |
| DELETE | `/users/me/delete-account-request` | Cancel pending deletion request | OWNER |

The `/me` convention means the server derives the user ID from the JWT token. Users never pass their own ID in the URL, which eliminates a class of IDOR vulnerabilities — see [07-SECURITY.md](./07-SECURITY.md).

Account deletion uses a two-phase flow for owners with household members. The owner sends a deletion request to another member, who can accept (becoming the new owner while the old owner's account is anonymized) or reject (the household is deleted and the owner is anonymized). Solo users and regular members can delete directly. Deletion requests are stored in Redis with a 7-day TTL.

### 2.4 Salary (4 endpoints)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/salary/me` | My salary for current month |
| PUT | `/salary/me` | Upsert my salary |
| GET | `/salary/household` | All household members' salaries |
| GET | `/salary/household/:year/:month` | Household salaries for specific month |

### 2.5 Personal Expenses (5 endpoints)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/expenses/personal` | List my personal expenses |
| POST | `/expenses/personal` | Create personal expense |
| GET | `/expenses/personal/:id` | Get expense details |
| PUT | `/expenses/personal/:id` | Update expense |
| DELETE | `/expenses/personal/:id` | Soft-delete expense |

Personal expenses are standard CRUD. The key distinction from shared expenses: personal expense mutations happen immediately (no approval flow).

### 2.6 Shared Expenses (5 endpoints)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/expenses/shared` | List shared expenses |
| GET | `/expenses/shared/:id` | Get shared expense details |
| POST | `/expenses/shared` | **Propose** new shared expense |
| PUT | `/expenses/shared/:id` | **Propose** edit to shared expense |
| DELETE | `/expenses/shared/:id` | **Propose** deletion of shared expense |

The critical difference: POST, PUT, and DELETE on shared expenses do **not** directly mutate the expense. Instead, they create an `ExpenseApproval` record with status PENDING. Another household member must accept or reject the proposal. This is the approval workflow detailed in [04-APPROVAL-FLOW.md](./04-APPROVAL-FLOW.md).

### 2.7 Approvals (5 endpoints)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/approvals` | List pending approvals for my household |
| GET | `/approvals/history` | Past approvals (filterable by status) |
| PUT | `/approvals/:id/accept` | Accept a pending approval |
| PUT | `/approvals/:id/reject` | Reject a pending approval |
| DELETE | `/approvals/:id` | Cancel own pending approval |

### 2.8 Dashboard (4 endpoints)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/dashboard` | Full financial overview (income, expenses, savings, settlement, pending approval count) |
| GET | `/dashboard/savings` | Savings breakdown per member |
| GET | `/dashboard/settlement` | Who owes whom and how much |
| POST | `/dashboard/settlement/mark-paid` | Record a settlement payment |

The dashboard endpoint is the most expensive query in the system — it aggregates across expenses, salaries, savings, and settlements for a given month. This is why it has a 120-second cache TTL (see [05-CACHING.md](./05-CACHING.md)).

### 2.9 Expense Payments (3 endpoints)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/expense-payments/:expenseId` | Payment statuses for an expense |
| PUT | `/expense-payments/:expenseId/:year/:month` | Mark a month as paid/pending |
| GET | `/expense-payments/household` | All household payment statuses |

### 2.10 Recurring Overrides (4 endpoints)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/recurring-overrides/:expenseId` | List overrides for an expense |
| PUT | `/recurring-overrides/:expenseId/:year/:month` | Upsert single override |
| PUT | `/recurring-overrides/:expenseId/batch` | Batch upsert multiple overrides |
| DELETE | `/recurring-overrides/:expenseId/upcoming/:year/:month` | Delete all overrides from a month forward |

The batch endpoint exists because changing a recurring expense's base amount often requires updating all future overrides in one operation.

### 2.11 Savings (6 endpoints)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/savings/me` | My savings (personal + shared) |
| PUT | `/savings/me/personal` | Upsert personal savings |
| PUT | `/savings/me/shared` | Upsert shared savings |
| GET | `/savings/household` | All household savings |
| POST | `/savings/me/personal/withdraw` | Withdraw from personal savings |
| POST | `/savings/me/shared/withdraw` | Request shared savings withdrawal (approval) |

Personal savings withdrawals take effect immediately. Shared savings withdrawals create a `WITHDRAW_SAVINGS` approval that another household member must accept before the savings balance is reduced.

### Interview Questions This Section Answers
- "How many endpoints does your API have?"
- "Why did you separate personal and shared expenses into different controllers?"
- "What happens when you POST/PUT/DELETE a shared expense?"
- "Why is the dashboard the most expensive query?"

---

## 3. DTO Pattern and Validation

### 3.1 The DTO Lifecycle

Every request body goes through a three-stage transformation pipeline before reaching the service layer:

```
Raw JSON body
    ↓ class-transformer (plainToInstance)
Typed DTO instance
    ↓ class-validator (validate)
Validated DTO instance
    ↓ controller parameter
Service method call
```

This pipeline is powered by a single line in `main.ts`:

```typescript
// backend/src/main.ts
app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
```

**`whitelist: true`** — Any property in the request body that is **not** declared in the DTO is silently stripped. This prevents mass assignment attacks. If someone sends `{ "name": "Rent", "amount": 500, "isAdmin": true }`, the `isAdmin` field is discarded because it doesn't exist on the DTO.

**`transform: true`** — Enables `class-transformer` decorators like `@Transform()` and `@Type()`. Also converts plain JSON objects into DTO class instances, enabling `class-validator` decorators to work.

### 3.2 Input DTOs vs. Response DTOs

I use two categories of DTOs with different purposes:

**Input DTOs** (request validation):
- Import from `class-validator` and `class-transformer`
- Contain validation decorators: `@IsString()`, `@IsEmail()`, `@Min()`, `@MaxLength()`, etc.
- Act as explicit allowlists: only declared properties pass through
- Have tests (see [08-TESTING.md](./08-TESTING.md))

**Response DTOs** (API documentation):
- Import only from `@nestjs/swagger`
- Contain only `@ApiProperty()` decorators for Swagger documentation
- No validation logic — data comes from the database, not from user input
- Do not need tests (no logic to test)

### 3.3 Conditional Validation with @ValidateIf

The most complex DTO is `CreateSharedExpenseDto`, which uses conditional validation for expense type variations:

```typescript
// backend/src/shared-expense/dto/create-shared-expense.dto.ts
@ApiPropertyOptional({ enum: YearlyPaymentStrategy, description: 'Required if frequency is YEARLY' })
@ValidateIf((o) => o.frequency === ExpenseFrequency.YEARLY)
@IsEnum(YearlyPaymentStrategy)
yearlyPaymentStrategy?: YearlyPaymentStrategy;

@ApiPropertyOptional({ enum: InstallmentFrequency, description: 'Required if strategy is INSTALLMENTS' })
@ValidateIf((o) => o.yearlyPaymentStrategy === YearlyPaymentStrategy.INSTALLMENTS)
@IsEnum(InstallmentFrequency)
installmentFrequency?: InstallmentFrequency;
```

`@ValidateIf()` makes a field conditionally required based on other fields. If `frequency` is `MONTHLY`, `yearlyPaymentStrategy` is not validated (and is ignored). If `frequency` is `YEARLY`, it becomes required. This allows a single DTO to handle all 5 expense type combinations rather than creating 5 separate DTOs.

### 3.4 Validation Error Responses

When validation fails, NestJS automatically returns a 400 Bad Request with an array of human-readable error messages:

```json
{
    "statusCode": 400,
    "message": [
        "name must be longer than or equal to 1 characters",
        "amount must not be less than 1"
    ],
    "error": "Bad Request",
    "timestamp": "2026-02-14T12:00:00.000Z",
    "requestId": "abc-123-def"
}
```

The `message` field is an array because multiple validations can fail simultaneously. The `timestamp` and `requestId` are added by the global `HttpExceptionFilter` (see [07-SECURITY.md](./07-SECURITY.md)).

### Interview Questions This Section Answers
- "How do you validate incoming requests?"
- "What is mass assignment and how do you prevent it?"
- "How does @ValidateIf work for conditional validation?"
- "What's the difference between input DTOs and response DTOs?"

---

## 4. Swagger/OpenAPI Integration

### 4.1 Setup

Swagger is configured in `main.ts` and served at `/docs`:

```typescript
// backend/src/main.ts
if (configService.get('NODE_ENV') !== 'production') {
    const config = new DocumentBuilder()
        .setTitle('SharedBudget API')
        .setDescription('API for SharedBudget household expense management')
        .setVersion('1.0')
        .addBearerAuth()
        .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
}
```

Swagger is **disabled in production**. This is a deliberate security decision: the Swagger UI exposes the complete API surface — every endpoint, parameter, and response type. In production, this information aids attackers. During development, it serves as interactive API documentation and testing interface.

`addBearerAuth()` adds the "Authorize" button in Swagger UI, allowing developers to paste a JWT token and make authenticated requests directly from the browser.

### 4.2 Composite Endpoint Decorators

The biggest Swagger maintenance problem is decorator sprawl. A typical NestJS endpoint accumulates 8-12 decorators:

```typescript
// What endpoints look like WITHOUT composite decorators (bad):
@Post('login')
@ApiOperation({ summary: 'Login', description: '...' })
@ApiResponse({ status: 200, type: AuthResponseDto })
@ApiResponse({ status: 401, type: ErrorResponseDto })
@ApiResponse({ status: 403, type: ErrorResponseDto })
@ApiResponse({ status: 429, type: ErrorResponseDto })
@Throttle({ default: { limit: 5, ttl: 60000, blockDuration: 300000 } })
@HttpCode(HttpStatus.OK)
login(@Body() dto: LoginDto) { ... }
```

I solved this with **composite decorators** using NestJS's `applyDecorators()`:

```typescript
// backend/src/auth/decorators/api-auth.decorators.ts
export function LoginEndpoint() {
    return applyDecorators(
        Post('login'),
        ApiOperation({
            summary: 'Login with email and password',
            description: 'Authenticates a user and returns access and refresh tokens.',
        }),
        ApiResponse({ status: 200, description: 'Login successful.', type: AuthResponseDto }),
        ApiResponse({ status: 401, description: 'Invalid credentials.', type: ErrorResponseDto }),
        ApiResponse({ status: 403, description: 'Email not verified.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 5, ttl: 60000, blockDuration: 300000 } }),
        HttpCode(HttpStatus.OK),
    );
}
```

The controller becomes clean:

```typescript
@LoginEndpoint()
login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
}
```

Every module has its own `decorators/api-*.decorators.ts` file. There are **11 decorator files**, one per feature module. This pattern provides three benefits:

1. **Consistency**: It's impossible to forget Swagger docs because the route definition and documentation are in the same decorator.
2. **Readability**: Controllers contain only business logic, not configuration.
3. **Maintainability**: Changing the throttle rate for login requires editing one file, not searching across controllers.

### 4.3 ErrorResponseDto on Every Error Response

Every `ApiResponse` with a 4xx or 5xx status code uses `type: ErrorResponseDto`:

```typescript
// backend/src/common/dto/error-response.dto.ts
export class ErrorResponseDto {
    @ApiProperty({ example: 409, description: 'HTTP status code' })
    statusCode: number;

    @ApiProperty({
        example: 'User already belongs to a household',
        oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    })
    message: string | string[];

    @ApiProperty({ example: 'Conflict' }) error: string;
    @ApiProperty({ example: '2026-02-01T12:00:00.000Z' }) timestamp: string;
    @ApiProperty({ example: 'abc-123-def' }) requestId: string;
}
```

This is enforced as a project rule (in `CLAUDE.md`): every error ApiResponse **must** include `type: ErrorResponseDto`. This ensures Swagger shows the full error shape for every possible error, so frontend developers know exactly what to parse.

### Interview Questions This Section Answers
- "How do you generate API documentation?"
- "Why is Swagger disabled in production?"
- "What problem do composite decorators solve?"
- "How do you ensure every endpoint has complete Swagger documentation?"

---

## 5. Rate Limiting

### 5.1 Implementation

Rate limiting is provided by `@nestjs/throttler` with Redis as the backing store:

```
Client request → ThrottlerGuard → check Redis counter → allow or reject (429)
```

Redis backing (rather than in-memory) is essential for two reasons:
1. **Horizontal scaling**: If two backend instances share a Redis, rate limits are enforced across both. In-memory counters would allow 2x the limit by distributing requests across instances.
2. **Persistence**: Rate limit counters survive server restarts. An attacker can't reset their limit by waiting for a deployment.

### 5.2 Rate Limit Tiers

I configured three tiers based on endpoint sensitivity:

**Tier 1 — Strictest (authentication actions):**
| Endpoint | Limit | Window | Block Duration |
|----------|-------|--------|----------------|
| Register | 3 | 60s | 600s (10 min) |
| Login | 5 | 60s | 300s (5 min) |
| Verify code | 5 | 60s | 300s (5 min) |
| Reset password | 5 | 60s | 300s (5 min) |

These endpoints are targets for brute-force attacks. The `blockDuration` parameter extends the lockout beyond the TTL window — after 5 failed logins in 60 seconds, the client is blocked for 5 full minutes, not just until the 60-second window resets.

**Tier 2 — Conservative (email-triggering):**
| Endpoint | Limit | Window |
|----------|-------|--------|
| Resend code | 3 | 600s (10 min) |
| Forgot password | 3 | 600s (10 min) |

These endpoints send emails. Without rate limiting, an attacker could trigger thousands of emails through a valid email address, creating a spam vector and potentially exhausting the email service quota.

**Tier 3 — Standard (authenticated operations):**
| Endpoint | Limit | Window |
|----------|-------|--------|
| Refresh | 30 | 60s |
| Logout | 30 | 60s |
| All other endpoints | Default | Default |

Authenticated endpoints get higher limits because the authentication step already provides accountability.

### 5.3 Throttle Response

When a rate limit is exceeded, the response is:

```json
{
    "statusCode": 429,
    "message": "Too many requests",
    "error": "Too Many Requests",
    "timestamp": "2026-02-14T12:00:00.000Z",
    "requestId": "abc-123-def"
}
```

The response includes `Retry-After` headers so well-behaved clients know when to retry.

### Interview Questions This Section Answers
- "How do you protect against brute-force attacks?"
- "Why use Redis-backed rate limiting instead of in-memory?"
- "What's the difference between TTL window and block duration?"
- "How do rate limits scale across multiple backend instances?"

---

## Cross-References

- **Database models and relationships:** [01-DATABASE.md](./01-DATABASE.md)
- **Authentication flows and JWT strategy:** [02-AUTH.md](./02-AUTH.md)
- **Module system and request lifecycle:** [03-BACKEND.md](./03-BACKEND.md)
- **Approval workflow (shared expense mutations):** [04-APPROVAL-FLOW.md](./04-APPROVAL-FLOW.md)
- **Redis caching for expensive queries:** [05-CACHING.md](./05-CACHING.md)
- **Security measures and error handling:** [07-SECURITY.md](./07-SECURITY.md)
- **DTO and endpoint test strategies:** [08-TESTING.md](./08-TESTING.md)
