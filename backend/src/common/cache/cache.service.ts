import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { REDIS_CLIENT } from '../../redis/redis.module';
import Redis from 'ioredis';
import { createHash } from 'crypto';

@Injectable()
export class CacheService {
    private readonly logger = new Logger(CacheService.name);

    private readonly ttlSalaries: number;
    private readonly ttlExpenses: number;
    private readonly ttlSummary: number;
    private readonly ttlSettlement: number;

    constructor(
        @Inject(REDIS_CLIENT) private readonly redis: Redis,
        private readonly configService: ConfigService,
    ) {
        this.ttlSalaries = this.configService.get<number>('CACHE_TTL_SALARIES', 300);
        this.ttlExpenses = this.configService.get<number>('CACHE_TTL_EXPENSES', 60);
        this.ttlSummary = this.configService.get<number>('CACHE_TTL_SUMMARY', 120);
        this.ttlSettlement = this.configService.get<number>('CACHE_TTL_SETTLEMENT', 120);

        this.logger.debug(
            `Cache TTLs: salaries=${this.ttlSalaries}s, expenses=${this.ttlExpenses}s, summary=${this.ttlSummary}s, settlement=${this.ttlSettlement}s`,
        );
    }

    //#region TTL getters
    get salariesTTL(): number {
        return this.ttlSalaries;
    }

    get expensesTTL(): number {
        return this.ttlExpenses;
    }

    get summaryTTL(): number {
        return this.ttlSummary;
    }

    get settlementTTL(): number {
        return this.ttlSettlement;
    }
    //#endregion

    //#region Generic Cache Operations
    /**
     * Cache-aside pattern: returns cached value if exists, otherwise calls fetchFn,
     * caches the result, and returns it.
     *
     * @param key - The cache key
     * @param ttl - Time-to-live in seconds
     * @param fetchFn - Function to fetch data if cache miss
     * @returns The cached or freshly fetched data
     */
    async getOrSet<T>(key: string, ttl: number, fetchFn: () => Promise<T>): Promise<T> {
        const cached = await this.redis.get(key);

        if (cached) {
            this.logger.debug(`Cache hit: ${key}`);
            return JSON.parse(cached) as T;
        }

        this.logger.debug(`Cache miss: ${key}`);
        const data = await fetchFn();

        await this.redis.set(key, JSON.stringify(data), 'EX', ttl);
        this.logger.debug(`Cache set: ${key} (TTL: ${ttl}s)`);

        return data;
    }
    //#endregion

    //#region Key Builders
    /**
     * Builds a cache key for salary data.
     *
     * @param householdId - The household ID
     * @param year - Optional year (if not provided, uses "current")
     * @param month - Optional month (if not provided, uses "current")
     * @returns The cache key
     */
    salaryKey(householdId: string, year?: number, month?: number): string {
        if (year !== undefined && month !== undefined) return `cache:salary:household:${householdId}:${year}:${month}`;
        return `cache:salary:household:${householdId}:current`;
    }

    /**
     * Builds a cache key for personal expenses.
     *
     * @param userId - The user ID
     * @param filterHash - A hash of the filter parameters
     * @returns The cache key
     */
    personalExpensesKey(userId: string, filterHash: string): string {
        return `cache:expenses:personal:${userId}:${filterHash}`;
    }

    /**
     * Builds a cache key for shared expenses.
     *
     * @param householdId - The household ID
     * @param filterHash - A hash of the filter parameters
     * @returns The cache key
     */
    sharedExpensesKey(householdId: string, filterHash: string): string {
        return `cache:expenses:shared:${householdId}:${filterHash}`;
    }

    /**
     * Builds a cache key for dashboard data.
     *
     * @param householdId - The household ID
     * @param year - The year
     * @param month - The month (1-12)
     * @returns The cache key
     */
    dashboardKey(householdId: string, year: number, month: number): string {
        return `cache:dashboard:${householdId}:${year}:${month}`;
    }

    /**
     * Builds a cache key for settlement data.
     *
     * @param householdId - The household ID
     * @param year - The year
     * @param month - The month (1-12)
     * @returns The cache key
     */
    settlementKey(householdId: string, year: number, month: number): string {
        return `cache:settlement:${householdId}:${year}:${month}`;
    }

    /**
     * Builds a cache key for pending approvals.
     *
     * @param householdId - The household ID
     * @returns The cache key
     */
    pendingApprovalsKey(householdId: string): string {
        return `cache:approvals:pending:${householdId}`;
    }

    /**
     * Builds a cache key for approval history.
     *
     * @param householdId - The household ID
     * @param status - Optional status filter
     * @returns The cache key
     */
    approvalHistoryKey(householdId: string, status?: string): string {
        return `cache:approvals:history:${householdId}:${status ?? 'all'}`;
    }

