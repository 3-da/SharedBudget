# Redis Caching Strategy

This document covers every caching decision in the SharedBudget backend: why Redis, how the cache-aside pattern works, how keys are structured for targeted invalidation, and how the same Redis instance serves three distinct roles.

---

## 1. Why Redis for Caching

I chose Redis as the caching layer for four reasons, in order of importance.

**In-memory speed for read-heavy queries.** The dashboard overview aggregates salaries, shared expenses, savings, and settlement calculations into a single response. Without caching, every dashboard load triggers multiple Prisma queries with joins and aggregations. Redis serves the precomputed result in sub-millisecond time, which matters because the dashboard is the most-loaded page in the application.

**Shared state for horizontal scaling.** If you run two backend instances behind a load balancer, an in-memory cache (like a `Map` in the NestJS process) would give each instance its own stale copy. Redis is external to the process, so both instances read and write the same cache. When instance A invalidates a key after a write, instance B's next read sees the fresh data.

**TTL-based auto-expiry.** Redis deletes expired keys automatically. There is no background cleanup job to write, schedule, or monitor. You set `EX 60` when writing a key, and Redis guarantees it disappears after 60 seconds. This eliminates an entire class of "stale cache" bugs where a cleanup job crashes and entries live forever.

**Already in the stack.** Redis was already required for session storage (refresh tokens, verification codes) and rate limiting. Adding caching to the same instance means zero new infrastructure -- no additional Docker container, no additional connection management, no additional monitoring target.

### Interview Questions This Section Answers
- Why use an external cache instead of in-process memory?
- How does Redis support horizontal scaling of stateless backends?
- Why not use a dedicated caching service like Memcached?

---

## 2. Cache-Aside Pattern

The caching layer uses the cache-aside (lazy-loading) pattern, implemented in a single generic method.

```typescript
async getOrSet<T>(key: string, ttl: number, fetchFn: () => Promise<T>): Promise<T> {
    const cached = await this.redis.get(key);
    if (cached) {
        this.logger.debug(`Cache hit: ${key}`);
        return JSON.parse(cached) as T;
    }
    this.logger.debug(`Cache miss: ${key}`);
    const data = await fetchFn();
    await this.redis.set(key, JSON.stringify(data), 'EX', ttl);
    return data;
}
```

The flow is: check Redis for the key, return immediately on a hit, execute the database query on a miss, store the result with a TTL, and return. Every cached read in the application calls `getOrSet` -- there is no separate "populate cache" step.

I chose cache-aside over write-through because writes are infrequent compared to reads. A write-through cache updates the cache on every database write, which adds latency to every mutation even if nobody reads that data before the next write. In SharedBudget, a household might update expenses a few times per day but load the dashboard dozens of times. Cache-aside only pays the database cost on the first read after a write, which matches this access pattern.

The tradeoff is that the first request after invalidation is slower (cache miss + DB query + Redis write). For this application, that single slower request is acceptable because the dashboard response time is under 200ms even without caching.

### Interview Questions This Section Answers
- What is the cache-aside pattern and how does it differ from write-through?
- When would you choose write-through over cache-aside?
- What happens on a cache miss in your implementation?

---

## 3. Key Design and Naming

Every cache key follows a hierarchical structure: `cache:{domain}:{scope}:{params}`.

| Pattern | Purpose | TTL |
|---------|---------|-----|
| `cache:salary:household:{householdId}:{year}:{month}` | Household salaries (by period) | 300s |
| `cache:salary:household:{householdId}:current` | Household salaries (current) | 300s |
| `cache:expenses:personal:{userId}:{filterHash}` | Personal expense lists | 60s |
| `cache:expenses:shared:{householdId}:{filterHash}` | Shared expense lists | 60s |
| `cache:dashboard:{householdId}:{year}:{month}:{mode}` | Dashboard overview | 120s |
| `cache:settlement:{householdId}:{year}:{month}` | Settlement calculation | 120s |
| `cache:approvals:pending:{householdId}` | Pending approvals | 120s |
| `cache:approvals:history:{householdId}:{status}` | Approval history | 120s |
| `cache:savings:{householdId}:{year}:{month}` | Savings data | 120s |

