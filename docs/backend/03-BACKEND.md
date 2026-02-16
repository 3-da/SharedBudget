# NestJS Backend Architecture

This document covers the backend architecture of SharedBudget: why NestJS, how 19 modules compose into a running application, how dependency injection enables testing, what happens during a request lifecycle, and how global infrastructure enforces consistency across 47 endpoints.

---

## 1. Why NestJS

I evaluated three options for the backend framework: raw Express, Fastify with manual structure, and NestJS.

**Angular-inspired modular structure.** SharedBudget has 11 feature domains (auth, household, expenses, approvals, dashboard, and so on). Each domain needs a controller, one or more services, DTOs, and decorators. NestJS organizes these into modules with explicit imports and exports, so each domain is self-contained. With Express, you wire these relationships by hand in an `index.ts` and hope nobody breaks the import order. NestJS makes the dependency graph declarative.

**TypeScript-first with compile-time safety.** NestJS is written in TypeScript and designed around it. Decorators like `@Injectable()`, `@Controller()`, and `@Module()` are not bolted onto a JavaScript framework -- they are the framework's API. This means the compiler catches misconfigurations (wrong injection token type, missing provider) before the application starts. Express middleware chains are untyped function signatures where a missing `next()` call becomes a runtime hang.

**Built-in DI, guards, interceptors, filters.** I needed rate limiting (ThrottlerGuard), JWT validation (JwtAuthGuard), input validation (ValidationPipe), and consistent error formatting (HttpExceptionFilter). NestJS provides extension points for each of these at the framework level. With Express, each concern is a separate middleware with no standard composition pattern. You end up with `app.use()` chains where ordering is critical and invisible.

**Opinionated vs. Express flexibility -- the tradeoff.** NestJS imposes structure. You cannot easily bypass the module system or ignore DI. For a solo developer or a two-person team, this overhead pays off because the structure prevents shortcuts that become tech debt. The cost is boilerplate: every new feature requires a module file, a controller file, a service file, and a spec file. I accepted that cost because SharedBudget has 47 endpoints across 11 domains, and without enforced structure, navigating the codebase at that scale would be significantly slower.

**Maps to enterprise patterns.** NestJS uses an Inversion of Control container similar to Spring's. If you know Spring Boot's `@Service`, `@Controller`, and `@Autowired`, you already understand NestJS's `@Injectable()`, `@Controller()`, and constructor injection. This made the learning curve predictable and the patterns transferable.

### Interview Questions This Section Answers
- Why did you choose NestJS over Express or Fastify?
- What are the tradeoffs of an opinionated framework vs. a minimal one?
- How does NestJS compare to Spring Boot in terms of architecture patterns?

---

## 2. Module Architecture (19 Modules)

The application consists of 19 modules: 11 feature modules that expose API endpoints, and 8 infrastructure modules that provide shared services.

### Feature Modules (11)

| Module               | Endpoints | Responsibility                                           |
|----------------------|-----------|----------------------------------------------------------|
| auth                 | 8         | Register, verify email, login, refresh, logout, password reset |
| household            | 11        | CRUD, join/leave, invite, transfer ownership             |
| user                 | 3         | Profile get/update, change password                      |
| salary               | 4         | Upsert salary, get own/household/monthly                 |
| personal-expense     | 5         | CRUD for personal expenses                               |
| shared-expense       | 5         | Propose create/update/delete (approval-gated)            |
| approval             | 5         | List pending/history, accept, reject, cancel             |
| dashboard            | 4         | Financial overview, savings, settlement, mark-paid       |
| expense-payment      | 3         | Mark expense months as paid/pending                      |
| recurring-override   | 4         | Override recurring amounts per month, batch upsert       |
| saving               | 4         | Personal/shared savings upsert, get own/household        |

Each feature module follows the same internal structure: a module file declaring imports/providers/controllers/exports, a controller, one or more services, DTOs for request/response shapes, and a `decorators/` folder containing composite endpoint decorators.