    /**
     * Builds a cache key for savings data.
     *
     * @param householdId - The household ID
     * @param year - The year
     * @param month - The month (1-12)
     * @returns The cache key
     */
    savingsKey(householdId: string, year: number, month: number): string {
        return `cache:savings:${householdId}:${year}:${month}`;
    }
    //#endregion

    //#region Utility Methods
    /**
     * Creates a hash from query/filter parameters for use in cache keys.
     * Ensures consistent hashing regardless of property order.
     *
     * @param params - The query parameters object
     * @returns A short hash string
     */
    hashParams(params: Record<string, any>): string {
        const sorted = Object.keys(params)
            .filter((k) => params[k] !== undefined && params[k] !== null)
            .sort()
            .map((k) => `${k}:${params[k]}`)
            .join('|');

        if (!sorted) return 'default';

        return createHash('sha256').update(sorted).digest('hex').slice(0, 12);
    }
    //#endregion

    //#region Invalidation Helpers
    /**
     * Invalidates a single cache key.
     *
     * @param key - The cache key to delete
     */
    async invalidate(key: string): Promise<void> {
        await this.redis.del(key);
        this.logger.debug(`Cache invalidated: ${key}`);
    }

    /**
     * Invalidates all keys matching a pattern using SCAN to avoid blocking Redis.
     * Pattern uses Redis glob-style matching (e.g., "cache:salary:household:*").
     *
     * @param pattern - The pattern to match (Redis MATCH syntax)
     */
    async invalidatePattern(pattern: string): Promise<void> {
        const stream = this.redis.scanStream({ match: pattern, count: 100 });
        const keysToDelete: string[] = [];

        return new Promise((resolve, reject) => {
            stream.on('data', (keys: string[]) => {
                keysToDelete.push(...keys);
            });

            stream.on('end', async () => {
                if (keysToDelete.length > 0) {
                    await this.redis.del(...keysToDelete);
                    this.logger.debug(`Cache pattern invalidated: ${pattern} (${keysToDelete.length} keys)`);
                }
                resolve();
            });

            stream.on('error', (err) => {
                this.logger.error(`Cache pattern invalidation failed: ${pattern}`, err);
                reject(err);
            });
        });
    }

    /**
     * Invalidates all cache keys associated with a household.
     * This includes salaries, expenses, dashboard, settlement, and approvals.
     *
     * @param householdId - The household ID
     */
    async invalidateHousehold(householdId: string): Promise<void> {
        await this.invalidatePattern(`cache:*:*:${householdId}:*`);
        await this.invalidatePattern(`cache:*:${householdId}:*`);
        await this.invalidatePattern(`cache:*:${householdId}`);
        this.logger.log(`All caches invalidated for household: ${householdId}`);
    }

    /**
     * Invalidates all salary caches for a household.
     *
     * @param householdId - The household ID
     */
    async invalidateSalaries(householdId: string): Promise<void> {
        await this.invalidatePattern(`cache:salary:household:${householdId}:*`);
        this.logger.debug(`Salary caches invalidated for household: ${householdId}`);
    }

    /**
     * Invalidates all personal expense caches for a user.
     *
     * @param userId - The user ID
     */
    async invalidatePersonalExpenses(userId: string): Promise<void> {
        await this.invalidatePattern(`cache:expenses:personal:${userId}:*`);
        this.logger.debug(`Personal expense caches invalidated for user: ${userId}`);
    }

    /**
     * Invalidates all shared expense caches for a household.
     *
     * @param householdId - The household ID
     */
    async invalidateSharedExpenses(householdId: string): Promise<void> {
        await this.invalidatePattern(`cache:expenses:shared:${householdId}:*`);
        this.logger.debug(`Shared expense caches invalidated for household: ${householdId}`);
    }

    /**
     * Invalidates all dashboard caches for a household.
     *
     * @param householdId - The household ID
     */
    async invalidateDashboard(householdId: string): Promise<void> {
        await this.invalidatePattern(`cache:dashboard:${householdId}:*`);
        await this.invalidatePattern(`cache:settlement:${householdId}:*`);
        this.logger.debug(`Dashboard and settlement caches invalidated for household: ${householdId}`);
    }

    /**
     * Invalidates all approval caches for a household.
     *
     * @param householdId - The household ID
     */
    async invalidateApprovals(householdId: string): Promise<void> {
        await this.invalidatePattern(`cache:approvals:*:${householdId}*`);
        this.logger.debug(`Approval caches invalidated for household: ${householdId}`);
    }

    /**
     * Invalidates savings cache for a household.
     *
     * @param householdId - The household ID
     */
    async invalidateSavings(householdId: string): Promise<void> {
        await this.invalidatePattern(`cache:savings:${householdId}:*`);
        this.logger.debug(`Savings caches invalidated for household: ${householdId}`);
    }
    //#endregion
}
