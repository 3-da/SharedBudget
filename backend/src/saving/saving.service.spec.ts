import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SavingService } from './saving.service';
import { PrismaService } from '../prisma/prisma.service';
import { ExpenseHelperService } from '../common/expense/expense-helper.service';
import { CacheService } from '../common/cache/cache.service';

describe('SavingService', () => {
    let service: SavingService;

    const mockUserId = 'user-123';
    const mockHouseholdId = 'household-456';

    const mockMembership = {
        userId: mockUserId,
        householdId: mockHouseholdId,
        role: 'MEMBER',
    };

    const mockPersonalSaving = {
        id: 'saving-001',
        userId: mockUserId,
        householdId: mockHouseholdId,
        amount: 200,
        month: 6,
        year: 2026,
        isShared: false,
        createdAt: new Date('2026-06-01T10:00:00.000Z'),
        updatedAt: new Date('2026-06-01T10:00:00.000Z'),
    };

    const mockSharedSaving = {
        ...mockPersonalSaving,
        id: 'saving-002',
        amount: 100,
        isShared: true,
    };

    const mockPrismaService = {
        saving: {
            findMany: vi.fn(),
            upsert: vi.fn(),
        },
    };

    const mockExpenseHelper = {
        requireMembership: vi.fn(),
    };

    const mockCacheService = {
        invalidateSavings: vi.fn(),
        invalidateDashboard: vi.fn(),
        savingsKey: vi.fn().mockReturnValue('cache:savings:household-456:2026:6'),
        summaryTTL: 120,
        getOrSet: vi.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                SavingService,
                { provide: PrismaService, useValue: mockPrismaService },
                { provide: ExpenseHelperService, useValue: mockExpenseHelper },
                { provide: CacheService, useValue: mockCacheService },
            ],
        }).compile();

        service = module.get<SavingService>(SavingService);

        vi.clearAllMocks();
    });

    //#region getMySavings
    describe('getMySavings', () => {
        it('should return personal and shared savings for the current month', async () => {
            // Arrange
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.saving.findMany.mockResolvedValue([mockPersonalSaving, mockSharedSaving]);

            // Act
            const result = await service.getMySavings(mockUserId);

            // Assert
            expect(mockExpenseHelper.requireMembership).toHaveBeenCalledWith(mockUserId);
            expect(mockPrismaService.saving.findMany).toHaveBeenCalledWith({
                where: {
                    userId: mockUserId,
                    month: expect.any(Number),
                    year: expect.any(Number),
                },
                orderBy: { isShared: 'asc' },
            });
            expect(result).toHaveLength(2);
            expect(result[0].isShared).toBe(false);
            expect(result[1].isShared).toBe(true);
        });

        it('should return empty array when no savings exist for the month', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.saving.findMany.mockResolvedValue([]);

            const result = await service.getMySavings(mockUserId);

            expect(result).toEqual([]);
        });

        it('should throw NotFoundException if user is not in a household', async () => {
            mockExpenseHelper.requireMembership.mockRejectedValue(new NotFoundException('You must be in a household to manage expenses'));

            try {
                await service.getMySavings(mockUserId);
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error: any) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('You must be in a household to manage expenses');
            }

            expect(mockPrismaService.saving.findMany).not.toHaveBeenCalled();
        });

        it('should map Decimal amounts to numbers in response', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.saving.findMany.mockResolvedValue([mockPersonalSaving]);

            const result = await service.getMySavings(mockUserId);

            expect(typeof result[0].amount).toBe('number');
            expect(result[0].amount).toBe(200);
        });

        it('should map all fields correctly in response', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.saving.findMany.mockResolvedValue([mockPersonalSaving]);

            const result = await service.getMySavings(mockUserId);

            expect(result[0]).toEqual({
                id: 'saving-001',
                userId: mockUserId,
                householdId: mockHouseholdId,
                amount: 200,
                month: 6,
                year: 2026,
                isShared: false,
                createdAt: mockPersonalSaving.createdAt,
                updatedAt: mockPersonalSaving.updatedAt,
            });
        });
    });
    //#endregion

    //#region upsertPersonalSaving
    describe('upsertPersonalSaving', () => {
        const dto = { amount: 200 };

        it('should create or update a personal saving and return the response', async () => {
            // Arrange
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.saving.upsert.mockResolvedValue(mockPersonalSaving);

            // Act
            const result = await service.upsertPersonalSaving(mockUserId, dto);

            // Assert
            expect(mockExpenseHelper.requireMembership).toHaveBeenCalledWith(mockUserId);
            expect(mockPrismaService.saving.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        userId_month_year_isShared: {
                            userId: mockUserId,
                            month: expect.any(Number),
                            year: expect.any(Number),
                            isShared: false,
                        },
                    },
                    create: expect.objectContaining({
                        userId: mockUserId,
                        householdId: mockHouseholdId,
                        isShared: false,
                    }),
                }),
            );
            expect(result.id).toBe('saving-001');
            expect(result.amount).toBe(200);
            expect(result.isShared).toBe(false);
        });

        it('should use provided month and year when specified', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.saving.upsert.mockResolvedValue({
                ...mockPersonalSaving,
                month: 3,
                year: 2026,
            });

            await service.upsertPersonalSaving(mockUserId, { amount: 200, month: 3, year: 2026 });

            expect(mockPrismaService.saving.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        userId_month_year_isShared: {
                            userId: mockUserId,
                            month: 3,
                            year: 2026,
                            isShared: false,
                        },
                    },
                }),
            );
        });

        it('should invalidate savings and dashboard cache', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.saving.upsert.mockResolvedValue(mockPersonalSaving);

            await service.upsertPersonalSaving(mockUserId, dto);

            expect(mockCacheService.invalidateSavings).toHaveBeenCalledWith(mockHouseholdId);
            expect(mockCacheService.invalidateDashboard).toHaveBeenCalledWith(mockHouseholdId);
        });

        it('should throw NotFoundException if user is not in a household', async () => {
            mockExpenseHelper.requireMembership.mockRejectedValue(new NotFoundException('You must be in a household to manage expenses'));

            try {
                await service.upsertPersonalSaving(mockUserId, dto);
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error: any) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('You must be in a household to manage expenses');
            }

            expect(mockPrismaService.saving.upsert).not.toHaveBeenCalled();
        });

        it('should handle amount of 0 (clearing savings)', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.saving.upsert.mockResolvedValue({
                ...mockPersonalSaving,
                amount: 0,
            });

            const result = await service.upsertPersonalSaving(mockUserId, { amount: 0 });

            expect(result.amount).toBe(0);
        });

        it('should handle boundary month value 1 (January)', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.saving.upsert.mockResolvedValue({
                ...mockPersonalSaving,
                month: 1,
            });

            const result = await service.upsertPersonalSaving(mockUserId, { amount: 200, month: 1, year: 2026 });

            expect(result.month).toBe(1);
        });

        it('should handle boundary month value 12 (December)', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.saving.upsert.mockResolvedValue({
                ...mockPersonalSaving,
                month: 12,
            });

            const result = await service.upsertPersonalSaving(mockUserId, { amount: 200, month: 12, year: 2026 });

            expect(result.month).toBe(12);
        });
    });
    //#endregion

    //#region getHouseholdSavings
    describe('getHouseholdSavings', () => {
        it('should return cached household savings using getOrSet', async () => {
            // Arrange
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            const mappedSavings = [
                {
                    id: 'saving-001',
                    userId: mockUserId,
                    householdId: mockHouseholdId,
                    amount: 200,
                    month: 6,
                    year: 2026,
                    isShared: false,
                    createdAt: mockPersonalSaving.createdAt,
                    updatedAt: mockPersonalSaving.updatedAt,
                },
            ];
            mockCacheService.getOrSet.mockResolvedValue(mappedSavings);

            // Act
            const result = await service.getHouseholdSavings(mockUserId);

            // Assert
            expect(mockExpenseHelper.requireMembership).toHaveBeenCalledWith(mockUserId);
            expect(mockCacheService.savingsKey).toHaveBeenCalledWith(mockHouseholdId, expect.any(Number), expect.any(Number));
            expect(mockCacheService.getOrSet).toHaveBeenCalledWith('cache:savings:household-456:2026:6', 120, expect.any(Function));
            expect(result).toEqual(mappedSavings);
        });

        it('should throw NotFoundException if user is not in a household', async () => {
            mockExpenseHelper.requireMembership.mockRejectedValue(new NotFoundException('You must be in a household to manage expenses'));

            try {
                await service.getHouseholdSavings(mockUserId);
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error: any) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('You must be in a household to manage expenses');
            }

            expect(mockCacheService.getOrSet).not.toHaveBeenCalled();
        });

        it('should execute the fetch function when cache misses', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            // Simulate cache miss by executing the fetch function
            mockCacheService.getOrSet.mockImplementation(async (_key, _ttl, fetchFn) => {
                return fetchFn();
            });
            mockPrismaService.saving.findMany.mockResolvedValue([mockPersonalSaving]);

            const result = await service.getHouseholdSavings(mockUserId);

            expect(mockPrismaService.saving.findMany).toHaveBeenCalledWith({
                where: {
                    householdId: mockHouseholdId,
                    month: expect.any(Number),
                    year: expect.any(Number),
                },
                orderBy: [{ userId: 'asc' }, { isShared: 'asc' }],
            });
            expect(result).toHaveLength(1);
            expect(result[0].amount).toBe(200);
        });
    });
    //#endregion

    //#region upsertSharedSaving
    describe('upsertSharedSaving', () => {
        const dto = { amount: 100 };

        it('should create or update a shared saving and return the response', async () => {
            // Arrange
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.saving.upsert.mockResolvedValue(mockSharedSaving);

            // Act
            const result = await service.upsertSharedSaving(mockUserId, dto);

            // Assert
            expect(mockPrismaService.saving.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        userId_month_year_isShared: {
                            userId: mockUserId,
                            month: expect.any(Number),
                            year: expect.any(Number),
                            isShared: true,
                        },
                    },
                    create: expect.objectContaining({
                        userId: mockUserId,
                        householdId: mockHouseholdId,
                        isShared: true,
                    }),
                }),
            );
            expect(result.id).toBe('saving-002');
            expect(result.amount).toBe(100);
            expect(result.isShared).toBe(true);
        });

        it('should use provided month and year when specified', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.saving.upsert.mockResolvedValue({
                ...mockSharedSaving,
                month: 8,
                year: 2026,
            });

            await service.upsertSharedSaving(mockUserId, { amount: 100, month: 8, year: 2026 });

            expect(mockPrismaService.saving.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        userId_month_year_isShared: {
                            userId: mockUserId,
                            month: 8,
                            year: 2026,
                            isShared: true,
                        },
                    },
                }),
            );
        });

        it('should invalidate savings and dashboard cache', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.saving.upsert.mockResolvedValue(mockSharedSaving);

            await service.upsertSharedSaving(mockUserId, dto);

            expect(mockCacheService.invalidateSavings).toHaveBeenCalledWith(mockHouseholdId);
            expect(mockCacheService.invalidateDashboard).toHaveBeenCalledWith(mockHouseholdId);
        });

        it('should throw NotFoundException if user is not in a household', async () => {
            mockExpenseHelper.requireMembership.mockRejectedValue(new NotFoundException('You must be in a household to manage expenses'));

            try {
                await service.upsertSharedSaving(mockUserId, dto);
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error: any) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('You must be in a household to manage expenses');
            }

            expect(mockPrismaService.saving.upsert).not.toHaveBeenCalled();
        });

        it('should handle amount of 0', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.saving.upsert.mockResolvedValue({
                ...mockSharedSaving,
                amount: 0,
            });

            const result = await service.upsertSharedSaving(mockUserId, { amount: 0 });

            expect(result.amount).toBe(0);
        });
    });
    //#endregion
});