### Infrastructure Modules (8)

| Module         | Provides                           | Used By                    |
|----------------|------------------------------------|-----------------------------|
| redis          | Redis connection + throttler storage | Throttler, cache, session  |
| prisma         | PrismaService (database client)    | All feature services        |
| session        | SessionService (Redis sessions)    | Auth                        |
| cache          | CacheService (Redis caching)       | Dashboard, expenses, salary |
| mail           | MailService (email, logs in dev)   | Auth                        |
| expense-helper | ExpenseHelperService               | Shared/personal expenses    |
| logger         | Pino logger with request ID        | All modules                 |
| throttler      | ThrottlerModule (via forRootAsync) | All controllers (global)    |

Infrastructure modules have no controllers. They exist to encapsulate a single technical concern and export a service that feature modules inject.

### AppModule as Composition Root

```typescript
@Module({
    imports: [
        LoggerModule,
        ConfigModule.forRoot(),
        RedisModule,
        CacheModule,
        MailModule,
        ThrottlerModule.forRootAsync({
            imports: [RedisModule],
            inject: [REDIS_CLIENT],
            useFactory: (redis: Redis) => ({
                throttlers: [{ ttl: 60000, limit: 100 }],
                storage: new ThrottlerRedisStorage(redis),
            }),
        }),
        PrismaModule,
        AuthModule,
        HouseholdModule,
        SalaryModule,
        UserModule,
        PersonalExpenseModule,
        SharedExpenseModule,
        ApprovalModule,
        DashboardModule,
        ExpensePaymentModule,
        RecurringOverrideModule,
        SavingModule,
    ],
    controllers: [AppController],
    providers: [
        AppService,
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: APP_FILTER, useClass: HttpExceptionFilter }
    ],
})
export class AppModule {}
```

Three things to notice here.

**Infrastructure modules load first.** LoggerModule, ConfigModule, RedisModule, CacheModule, and MailModule appear before any feature module. This is intentional: feature modules depend on infrastructure, so infrastructure must be available in the DI container before feature modules try to inject from it. NestJS resolves this by module import order.

**ThrottlerModule.forRootAsync with Redis factory.** The rate limiter needs a Redis connection that does not exist yet when the module is being configured. `forRootAsync` defers configuration until the Redis client is available. The factory injects `REDIS_CLIENT` from RedisModule and passes it to `ThrottlerRedisStorage`. This matters for horizontal scaling: if you run two backend instances behind a load balancer, both share the same Redis-backed rate limit counters. Without Redis storage, each instance tracks limits independently, effectively doubling the allowed request rate.

**Global providers via tokens.** `APP_GUARD` registers ThrottlerGuard on every route without decorating each controller. `APP_FILTER` registers HttpExceptionFilter on every exception without try-catch blocks in services. These are framework-level extension points that eliminate repetitive wiring.

### Interview Questions This Section Answers
- How do you organize a NestJS application with many domains?
- What is the difference between feature modules and infrastructure modules?
- Why use `forRootAsync` instead of `forRoot` for the throttler?
- How does the module import order affect dependency resolution?

---

## 3. Dependency Injection

### Constructor Injection Pattern

Every service in SharedBudget uses constructor injection. NestJS reads the constructor parameter types and resolves them from the module's DI container at instantiation time.

When `AuthService` declares `constructor(private readonly prisma: PrismaService, private readonly session: SessionService)`, NestJS looks up `PrismaService` and `SessionService` in the container, creates them if they do not exist yet, and passes the instances to the constructor. The service never calls `new PrismaService()` directly.

### Why DI Enables Testability

This is the single most important benefit for a project with 723 unit tests. In a test, you replace real dependencies with mocks:

```typescript
const module = await Test.createTestingModule({
    providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SessionService, useValue: mockSession },
    ],
}).compile();
```

