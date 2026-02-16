# Authentication and Authorization

## 1. Authentication Architecture Overview

The system uses a **two-token pattern**: a stateless JWT access token paired with a stateful refresh token stored in Redis.

I chose this combination because it separates two concerns with different performance profiles. Access tokens are verified locally by decoding the JWT signature -- no database or Redis call on every request. This keeps endpoint latency low for the 99% of requests that are routine reads and writes. Refresh tokens are stored in Redis so they can be individually revoked and rotated, which a pure-JWT system cannot do without maintaining a blocklist (defeating the stateless benefit).

The tradeoff: you cannot revoke an access token before it expires. I set the access token TTL to 15 minutes, which limits the window of exposure if a token leaks while keeping refresh frequency low enough that users are not constantly interrupted.

```
Registration / Login
        |
        v
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

On the frontend, the access token lives **in memory only** (a `TokenService` field). It is lost on page reload, which is intentional -- the client silently calls `/auth/refresh` using the refresh token from `localStorage` (`sb_refresh_token`) to restore the session. This means an XSS attack that reads `localStorage` gets a refresh token but not an access token, and the refresh token is single-use due to rotation.

### Interview Questions This Section Answers
- Why use two tokens instead of just a JWT with a long expiration?
- How do you revoke access in a stateless JWT system?
- What is the security tradeoff of storing refresh tokens in localStorage?

---

## 2. Password Security -- Argon2

I chose Argon2id over bcrypt because Argon2 is **memory-hard**. Bcrypt's cost factor only increases CPU time, so an attacker with GPUs or ASICs can parallelize attacks cheaply. Argon2id forces each hash attempt to allocate a configurable amount of RAM, making GPU-based cracking economically impractical. Argon2 won the Password Hashing Competition (PHC) in 2015 and is recommended by OWASP.

The hashing parameters (memory cost, time cost, parallelism) are configurable via environment variables. This means I can tune them per deployment environment -- lower for CI where speed matters, higher for production where security matters -- without changing code.

`argon2.verify()` is constant-time internally. It compares the derived hash byte-by-byte in fixed time regardless of where a mismatch occurs. This prevents timing side-channel attacks where an attacker measures response latency to determine how many bytes of a password hash matched.

### Interview Questions This Section Answers
- Why Argon2id over bcrypt or scrypt?
- What does "memory-hard" mean and why does it matter for password hashing?
- How does constant-time comparison prevent timing attacks?

---

## 3. Registration Flow

```typescript
async register(registerDto: RegisterDto): Promise<MessageResponseDto> {
    const existingUser = await this.prismaService.user.findUnique({ where: { email: registerDto.email } });
    if (existingUser) {
        // ENUMERATION PREVENTION: same response whether email exists or not
        return { message: "We've sent a verification code to your email." };
    }
    const hashedPassword = await argon2.hash(registerDto.password);
    await this.prismaService.user.create({
        data: { email: registerDto.email, password: hashedPassword, firstName: registerDto.firstName, lastName: registerDto.lastName, emailVerified: false },
    });
    await this.sendVerificationCode(registerDto.email);
    return { message: "We've sent a verification code to your email." };
}
```

The method returns the **identical message** whether the email already exists or not. This is enumeration prevention: an attacker cannot determine which emails are registered by observing different responses. If the email exists, the method returns early without sending a code. If it is new, the password is hashed with Argon2, the user is created with `emailVerified: false`, and a verification code is sent.

The `emailVerified: false` flag blocks login until the user completes email verification, preventing account creation with unowned email addresses.

### Interview Questions This Section Answers
- How do you prevent user enumeration on the registration endpoint?
- Why not return an error when the email is already taken?

---

## 4. Email Verification Flow

```typescript
async verifyCode(email: string, code: string): Promise<AuthResponseDto> {
    const storedCode = await this.redis.get(`verify:${email}`);
    if (!storedCode || storedCode !== code) {
        throw new UnauthorizedException('Invalid or expired verification code.');
    }
    const user = await this.prismaService.user.findUnique({ where: { email } });
    if (!user) {
        throw new UnauthorizedException('Invalid or expired verification code.');
    }
    await this.prismaService.user.update({ where: { id: user.id }, data: { emailVerified: true } });
    await this.redis.del(`verify:${email}`);
    return this.generateTokens(user); // Auto-login after verification
}
```

The verification code is a 6-digit string stored at Redis key `verify:{email}` with a 10-minute TTL. After successful verification, the code is deleted from Redis (single-use) and `emailVerified` is set to `true`.

I made verification return auth tokens (auto-login) because the user just completed a friction-heavy flow: register, open email, copy code, paste code. Forcing them to then navigate to a login page and type their password again adds friction with zero security benefit -- they just proved they own the email address.

### Interview Questions This Section Answers
- Why auto-login after email verification instead of redirecting to the login page?
- Why use Redis with a TTL for verification codes instead of a database column?

---

## 5. Login Flow

```typescript
async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.prismaService.user.findUnique({ where: { email: loginDto.email } });
    if (!user) {
        throw new UnauthorizedException('Incorrect email or password.');
    }
    const isPasswordValid = await argon2.verify(user.password, loginDto.password);
    if (!isPasswordValid) {
        throw new UnauthorizedException('Incorrect email or password.');
    }
    if (!user.emailVerified) {
        throw new ForbiddenException('Please verify your email first. Check your inbox for the verification code.');
    }
    return this.generateTokens(user);
}
```

Three validations run in sequence: user exists, password matches, email is verified. The first two failures return **the same error message** (`"Incorrect email or password."`) -- this is another enumeration prevention measure. An attacker cannot distinguish between "this email is not registered" and "the password is wrong."

The `emailVerified` check uses a **different error** (403 Forbidden) because this is not a credentials failure -- the user proved their identity but their account is in a restricted state. The distinct message tells the client to show a "check your inbox" UI instead of a generic error.

### Interview Questions This Section Answers
- Why return the same error for wrong email and wrong password?
- What is the difference between 401 and 403 in the login flow?

---

## 6. JWT Strategy and Passport Integration

```typescript
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(configService: ConfigService) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
        });
    }
    validate(payload: JwtPayload) {
        return { id: payload.sub, email: payload.email };
    }
}
```

Passport's JWT strategy extracts the token from the `Authorization: Bearer <token>` header, verifies the HS256 signature against `JWT_ACCESS_SECRET`, checks expiration, and calls `validate()`. The return value of `validate()` is attached to `req.user` for all downstream handlers.

The `validate` method maps `payload.sub` to `id`. I used the `sub` (subject) claim for the user ID because it is the standard JWT claim for identifying the principal, per RFC 7519. Using `email` as the subject would break if users could change their email address.

`JwtAuthGuard` is registered as a **global guard** via `APP_GUARD`, meaning every endpoint requires authentication by default. Endpoints that should be public use a `@Public()` decorator, which sets metadata that the guard checks before enforcing authentication.

### Interview Questions This Section Answers
- How does Passport's JWT strategy work in NestJS?
- Why use `sub` instead of `email` as the JWT subject claim?
- How do you make authentication the default while allowing public endpoints?

---

## 7. Token Generation

```typescript
private async generateTokens(user: { id: string; email: string; firstName: string; lastName: string }): Promise<AuthResponseDto> {
    const accessToken = this.jwtService.sign({ sub: user.id, email: user.email });
    const refreshToken = crypto.randomBytes(32).toString('hex');
    await this.sessionService.storeRefreshToken(user.id, refreshToken);
    return { accessToken, refreshToken, user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName } };
}
```

The access token is a JWT signed with HS256 containing `{ sub: userId, email }` and a 15-minute expiration (configured via `JWT_ACCESS_EXPIRATION`).

The refresh token is **not a JWT** -- it is 32 bytes from `crypto.randomBytes`, hex-encoded to 64 characters. I chose random bytes over a JWT because the refresh token does not need to carry payload data. Its only purpose is to be a lookup key in Redis. Making it a JWT would add unnecessary size, require a second signing secret, and the payload would be redundant since all session data lives in Redis anyway. A 256-bit random value has sufficient entropy to be unguessable.

### Interview Questions This Section Answers
- Why is the refresh token a random string instead of a JWT?
- What data goes in the access token payload and why?

---

## 8. Refresh Token Flow and Redis Storage

```typescript
async storeRefreshToken(userId: string, token: string): Promise<void> {
    await this.redis.set(`refresh:${token}`, userId, 'EX', this.refreshTokenTTL);
    await this.redis.sadd(`user_sessions:${userId}`, token);
    await this.redis.expire(`user_sessions:${userId}`, this.refreshTokenTTL);
}
```

```typescript
async refresh(refreshToken: string): Promise<AuthResponseDto> {
    const userId = await this.sessionService.getUserIdFromRefreshToken(refreshToken);
    if (!userId) {
        throw new UnauthorizedException('Invalid or expired session. Please sign in again.');
    }
    const user = await this.prismaService.user.findUnique({ where: { id: userId } });
    if (!user) {
        throw new UnauthorizedException('Invalid or expired session. Please sign in again.');
    }
    await this.sessionService.removeRefreshToken(refreshToken); // Delete old token
    return this.generateTokens(user); // Issue new tokens (rotation)
}
```

Two Redis data structures work together. `refresh:{token}` maps a token to a user ID (the lookup path). `user_sessions:{userId}` is a Redis Set containing all active tokens for that user (the reverse index). Both have a 7-day TTL.

I chose a Redis Set for `user_sessions` because it supports two operations efficiently: adding a token on login (`SADD`, O(1)) and retrieving all tokens for bulk invalidation (`SMEMBERS`, O(n)). A List would also work for retrieval, but Sets prevent duplicates and make individual token removal O(1) with `SREM`.

**Token rotation**: every call to `/auth/refresh` deletes the old refresh token and issues a new one. This limits the damage of a stolen refresh token -- once the legitimate user or the attacker uses it, the other party's copy becomes invalid. If an attacker uses a stolen token first, the legitimate user's next refresh fails, signaling a compromise.

### Interview Questions This Section Answers
- How does refresh token rotation work and what attack does it mitigate?
- Why use a Redis Set for tracking user sessions?
- What happens if a stolen refresh token is used before the legitimate user refreshes?

---

## 9. Session Invalidation

```typescript
async invalidateAllSessions(userId: string): Promise<number> {
    const tokens = await this.redis.smembers(`user_sessions:${userId}`);
    if (tokens.length === 0) return 0;
    const pipeline = this.redis.pipeline();
    for (const token of tokens) {
        pipeline.del(`refresh:${token}`);
    }
    pipeline.del(`user_sessions:${userId}`);
    await pipeline.exec();
    return tokens.length;
}
```

This method deletes every refresh token for a user across all devices. It reads all tokens from the `user_sessions:{userId}` Set, then deletes each `refresh:{token}` key plus the Set itself.

I used a Redis pipeline instead of individual `DEL` commands because a pipeline batches all commands into a single network round-trip. If a user has 5 active sessions, that is 6 deletions (5 tokens + 1 set) in one round-trip instead of 6 separate ones. Pipelines are not atomic (unlike `MULTI/EXEC`), but atomicity is not required here -- partial deletion is still safe because orphaned tokens in the Set will expire via TTL, and orphaned `refresh:` keys without a Set entry are harmless.

This method is called on **password reset** -- when a user resets their password, all existing sessions are invalidated so that an attacker who had access via a stolen credential is immediately logged out everywhere.

### Interview Questions This Section Answers
- Why use a Redis pipeline instead of individual DEL commands?
- When and why do you invalidate all sessions for a user?

---

## 10. Password Reset Flow

```typescript
async resetPassword(token: string, newPassword: string): Promise<MessageResponseDto> {
    const userId = await this.redis.get(`reset:${token}`);
    if (!userId) {
        throw new UnauthorizedException('Invalid or expired reset token.');
    }
    const hashedPassword = await argon2.hash(newPassword);
    await this.prismaService.user.update({ where: { id: userId }, data: { password: hashedPassword } });
    await this.redis.del(`reset:${token}`);
    const invalidatedCount = await this.sessionService.invalidateAllSessions(userId);
    return { message: 'Password reset successfully. You can now log in with your new password.' };
}
```

The full flow:

1. User calls `POST /auth/forgot-password` with their email. A random token is stored at `reset:{token}` in Redis with a 1-hour TTL, and a reset link is emailed.
2. User clicks the link and submits a new password to `POST /auth/reset-password` with the token.
3. The token is looked up in Redis. If missing or expired, the request fails.
4. The new password is hashed with Argon2 and saved. The reset token is deleted (single-use).
5. **All sessions are invalidated.** This is the critical security step -- if the password was reset because the account was compromised, the attacker's existing sessions must be terminated immediately.

I invalidate sessions after password reset (not just password change) because the reset flow implies the previous password may have been compromised. Leaving existing refresh tokens valid would allow an attacker who already has a valid session to remain logged in even after the legitimate user regains access.

### Interview Questions This Section Answers
- Walk through the complete password reset flow.
- Why invalidate all sessions after a password reset?

---

## 11. Role-Based Authorization

The system has two household roles: **OWNER** (creator and administrator) and **MEMBER** (regular participant). Authorization checks happen **inside service methods**, not in route guards.

I chose in-service authorization over guard-based authorization because role requirements are context-dependent. Whether a user needs to be an OWNER depends on what they are doing within a specific household, not just which endpoint they are calling. A guard would need to load the household, find the user's membership, and determine the required role -- all of which the service method already does as part of its business logic. Duplicating this in a guard would mean two database queries per request or awkward data passing between the guard and the service.

Every service method that operates on a shared resource follows the same **fail-fast pattern**: check membership first. If the user is not a member of the household, the method throws immediately before any business logic runs. This keeps the authorization boundary tight and consistent across all 47 endpoints.

**OWNER-only operations**: transferring ownership, managing household settings, removing members, sending invitations. All other operations (creating expenses, viewing dashboards, settling debts) require MEMBER-level access, which OWNER implicitly satisfies.

**HTTP status semantics**: 401 (Unauthorized) means the request has no valid authentication -- the JWT is missing, expired, or invalid. 403 (Forbidden) means the user is authenticated but lacks permission -- they are a MEMBER trying to perform an OWNER action, or they are not a member of the target household.

### Interview Questions This Section Answers
- Why check roles inside service methods instead of using route guards?
- What is the difference between 401 and 403, and when do you use each?
- How do you enforce the fail-fast pattern for authorization checks?
