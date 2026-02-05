import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CacheService } from './cache.service';
import { REDIS_CLIENT } from '../../redis/redis.module';
import { EventEmitter } from 'events';

describe('CacheService', () => {
    let cacheService: CacheService;

    const mockScanStream = () => {
        const emitter = new EventEmitter();
        // Delay emission to simulate async behavior
        setTimeout(() => {
            emitter.emit('data', ['cache:test:key1', 'cache:test:key2']);
            emitter.emit('end');
        }, 0);
        return emitter;
    };

    const mockRedis = {
        get: vi.fn(),
        set: vi.fn(),
        del: vi.fn(),
        scanStream: vi.fn(() => mockScanStream()),
    };

    const mockConfigService = {
        get: vi.fn((key: string, defaultValue: number) => {
            const config: Record<string, number> = {
                CACHE_TTL_SALARIES: 300,
                CACHE_TTL_EXPENSES: 60,
                CACHE_TTL_SUMMARY: 120,
                CACHE_TTL_SETTLEMENT: 120,
            };
            return config[key] ?? defaultValue;
        }),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [CacheService, { provide: REDIS_CLIENT, useValue: mockRedis }, { provide: ConfigService, useValue: mockConfigService }],
        }).compile();

        cacheService = module.get<CacheService>(CacheService);

        vi.clearAllMocks();
    });

    describe('TTL getters', () => {
        it('should return configured salariesTTL', () => {
            expect(cacheService.salariesTTL).toBe(300);
        });

        it('should return configured expensesTTL', () => {
            expect(cacheService.expensesTTL).toBe(60);
        });

        it('should return configured summaryTTL', () => {
            expect(cacheService.summaryTTL).toBe(120);
        });

        it('should return configured settlementTTL', () => {
            expect(cacheService.settlementTTL).toBe(120);
        });
    });

    describe('getOrSet', () => {
        it('should return cached value on cache hit', async () => {
            const cachedData = { userId: 'user-123', amount: 5000 };
            mockRedis.get.mockResolvedValue(JSON.stringify(cachedData));

            const fetchFn = vi.fn().mockResolvedValue({ userId: 'user-123', amount: 9999 });

            const result = await cacheService.getOrSet('cache:test:key', 300, fetchFn);

            expect(mockRedis.get).toHaveBeenCalledWith('cache:test:key');
            expect(fetchFn).not.toHaveBeenCalled();
            expect(result).toEqual(cachedData);
        });

        it('should call fetchFn and cache result on cache miss', async () => {
            mockRedis.get.mockResolvedValue(null);
            const freshData = { userId: 'user-123', amount: 5000 };
            const fetchFn = vi.fn().mockResolvedValue(freshData);

            const result = await cacheService.getOrSet('cache:test:key', 300, fetchFn);

            expect(mockRedis.get).toHaveBeenCalledWith('cache:test:key');
            expect(fetchFn).toHaveBeenCalled();
            expect(mockRedis.set).toHaveBeenCalledWith('cache:test:key', JSON.stringify(freshData), 'EX', 300);
            expect(result).toEqual(freshData);
        });

        it('should propagate errors from fetchFn', async () => {
            mockRedis.get.mockResolvedValue(null);
            const fetchFn = vi.fn().mockRejectedValue(new Error('Database error'));

            await expect(cacheService.getOrSet('cache:test:key', 300, fetchFn)).rejects.toThrow('Database error');

            expect(mockRedis.set).not.toHaveBeenCalled();
        });

        it('should handle complex nested objects', async () => {
            mockRedis.get.mockResolvedValue(null);
            const complexData = {
                members: [
                    { userId: 'u1', savings: 1000 },
                    { userId: 'u2', savings: 2000 },
                ],
                totals: { defaultSavings: 3000, currentSavings: 2500 },
            };
            const fetchFn = vi.fn().mockResolvedValue(complexData);

            const result = await cacheService.getOrSet('cache:test:complex', 60, fetchFn);

            expect(result).toEqual(complexData);
            expect(mockRedis.set).toHaveBeenCalledWith('cache:test:complex', JSON.stringify(complexData), 'EX', 60);
        });

        it('should handle arrays', async () => {
            mockRedis.get.mockResolvedValue(null);
            const arrayData = [
                { id: '1', name: 'Expense 1' },
                { id: '2', name: 'Expense 2' },
            ];
            const fetchFn = vi.fn().mockResolvedValue(arrayData);

            const result = await cacheService.getOrSet('cache:test:array', 60, fetchFn);

            expect(result).toEqual(arrayData);
        });
    });

    describe('invalidate', () => {
        it('should delete the specified key', async () => {
            await cacheService.invalidate('cache:test:key');

            expect(mockRedis.del).toHaveBeenCalledWith('cache:test:key');
        });
    });

    describe('invalidatePattern', () => {
        it('should use SCAN stream to find and delete matching keys', async () => {
            await cacheService.invalidatePattern('cache:test:*');

            expect(mockRedis.scanStream).toHaveBeenCalledWith({ match: 'cache:test:*', count: 100 });
            expect(mockRedis.del).toHaveBeenCalledWith('cache:test:key1', 'cache:test:key2');
        });

        it('should not call del when no keys match', async () => {
            mockRedis.scanStream.mockReturnValue(
                (() => {
                    const emitter = new EventEmitter();
                    setTimeout(() => {
                        emitter.emit('data', []);
                        emitter.emit('end');
                    }, 0);
                    return emitter;
                })(),
            );

            await cacheService.invalidatePattern('cache:nonexistent:*');

            expect(mockRedis.del).not.toHaveBeenCalled();
        });

        it('should reject on stream error', async () => {
            mockRedis.scanStream.mockReturnValue(
                (() => {
                    const emitter = new EventEmitter();
                    setTimeout(() => {
                        emitter.emit('error', new Error('Redis connection lost'));
                    }, 0);
                    return emitter;
                })(),
            );

            await expect(cacheService.invalidatePattern('cache:test:*')).rejects.toThrow('Redis connection lost');
        });
    });

    describe('invalidateHousehold', () => {
        it('should invalidate all household-related patterns', async () => {
            const invalidatePatternSpy = vi.spyOn(cacheService, 'invalidatePattern').mockResolvedValue();

            await cacheService.invalidateHousehold('household-123');

            expect(invalidatePatternSpy).toHaveBeenCalledWith('cache:*:*:household-123:*');
            expect(invalidatePatternSpy).toHaveBeenCalledWith('cache:*:household-123:*');
        });
    });

    describe('key builders', () => {
        describe('salaryKey', () => {
            it('should build key with year and month', () => {
                const key = cacheService.salaryKey('hh-123', 2026, 2);

                expect(key).toBe('cache:salary:household:hh-123:2026:2');
            });

            it('should build key for current period when year/month not provided', () => {
                const key = cacheService.salaryKey('hh-123');

                expect(key).toBe('cache:salary:household:hh-123:current');
            });
        });

        describe('personalExpensesKey', () => {
            it('should build key with user ID and filter hash', () => {
                const key = cacheService.personalExpensesKey('user-456', 'abc123');

                expect(key).toBe('cache:expenses:personal:user-456:abc123');
            });
        });

        describe('sharedExpensesKey', () => {
            it('should build key with household ID and filter hash', () => {
                const key = cacheService.sharedExpensesKey('hh-123', 'def456');

                expect(key).toBe('cache:expenses:shared:hh-123:def456');
            });
        });

        describe('dashboardKey', () => {
            it('should build key with household, year, and month', () => {
                const key = cacheService.dashboardKey('hh-123', 2026, 2);

                expect(key).toBe('cache:dashboard:hh-123:2026:2');
            });
        });

        describe('settlementKey', () => {
            it('should build key with household, year, and month', () => {
                const key = cacheService.settlementKey('hh-123', 2026, 2);

                expect(key).toBe('cache:settlement:hh-123:2026:2');
            });
        });

        describe('savingsKey', () => {
            it('should build key with household, year, and month', () => {
                const key = cacheService.savingsKey('hh-123', 2026, 2);

                expect(key).toBe('cache:savings:hh-123:2026:2');
            });
        });

        describe('pendingApprovalsKey', () => {
            it('should build key with household ID', () => {
                const key = cacheService.pendingApprovalsKey('hh-123');

                expect(key).toBe('cache:approvals:pending:hh-123');
            });
        });

        describe('approvalHistoryKey', () => {
            it('should build key with status', () => {
                const key = cacheService.approvalHistoryKey('hh-123', 'ACCEPTED');

                expect(key).toBe('cache:approvals:history:hh-123:ACCEPTED');
            });

            it('should build key with "all" when status not provided', () => {
                const key = cacheService.approvalHistoryKey('hh-123');

                expect(key).toBe('cache:approvals:history:hh-123:all');
            });
        });
    });

    describe('hashParams', () => {
        it('should return consistent hash for same params regardless of order', () => {
            const hash1 = cacheService.hashParams({ category: 'HOUSING', frequency: 'MONTHLY' });
            const hash2 = cacheService.hashParams({ frequency: 'MONTHLY', category: 'HOUSING' });

            expect(hash1).toBe(hash2);
        });

        it('should return "default" for empty or all-undefined params', () => {
            expect(cacheService.hashParams({})).toBe('default');
            expect(cacheService.hashParams({ category: undefined, frequency: null })).toBe('default');
        });

        it('should return different hashes for different params', () => {
            const hash1 = cacheService.hashParams({ category: 'HOUSING' });
            const hash2 = cacheService.hashParams({ category: 'UTILITIES' });

            expect(hash1).not.toBe(hash2);
        });

        it('should ignore undefined and null values', () => {
            const hash1 = cacheService.hashParams({ category: 'HOUSING' });
            const hash2 = cacheService.hashParams({ category: 'HOUSING', frequency: undefined, other: null });

            expect(hash1).toBe(hash2);
        });

        it('should produce 12-character hash', () => {
            const hash = cacheService.hashParams({ category: 'HOUSING', frequency: 'MONTHLY' });

            expect(hash.length).toBe(12);
        });
    });

    describe('invalidation helpers', () => {
        let invalidatePatternSpy: ReturnType<typeof vi.spyOn>;

        beforeEach(() => {
            invalidatePatternSpy = vi.spyOn(cacheService, 'invalidatePattern').mockResolvedValue();
        });

        describe('invalidateSalaries', () => {
            it('should invalidate salary pattern for household', async () => {
                await cacheService.invalidateSalaries('hh-123');

                expect(invalidatePatternSpy).toHaveBeenCalledWith('cache:salary:household:hh-123:*');
            });
        });

        describe('invalidatePersonalExpenses', () => {
            it('should invalidate personal expenses pattern for user', async () => {
                await cacheService.invalidatePersonalExpenses('user-456');

                expect(invalidatePatternSpy).toHaveBeenCalledWith('cache:expenses:personal:user-456:*');
            });
        });

        describe('invalidateSharedExpenses', () => {
            it('should invalidate shared expenses pattern for household', async () => {
                await cacheService.invalidateSharedExpenses('hh-123');

                expect(invalidatePatternSpy).toHaveBeenCalledWith('cache:expenses:shared:hh-123:*');
            });
        });

        describe('invalidateDashboard', () => {
            it('should invalidate both dashboard and settlement patterns', async () => {
                await cacheService.invalidateDashboard('hh-123');

                expect(invalidatePatternSpy).toHaveBeenCalledWith('cache:dashboard:hh-123:*');
                expect(invalidatePatternSpy).toHaveBeenCalledWith('cache:settlement:hh-123:*');
            });
        });

        describe('invalidateApprovals', () => {
            it('should invalidate all approval patterns for household', async () => {
                await cacheService.invalidateApprovals('hh-123');

                expect(invalidatePatternSpy).toHaveBeenCalledWith('cache:approvals:*:hh-123*');
            });
        });

        describe('invalidateSavings', () => {
            it('should invalidate savings pattern for household', async () => {
                await cacheService.invalidateSavings('hh-123');

                expect(invalidatePatternSpy).toHaveBeenCalledWith('cache:savings:hh-123:*');
            });
        });
    });
});