`AuthService` receives `mockPrisma` and `mockSession` instead of real implementations. The service code does not change. You test business logic in isolation without a database, without Redis, without network calls. This is why every service method gets tests immediately after implementation -- DI makes the cost of writing those tests low.

### Singleton Scope

NestJS creates one instance of each provider per module by default. `PrismaService` is instantiated once and shared across all 11 feature services that inject it. This is correct for SharedBudget because services are stateless -- they hold no per-request data. The Prisma client manages its own connection pool internally, so sharing a single instance across concurrent requests is both safe and efficient.

### Module Encapsulation

If a module does not list a provider in its `exports` array, that provider is private to the module. Other modules cannot inject it. This enforces boundaries: `SessionService` is exported from `SessionModule` and used by `AuthModule`, but `AuthService` is not exported from `AuthModule` because no other module should call authentication logic directly.

### Interview Questions This Section Answers
- How does dependency injection work in NestJS?
- Why does DI improve testability?
- What is the default scope of a NestJS provider, and when would you change it?
- How do you enforce boundaries between modules?

---

## 4. The Request Lifecycle

When a request hits the backend, NestJS processes it through a fixed pipeline. Here is the full sequence, walked through with a concrete example: `POST /api/v1/expenses/personal` (create a personal expense).

```
Client Request
    |
    v
Middleware          Pino logger assigns requestId, logs method + URL
    |
    v
Guard               ThrottlerGuard checks Redis for rate limit (100 req/60s default)
    |                JwtAuthGuard verifies Bearer token, sets req.user
    v
Interceptor         (none globally; available for logging, caching, transforms)
    |
    v
Pipe                ValidationPipe: whitelist strips unknown fields,
    |                transform converts plain objects to DTO class instances,
    |                class-validator rejects invalid input with 400
    v
Controller          PersonalExpenseController.create() receives validated DTO + userId
    |
    v
Service             PersonalExpenseService.create() runs business logic,
    |                calls PrismaService for database writes,
    |                invalidates cache via CacheService
    v
Response            Controller returns result; NestJS serializes to JSON
    |
    v
Exception Filter    If ANY stage threw: HttpExceptionFilter catches it,
                    formats { statusCode, message, error, timestamp, requestId }
```

**Guards run before pipes.** This means an unauthenticated request is rejected before NestJS wastes time validating the request body. The ThrottlerGuard also runs before authentication, so a brute-force attack against `/auth/login` is rate-limited even before credentials are checked.

**Pipes transform and validate.** The `whitelist: true` option strips any fields not declared in the DTO. If a client sends `{ "name": "Rent", "amount": 500, "isAdmin": true }`, the `isAdmin` field is silently removed before the controller sees it. The `transform: true` option converts the plain JSON object into an actual class instance, which enables `class-transformer` decorators like `@Transform()` to run.

**The exception filter is the safety net.** If a service throws `new ForbiddenException('Not a household member')`, the filter formats it. If Prisma throws a unique constraint violation (P2002), the filter maps it to a 409. If an unknown error reaches the filter, it logs the full stack trace and returns a generic 500. No endpoint needs its own try-catch for error formatting.

### Interview Questions This Section Answers
- What is the NestJS request lifecycle, and in what order do guards, pipes, and filters execute?
- Why do guards run before pipes?
- What does the `whitelist` option in ValidationPipe prevent?
- How do you handle errors consistently across all endpoints?

---

## 5. Global Infrastructure

### HttpExceptionFilter