The `{params}` segment is a SHA-256 hash of the query parameters (pagination, filters, date ranges) computed by a `hashParams()` utility. Hashing avoids key-length issues -- a query with six filter parameters produces the same fixed-length suffix regardless of parameter complexity.

The hierarchical structure is not cosmetic. It enables pattern-based deletion. When you need to invalidate all shared expenses for a household, the pattern `cache:shared-expenses:*:{householdId}:*` matches every parameterized variant without knowing what parameters exist. If keys were flat (e.g., `cache-shared-expenses-abc123-def456`), you would need to track every key individually.

### Interview Questions This Section Answers
- How do you design cache keys that support efficient bulk invalidation?
- Why hash query parameters instead of serializing them directly into the key?
- What is the benefit of hierarchical key naming in Redis?

---

## 4. TTL Strategy

Each domain has a TTL tuned to its update frequency.

| Domain | TTL | Rationale |
|--------|-----|-----------|
| Salaries | 300s (5 min) | Salaries change at most once per month. A 5-minute cache is conservative -- it could be longer, but the data is cheap to query. |
| Expenses | 60s (1 min) | Expenses are the most frequently created and updated entity. A short TTL limits how stale the list can get between explicit invalidations. |
| Dashboard | 120s (2 min) | Aggregated view that tolerates slight staleness. Users check it periodically, not continuously. |
| Settlement | 120s (2 min) | Computed from expenses and salaries. Invalidated together with the dashboard since they share input data. |
| Approvals | 120s (2 min) | Pending approvals matter for notification counts but do not need real-time accuracy. |
| Savings | 120s (2 min) | Historical savings data changes only on month boundaries or manual adjustments. |

All TTLs are configurable via environment variables (`CACHE_TTL_SALARIES`, `CACHE_TTL_EXPENSES`, `CACHE_TTL_SUMMARY`, `CACHE_TTL_SETTLEMENT`), defaulting to the values above. This lets you tune caching per environment -- shorter TTLs in staging for faster feedback, longer in production for better hit rates.

### Interview Questions This Section Answers
- How do you decide on TTL values for different types of cached data?
- Why not use a single TTL for all cache entries?
- How do you make cache configuration adjustable across environments?

---

## 5. Invalidation: Nuclear vs. Granular

The system provides two invalidation strategies.

**Granular invalidation** targets a single domain. Each method uses a SCAN pattern scoped to one data type:

- `invalidateSalaries(householdId)` -- pattern `cache:salary:household:{householdId}:*`
- `invalidatePersonalExpenses(userId)` -- pattern `cache:expenses:personal:{userId}:*`
- `invalidateSharedExpenses(householdId)` -- pattern `cache:expenses:shared:{householdId}:*`
- `invalidateDashboard(householdId)` -- pattern `cache:dashboard:{householdId}:*` + `cache:settlement:{householdId}:*`
- `invalidateApprovals(householdId)` -- pattern `cache:approvals:*:{householdId}*`
- `invalidateSavings(householdId)` -- pattern `cache:savings:{householdId}:*`

Granular invalidation is used for isolated changes: adding a single expense, updating a salary, modifying savings. It avoids touching unrelated caches.

**Nuclear invalidation** wipes every cache key for a household:

```typescript
async invalidateHousehold(householdId: string): Promise<void> {
    await this.invalidatePattern(`cache:*:*:${householdId}:*`);
    await this.invalidatePattern(`cache:*:${householdId}:*`);
    await this.invalidatePattern(`cache:*:${householdId}`);
    this.logger.log(`All caches invalidated for household: ${householdId}`);
}
```

Three patterns are needed because keys have varying depths -- some have a params suffix, some end with the householdId, and some have an extra segment before the householdId (like `cache:approvals:pending:{householdId}`).

Nuclear invalidation is used when a single action affects multiple domains simultaneously. The primary case is approval acceptance: accepting an expense approval can create, update, or delete an expense, which affects the expense list, the dashboard aggregation, the settlement calculation, and the approval history. Rather than calling five granular methods and risking a missed one, `invalidateHousehold` guarantees a clean slate.

### Interview Questions This Section Answers
- When would you invalidate an entire cache namespace versus a single key?
- How do you handle operations that affect multiple cached domains at once?
- What are the tradeoffs between aggressive and targeted cache invalidation?