```typescript
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost): void {
        const requestId: string = request.id ?? 'unknown';
        const { statusCode, message, error } = this.resolveException(exception);
        httpAdapter.reply(
            ctx.getResponse(),
            { statusCode, message, error, timestamp, requestId },
            statusCode,
        );
    }

    private resolveException(exception: unknown): HttpErrorResponse {
        if (exception instanceof HttpException)
            return this.handleHttpException(exception);
        if (exception instanceof PrismaClientKnownRequestError)
            return this.handlePrismaError(exception);
        return this.handleUnknownError(exception);
    }

    private handlePrismaError(exception): HttpErrorResponse {
        switch (exception.code) {
            case 'P2002':
                return {
                    statusCode: 409,
                    message: 'A record with this value already exists',
                    error: 'Conflict',
                };
            case 'P2025':
                return {
                    statusCode: 404,
                    message: 'Record not found',
                    error: 'Not Found',
                };
            default:
                return {
                    statusCode: 500,
                    message: 'Internal server error',
                    error: 'Internal Server Error',
                };
        }
    }
}
```

The filter handles three categories of exceptions:

1. **HttpException** (thrown intentionally by services): the filter extracts the status code and message and passes them through unchanged. When `AuthService` throws `new UnauthorizedException('Invalid credentials')`, the client receives exactly that message with status 401.

2. **PrismaClientKnownRequestError** (thrown by the ORM): Prisma error codes are mapped to HTTP status codes. P2002 (unique constraint violation) becomes 409 Conflict. P2025 (record not found in update/delete) becomes 404. This eliminates the need for services to catch Prisma errors just to re-throw them as HTTP exceptions.

3. **Unknown errors** (everything else): logged at error level with the full stack trace, but the client receives only `"Internal server error"`. Internal details never leak to the client.

Every response includes a `requestId` that correlates with Pino log entries, so when a client reports an error, you can search logs by that ID to find the full context.

### ValidationPipe

Registered globally in `main.ts`:

```typescript
app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
```

`whitelist: true` strips undeclared properties. `transform: true` converts plain objects to class instances, enabling `class-transformer` decorators. Together, these two options mean that by the time a DTO reaches a controller method, it contains only declared fields with correct types and passing validation rules.

### ThrottlerGuard

Registered as `APP_GUARD` in AppModule, applying a default rate limit of 100 requests per 60 seconds to every endpoint. Individual endpoints can override this with the `@Throttle()` decorator. For example, `POST /auth/register` uses `{ limit: 3, ttl: 60000, blockDuration: 600000 }` -- 3 attempts per minute, then a 10-minute block. The throttler stores counters in Redis via `ThrottlerRedisStorage`, so limits are shared across multiple backend instances.

### Pino Structured Logging

The logger module configures `nestjs-pino` with request ID correlation. Every log entry during a request includes the same `requestId`, making it possible to trace a single request across service calls. Pino outputs structured JSON in production (machine-parseable, suitable for log aggregation tools) and pretty-printed output in development.

### Interview Questions This Section Answers
- How do you ensure a consistent error response format across all endpoints?
- How do you handle ORM-level errors (like unique constraint violations) without catching them in every service?
- What is the purpose of `requestId` in error responses?
- How does rate limiting work across multiple server instances?

---

## 6. Composite Decorator Pattern

### The Problem

A typical NestJS endpoint needs 8-12 decorator lines:

```typescript
@Post('register')
@ApiOperation({ summary: 'Register a new user', description: '...' })
@ApiResponse({ status: 201, description: 'Success', type: MessageResponseDto })
@ApiResponse({ status: 400, description: 'Validation error', type: ErrorResponseDto })
@ApiResponse({ status: 429, description: 'Too many requests', type: ErrorResponseDto })
@Throttle({ default: { limit: 3, ttl: 60000, blockDuration: 600000 } })
```

Repeated across 47 endpoints, this creates two problems. First, visual noise: the actual method body is buried under decorator stacks. Second, inconsistency: when you update the Swagger response for one endpoint, you must remember to update it everywhere the same pattern appears.

### The Solution

Each controller module has a `decorators/` folder with composite decorators that bundle related metadata using `applyDecorators()`:

```typescript
export function RegisterEndpoint() {
    return applyDecorators(
        Post('register'),
        ApiOperation({
            summary: 'Register a new user',
            description: 'Creates a new user account and sends a verification code.',
        }),
        ApiResponse({
            status: 201,
            description: 'Verification code sent to email.',
            type: MessageResponseDto,
        }),
        ApiResponse({
            status: 400,
            description: 'Validation error.',
            type: ErrorResponseDto,
        }),
        ApiResponse({
            status: 429,
            description: 'Too many requests.',
            type: ErrorResponseDto,
        }),
        Throttle({ default: { limit: 3, ttl: 60000, blockDuration: 600000 } }),
    );
}
```

The controller method becomes:

```typescript
@RegisterEndpoint()
async register(@Body() dto: RegisterDto): Promise<MessageResponseDto> {
    return this.authService.register(dto);
}
```

There are 11 decorator files, one per controller module. Every error response (4xx, 5xx) uses `ErrorResponseDto` as its type, which ensures Swagger documentation shows the full error shape for every endpoint.

### Tradeoff: DRY vs. Explicitness

The composite decorator hides configuration details. When you read the controller, you see `@RegisterEndpoint()` but not the throttle limits or Swagger responses. You must open the decorator file to see them. I accepted this tradeoff because the alternative -- 8-12 visible decorators on every method -- made controllers harder to read for the business logic they contain. The decorator file name matches the endpoint name, so navigation is predictable.

### Interview Questions This Section Answers
- How do you keep Swagger documentation consistent across many endpoints?
- What is `applyDecorators()` and when would you use it?
- What are the tradeoffs of abstracting decorator stacks into composite decorators?

---

## 7. Expense Type System

SharedBudget supports five expense type combinations, determined by three fields: `category` (RECURRING or ONE_TIME), `frequency` (MONTHLY or YEARLY), and `yearlyPaymentStrategy` (FULL or INSTALLMENTS).

### The Five Combinations

**1. Recurring Monthly** -- `category: RECURRING, frequency: MONTHLY`

Appears every month at the full `amount`. Example: rent at 800 EUR. The dashboard calculation includes this expense in every month. Supports per-month overrides via `RecurringOverride` (e.g., rent increased to 850 in March).

**2. Recurring Yearly Full** -- `category: RECURRING, frequency: YEARLY, yearlyPaymentStrategy: FULL`

Appears once per year in the designated `paymentMonth` at the full `amount`. Example: annual insurance premium of 1200 EUR paid every July. The dashboard shows 1200 EUR in July and 0 EUR in all other months.

**3. Recurring Yearly Installments** -- `category: RECURRING, frequency: YEARLY, yearlyPaymentStrategy: INSTALLMENTS`

The yearly amount is spread across months. The divisor depends on `installmentFrequency`:
- MONTHLY: `amount / 12` (every month)
- QUARTERLY: `amount / 4` (every 3 months)
- SEMI_ANNUAL: `amount / 2` (every 6 months)

Example: car insurance of 1200 EUR with MONTHLY installments shows as 100 EUR per month.

**4. One-Time Full** -- `category: ONE_TIME, yearlyPaymentStrategy: FULL`

A single expense at a specific `month` and `year`. Example: a new washing machine for 600 EUR in February 2026. Appears only in that one month.

**5. One-Time Installments** -- `category: ONE_TIME, yearlyPaymentStrategy: INSTALLMENTS`

A single expense spread over `installmentCount` payments starting from the specified `month` and `year`. Example: a 1200 EUR laptop paid in 6 monthly installments of 200 EUR each, starting March 2026.

### Per-Month Overrides

The `RecurringOverride` model allows changing the amount of a recurring expense for a specific month without editing the expense itself. Each override stores `expenseId`, `month`, `year`, `amount`, and a `skipped` boolean. When the dashboard calculates monthly totals, it checks for overrides before using the default amount. If `skipped` is true, the expense is excluded from that month entirely.