---

## 6. The invalidatePattern Implementation

Pattern-based deletion uses Redis's `SCAN` command via ioredis's `scanStream`, not the `KEYS` command.

```typescript
async invalidatePattern(pattern: string): Promise<void> {
    const stream = this.redis.scanStream({ match: pattern, count: 100 });
    const keysToDelete: string[] = [];
    return new Promise((resolve, reject) => {
        stream.on('data', (keys: string[]) => { keysToDelete.push(...keys); });
        stream.on('end', async () => {
            if (keysToDelete.length > 0) {
                await this.redis.del(...keysToDelete);
            }
            resolve();
        });
        stream.on('error', (err) => { reject(err); });
    });
}
```

`KEYS` is an O(N) command that blocks the Redis event loop for the entire keyspace scan. On a production instance with millions of keys, a single `KEYS cache:*` call can freeze Redis for seconds, blocking every other client. `SCAN` iterates incrementally with a cursor, returning a batch of results per call (`count: 100` suggests a batch size, though Redis treats it as a hint). The event loop remains responsive between iterations.

The implementation collects all matching keys first, then deletes them in a single `DEL` call. This is simpler than deleting during iteration and avoids partial-invalidation states where some keys are deleted and others are not yet scanned.

### Interview Questions This Section Answers
- Why is the Redis `KEYS` command dangerous in production?
- How does `SCAN` differ from `KEYS` in terms of blocking behavior?
- How would you delete all keys matching a pattern in Redis without blocking?

---

## 7. Redis for Sessions and Rate Limiting

The same Redis instance serves three distinct purposes, separated by key prefix conventions.

**Session keys** use domain-specific prefixes with no `cache:` namespace:

| Key | Purpose | TTL |
|-----|---------|-----|
| `refresh:{token}` | Maps refresh token to userId | 7 days |
| `user_sessions:{userId}` | Set of active refresh tokens for a user | 7 days |
| `verify:{email}` | Email verification code | 10 min |
| `reset:{token}` | Password reset token | 1 hour |

Session keys are never bulk-invalidated by cache patterns because they lack the `cache:` prefix. The `invalidateHousehold` patterns (`cache:*:...`) cannot match `refresh:abc123` or `user_sessions:xyz`. This separation is intentional -- you never want a cache flush to log users out.

**Rate limiting** uses `ThrottlerRedisStorage`, a custom adapter that connects NestJS's `@nestjs/throttler` module to Redis. Each rate limit counter is a Redis key with its own TTL. Because counters live in Redis rather than in-process memory, rate limits are enforced consistently across multiple backend instances. A user cannot bypass a 5-request-per-minute limit by having their requests load-balanced across two servers.

### Interview Questions This Section Answers
- How do you use a single Redis instance for multiple concerns without interference?
- Why store rate limit counters in Redis instead of in-process memory?
- How do you prevent cache invalidation from affecting session data?

---

## 8. Known Limitations and Future Improvements

**Cache stampede risk.** If a popular cache key expires and 50 concurrent requests arrive, all 50 will miss the cache and hit the database simultaneously. The current `getOrSet` implementation has no stampede protection. Solutions include a distributed lock (only one request fetches, others wait) or early expiry (refresh the cache before the TTL expires using a background process). I have not implemented either because the application's concurrency level does not currently produce stampedes -- a household has at most a handful of members.

**No compression for large payloads.** Cached responses are stored as raw JSON strings. For large expense lists, this can consume significant Redis memory. Compressing with zlib or snappy before storing and decompressing after retrieval would reduce memory usage at the cost of CPU time. The current dataset sizes do not justify this complexity.

**No cache warming.** The cache starts cold on every deployment. The first request for each data type after a deploy pays the full database query cost. A warming script that pre-populates frequently accessed keys (active household dashboards) would eliminate this cold-start penalty.

**Pre-production hardening.** The Redis connection currently lacks TLS encryption, retry/reconnect strategies, and command restrictions. These are documented in the pre-production checklist in `CLAUDE.md` and must be addressed before production deployment.

### Interview Questions This Section Answers
- What is a cache stampede and how would you prevent it?
- When would you add compression to cached values?
- What is cache warming and when is it worth implementing?
- What Redis security measures are needed before going to production?