This design avoids mutating the expense record for temporary changes (e.g., a promotional discount on a subscription for three months).

### Interview Questions This Section Answers
- How do you model recurring vs. one-time expenses with different payment strategies?
- How does the installment calculation work for yearly expenses?
- How do you handle temporary changes to recurring expense amounts without editing the base record?

---

## 8. JSDoc Convention

### The Recurring Cast

All JSDoc scenarios across the codebase use three named characters with fixed roles:

| Name       | Role     | Description                                               |
|------------|----------|-----------------------------------------------------------|
| **Alex**   | OWNER    | The household creator and administrator                   |
| **Sam**    | MEMBER   | A household member (joined via invite code or invitation) |
| **Jordan** | OUTSIDER | A registered user not yet in any household                |

### Why Named Characters

Service methods in SharedBudget involve role-dependent logic. `transferOwnership` requires the caller to be the OWNER. `acceptApproval` requires the caller to be a household MEMBER who is not the original requester. `joinHousehold` requires the caller to not already belong to a household.

Using consistent names makes these relationships traceable across methods. When you read "Alex transfers ownership to Sam" in `HouseholdService.transferOwnership()` and then read "Sam accepts Jordan's request" in `ApprovalService.accept()`, you understand the role transitions without re-reading the parameter descriptions.

### JSDoc Structure

Each non-obvious method includes six sections:

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
 * control. Alex transfers ownership to Sam -- Sam becomes the new
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

The `@throws` entries are ordered to match the validation checks in the method body. When you read the JSDoc top to bottom, you are reading the method's guard clauses in execution order. This means you can predict the method's structure before reading the implementation.

Self-explanatory CRUD methods (`create`, `getById`, `delete`) skip JSDoc entirely. The convention applies only to methods where the name alone does not communicate the role requirements, side effects, or multi-step flows.

### Interview Questions This Section Answers
- How do you document complex service methods in a multi-role system?
- Why use recurring named characters in documentation?
- How do you keep JSDoc synchronized with implementation logic?

---

## Application Bootstrap

The `main.ts` file configures the NestJS application before it starts listening:

```typescript
async function bootstrap() {
    const app = await NestFactory.create(AppModule, { bufferLogs: true });
    app.useLogger(app.get(Logger));
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    const apiPrefix = configService.get('API_PREFIX', 'api/v1');
    app.setGlobalPrefix(apiPrefix);
    app.enableCors({ origin: corsOrigin, credentials: true });
    // Swagger (non-production only)
    if (configService.get('NODE_ENV') !== 'production') {
        const config = new DocumentBuilder()
            .setTitle('SharedBudget API').setVersion('1.0').addBearerAuth().build();
        SwaggerModule.setup('docs', app, document);
    }
    await app.listen(port);
}
```

**`bufferLogs: true`** captures log output during module initialization and replays it through the Pino logger once it is available. Without this, early log messages (before Pino is configured) would go to the default console logger with a different format.

**Swagger disabled in production.** The `if (NODE_ENV !== 'production')` check prevents the `/docs` endpoint from being exposed in production. Swagger documentation is a development and testing tool; in production, it exposes the full API surface to anyone who finds the URL.

**Global prefix `api/v1`.** Every route is prefixed with `/api/v1`, so `@Post('register')` in the auth controller becomes `POST /api/v1/auth/register`. This allows future API version changes (`/api/v2`) without breaking existing clients.

**CORS with credentials.** `credentials: true` allows the frontend (running on `localhost:4200` during development) to send cookies and authorization headers to the backend (on `localhost:3000`). The `origin` is read from the `CORS_ORIGIN` environment variable to avoid hardcoding the frontend URL.

### Interview Questions This Section Answers
- What does `bufferLogs` do and why is it needed?
- Why disable Swagger in production?
- How do you handle API versioning in NestJS?
- How does CORS configuration work with a separate frontend and backend?
