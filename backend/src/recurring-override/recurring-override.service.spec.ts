import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RecurringOverrideService } from './recurring-override.service';
import { PrismaService } from '../prisma/prisma.service';
import { ExpenseHelperService } from '../common/expense/expense-helper.service';
import { CacheService } from '../common/cache/cache.service';
import { ExpenseCategory, ExpenseType } from '../generated/prisma/enums';

describe('RecurringOverrideService', () => {
    let service: RecurringOverrideService;

    const mockUserId = 'user-123';
    const mockHouseholdId = 'household-456';
    const mockExpenseId = 'expense-001';

    const mockMembership = {
        userId: mockUserId,
        householdId: mockHouseholdId,
        role: 'MEMBER',
    };

    const mockRecurringExpense = {
        id: mockExpenseId,
        householdId: mockHouseholdId,
        createdById: mockUserId,
        name: 'Gym membership',
        amount: 49.99,
        type: ExpenseType.PERSONAL,
        category: ExpenseCategory.RECURRING,
        deletedAt: null,
    };

    const mockSharedRecurringExpense = {
        ...mockRecurringExpense,
        id: 'expense-shared-001',
        type: ExpenseType.SHARED,
    };

    const mockOneTimeExpense = {
        ...mockRecurringExpense,
        id: 'expense-onetime',
        category: ExpenseCategory.ONE_TIME,
    };

    const mockOverrideRecord = {
        id: 'override-001',
        expenseId: mockExpenseId,
        month: 7,
        year: 2026,
        amount: 55.0,
        skipped: false,
        createdAt: new Date('2026-06-15T10:30:00.000Z'),
        updatedAt: new Date('2026-06-15T10:30:00.000Z'),
    };

    const mockPrismaService = {
        expense: {
            findFirst: vi.fn(),
            update: vi.fn(),
        },
        recurringOverride: {
            upsert: vi.fn(),
            findMany: vi.fn(),
            deleteMany: vi.fn(),
        },
        $transaction: vi.fn(),
    };

    const mockExpenseHelper = {
        requireMembership: vi.fn(),
    };

    const mockCacheService = {
        invalidatePersonalExpenses: vi.fn(),
        invalidateSharedExpenses: vi.fn(),
        invalidateDashboard: vi.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                RecurringOverrideService,
                { provide: PrismaService, useValue: mockPrismaService },
                { provide: ExpenseHelperService, useValue: mockExpenseHelper },
                { provide: CacheService, useValue: mockCacheService },
            ],
        }).compile();

        service = module.get<RecurringOverrideService>(RecurringOverrideService);

        vi.clearAllMocks();
    });

    //#region upsertOverride
    describe('upsertOverride', () => {
        const dto = { amount: 55.0 };

        it('should create an override for a recurring expense and return the response', async () => {
            // Arrange
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findFirst.mockResolvedValue(mockRecurringExpense);
            mockPrismaService.recurringOverride.upsert.mockResolvedValue(mockOverrideRecord);

            // Act
            const result = await service.upsertOverride(mockUserId, mockExpenseId, 2026, 7, dto);

            // Assert
            expect(mockExpenseHelper.requireMembership).toHaveBeenCalledWith(mockUserId);
            expect(mockPrismaService.expense.findFirst).toHaveBeenCalledWith({
                where: { id: mockExpenseId, householdId: mockHouseholdId, deletedAt: null },
            });
            expect(mockPrismaService.recurringOverride.upsert).toHaveBeenCalledWith({
                where: {
                    expenseId_month_year: { expenseId: mockExpenseId, month: 7, year: 2026 },
                },
                create: {
                    expenseId: mockExpenseId,
                    month: 7,
                    year: 2026,
                    amount: 55.0,
                    skipped: false,
                },
                update: {
                    amount: 55.0,
                    skipped: false,
                },
            });
            expect(result.id).toBe('override-001');
            expect(result.amount).toBe(55.0);
            expect(result.month).toBe(7);
            expect(result.year).toBe(2026);
            expect(result.skipped).toBe(false);
        });

        it('should pass skipped=true when specified in dto', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findFirst.mockResolvedValue(mockRecurringExpense);
            mockPrismaService.recurringOverride.upsert.mockResolvedValue({
                ...mockOverrideRecord,
                skipped: true,
            });

            const result = await service.upsertOverride(mockUserId, mockExpenseId, 2026, 7, {
                amount: 0,
                skipped: true,
            });

            expect(mockPrismaService.recurringOverride.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    create: expect.objectContaining({ skipped: true }),
                    update: expect.objectContaining({ skipped: true }),
                }),
            );
            expect(result.skipped).toBe(true);
        });

        it('should invalidate personal expense cache for personal expenses', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findFirst.mockResolvedValue(mockRecurringExpense);
            mockPrismaService.recurringOverride.upsert.mockResolvedValue(mockOverrideRecord);

            await service.upsertOverride(mockUserId, mockExpenseId, 2026, 7, dto);

            expect(mockCacheService.invalidatePersonalExpenses).toHaveBeenCalledWith(mockUserId);
            expect(mockCacheService.invalidateSharedExpenses).not.toHaveBeenCalled();
            expect(mockCacheService.invalidateDashboard).toHaveBeenCalledWith(mockHouseholdId);
        });

        it('should invalidate shared expense cache for shared expenses', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findFirst.mockResolvedValue(mockSharedRecurringExpense);
            mockPrismaService.recurringOverride.upsert.mockResolvedValue({
                ...mockOverrideRecord,
                expenseId: mockSharedRecurringExpense.id,
            });

            await service.upsertOverride(mockUserId, mockSharedRecurringExpense.id, 2026, 7, dto);

            expect(mockCacheService.invalidateSharedExpenses).toHaveBeenCalledWith(mockHouseholdId);
            expect(mockCacheService.invalidatePersonalExpenses).not.toHaveBeenCalled();
            expect(mockCacheService.invalidateDashboard).toHaveBeenCalledWith(mockHouseholdId);
        });

        it('should throw NotFoundException if user is not in a household', async () => {
            mockExpenseHelper.requireMembership.mockRejectedValue(
                new NotFoundException('You must be in a household to manage expenses'),
            );

            try {
                await service.upsertOverride(mockUserId, mockExpenseId, 2026, 7, dto);
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('You must be in a household to manage expenses');
            }

            expect(mockPrismaService.expense.findFirst).not.toHaveBeenCalled();
        });

        it('should throw NotFoundException if expense is not found in household', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findFirst.mockResolvedValue(null);

            try {
                await service.upsertOverride(mockUserId, mockExpenseId, 2026, 7, dto);
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('Expense not found');
            }

            expect(mockPrismaService.recurringOverride.upsert).not.toHaveBeenCalled();
        });

        it('should throw BadRequestException if expense is not recurring', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findFirst.mockResolvedValue(mockOneTimeExpense);

            try {
                await service.upsertOverride(mockUserId, mockOneTimeExpense.id, 2026, 7, dto);
                expect.unreachable('Should have thrown BadRequestException');
            } catch (error) {
                expect(error).toBeInstanceOf(BadRequestException);
                expect(error.message).toBe('Only recurring expenses can have overrides');
            }

            expect(mockPrismaService.recurringOverride.upsert).not.toHaveBeenCalled();
        });

        it('should not reveal expenses from other households (enumeration prevention)', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findFirst.mockResolvedValue(null);

            try {
                await service.upsertOverride(mockUserId, 'expense-in-other-household', 2026, 7, dto);
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('Expense not found');
            }
        });

        it('should handle boundary month value 1 (January)', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findFirst.mockResolvedValue(mockRecurringExpense);
            mockPrismaService.recurringOverride.upsert.mockResolvedValue({
                ...mockOverrideRecord,
                month: 1,
            });

            const result = await service.upsertOverride(mockUserId, mockExpenseId, 2026, 1, dto);

            expect(result.month).toBe(1);
            expect(mockPrismaService.recurringOverride.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        expenseId_month_year: { expenseId: mockExpenseId, month: 1, year: 2026 },
                    },
                }),
            );
        });

        it('should handle boundary month value 12 (December)', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findFirst.mockResolvedValue(mockRecurringExpense);
            mockPrismaService.recurringOverride.upsert.mockResolvedValue({
                ...mockOverrideRecord,
                month: 12,
            });

            const result = await service.upsertOverride(mockUserId, mockExpenseId, 2026, 12, dto);

            expect(result.month).toBe(12);
        });

        it('should handle amount of 0 (zero amount override)', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findFirst.mockResolvedValue(mockRecurringExpense);
            mockPrismaService.recurringOverride.upsert.mockResolvedValue({
                ...mockOverrideRecord,
                amount: 0,
            });

            const result = await service.upsertOverride(mockUserId, mockExpenseId, 2026, 7, { amount: 0 });

            expect(result.amount).toBe(0);
        });
    });
    //#endregion

    //#region updateDefaultAmount
    describe('updateDefaultAmount', () => {
        const dto = { amount: 520.0 };

        it('should update the default amount of a recurring expense', async () => {
            // Arrange
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findFirst.mockResolvedValue(mockRecurringExpense);
            mockPrismaService.expense.update.mockResolvedValue({
                ...mockRecurringExpense,
                amount: 520.0,
            });

            // Act
            const result = await service.updateDefaultAmount(mockUserId, mockExpenseId, dto);

            // Assert
            expect(mockPrismaService.expense.update).toHaveBeenCalledWith({
                where: { id: mockExpenseId },
                data: { amount: 520.0 },
            });
            expect(result).toEqual({ message: 'Default amount updated successfully' });
        });

        it('should invalidate personal expense cache for personal expenses', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findFirst.mockResolvedValue(mockRecurringExpense);
            mockPrismaService.expense.update.mockResolvedValue(mockRecurringExpense);

            await service.updateDefaultAmount(mockUserId, mockExpenseId, dto);

            expect(mockCacheService.invalidatePersonalExpenses).toHaveBeenCalledWith(mockUserId);
            expect(mockCacheService.invalidateSharedExpenses).not.toHaveBeenCalled();
            expect(mockCacheService.invalidateDashboard).toHaveBeenCalledWith(mockHouseholdId);
        });

        it('should invalidate shared expense cache for shared expenses', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findFirst.mockResolvedValue(mockSharedRecurringExpense);
            mockPrismaService.expense.update.mockResolvedValue(mockSharedRecurringExpense);

            await service.updateDefaultAmount(mockUserId, mockSharedRecurringExpense.id, dto);

            expect(mockCacheService.invalidateSharedExpenses).toHaveBeenCalledWith(mockHouseholdId);
            expect(mockCacheService.invalidatePersonalExpenses).not.toHaveBeenCalled();
            expect(mockCacheService.invalidateDashboard).toHaveBeenCalledWith(mockHouseholdId);
        });

        it('should throw NotFoundException if user is not in a household', async () => {
            mockExpenseHelper.requireMembership.mockRejectedValue(
                new NotFoundException('You must be in a household to manage expenses'),
            );

            try {
                await service.updateDefaultAmount(mockUserId, mockExpenseId, dto);
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('You must be in a household to manage expenses');
            }

            expect(mockPrismaService.expense.findFirst).not.toHaveBeenCalled();
        });

        it('should throw NotFoundException if expense is not found', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findFirst.mockResolvedValue(null);

            try {
                await service.updateDefaultAmount(mockUserId, mockExpenseId, dto);
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('Expense not found');
            }

            expect(mockPrismaService.expense.update).not.toHaveBeenCalled();
        });

        it('should throw BadRequestException if expense is not recurring', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findFirst.mockResolvedValue(mockOneTimeExpense);

            try {
                await service.updateDefaultAmount(mockUserId, mockOneTimeExpense.id, dto);
                expect.unreachable('Should have thrown BadRequestException');
            } catch (error) {
                expect(error).toBeInstanceOf(BadRequestException);
                expect(error.message).toBe('Only recurring expenses can have their default amount updated');
            }

            expect(mockPrismaService.expense.update).not.toHaveBeenCalled();
        });

        it('should not reveal expenses from other households', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findFirst.mockResolvedValue(null);

            try {
                await service.updateDefaultAmount(mockUserId, 'expense-in-other-household', dto);
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('Expense not found');
            }
        });
    });
    //#endregion

    //#region listOverrides
    describe('listOverrides', () => {
        it('should return all overrides for an expense ordered by date descending', async () => {
            const overrides = [
                { ...mockOverrideRecord, month: 9, year: 2026 },
                { ...mockOverrideRecord, id: 'override-002', month: 7, year: 2026 },
                { ...mockOverrideRecord, id: 'override-003', month: 3, year: 2026 },
            ];
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findFirst.mockResolvedValue(mockRecurringExpense);
            mockPrismaService.recurringOverride.findMany.mockResolvedValue(overrides);

            const result = await service.listOverrides(mockUserId, mockExpenseId);

            expect(mockPrismaService.recurringOverride.findMany).toHaveBeenCalledWith({
                where: { expenseId: mockExpenseId },
                orderBy: [{ year: 'desc' }, { month: 'desc' }],
            });
            expect(result).toHaveLength(3);
            expect(result[0].month).toBe(9);
            expect(result[1].month).toBe(7);
            expect(result[2].month).toBe(3);
        });

        it('should return empty array when no overrides exist', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findFirst.mockResolvedValue(mockRecurringExpense);
            mockPrismaService.recurringOverride.findMany.mockResolvedValue([]);

            const result = await service.listOverrides(mockUserId, mockExpenseId);

            expect(result).toEqual([]);
        });

        it('should throw NotFoundException if user is not in a household', async () => {
            mockExpenseHelper.requireMembership.mockRejectedValue(
                new NotFoundException('You must be in a household to manage expenses'),
            );

            try {
                await service.listOverrides(mockUserId, mockExpenseId);
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('You must be in a household to manage expenses');
            }

            expect(mockPrismaService.expense.findFirst).not.toHaveBeenCalled();
        });

        it('should throw NotFoundException if expense is not found', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findFirst.mockResolvedValue(null);

            try {
                await service.listOverrides(mockUserId, mockExpenseId);
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('Expense not found');
            }

            expect(mockPrismaService.recurringOverride.findMany).not.toHaveBeenCalled();
        });

        it('should not reveal expenses from other households', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findFirst.mockResolvedValue(null);

            try {
                await service.listOverrides(mockUserId, 'expense-in-other-household');
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('Expense not found');
            }
        });

        it('should map all fields correctly in response', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findFirst.mockResolvedValue(mockRecurringExpense);
            mockPrismaService.recurringOverride.findMany.mockResolvedValue([mockOverrideRecord]);

            const result = await service.listOverrides(mockUserId, mockExpenseId);

            expect(result[0]).toEqual({
                id: 'override-001',
                expenseId: mockExpenseId,
                month: 7,
                year: 2026,
                amount: 55.0,
                skipped: false,
                createdAt: mockOverrideRecord.createdAt,
                updatedAt: mockOverrideRecord.updatedAt,
            });
        });
    });
    //#endregion

    //#region deleteOverride
    describe('deleteOverride', () => {
        it('should delete a single override for a specific month', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findFirst.mockResolvedValue(mockRecurringExpense);
            mockPrismaService.recurringOverride.deleteMany.mockResolvedValue({ count: 1 });

            const result = await service.deleteOverride(mockUserId, mockExpenseId, 2026, 7);

            expect(mockPrismaService.recurringOverride.deleteMany).toHaveBeenCalledWith({
                where: { expenseId: mockExpenseId, month: 7, year: 2026 },
            });
            expect(result).toEqual({ message: 'Override removed' });
        });

        it('should invalidate cache after deleting override', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findFirst.mockResolvedValue(mockRecurringExpense);
            mockPrismaService.recurringOverride.deleteMany.mockResolvedValue({ count: 1 });

            await service.deleteOverride(mockUserId, mockExpenseId, 2026, 7);

            expect(mockCacheService.invalidatePersonalExpenses).toHaveBeenCalledWith(mockUserId);
            expect(mockCacheService.invalidateDashboard).toHaveBeenCalledWith(mockHouseholdId);
        });

        it('should throw NotFoundException if expense is not found', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findFirst.mockResolvedValue(null);

            try {
                await service.deleteOverride(mockUserId, mockExpenseId, 2026, 7);
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('Expense not found');
            }

            expect(mockPrismaService.recurringOverride.deleteMany).not.toHaveBeenCalled();
        });

        it('should throw NotFoundException if user is not in a household', async () => {
            mockExpenseHelper.requireMembership.mockRejectedValue(
                new NotFoundException('You must be in a household to manage expenses'),
            );

            try {
                await service.deleteOverride(mockUserId, mockExpenseId, 2026, 7);
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('You must be in a household to manage expenses');
            }
        });
    });
    //#endregion

    //#region deleteAllOverrides
    describe('deleteAllOverrides', () => {
        it('should delete all overrides for a recurring expense and return count', async () => {
            // Arrange
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findFirst.mockResolvedValue(mockRecurringExpense);
            mockPrismaService.recurringOverride.deleteMany.mockResolvedValue({ count: 3 });

            // Act
            const result = await service.deleteAllOverrides(mockUserId, mockExpenseId);

            // Assert
            expect(mockPrismaService.recurringOverride.deleteMany).toHaveBeenCalledWith({
                where: { expenseId: mockExpenseId },
            });
            expect(result).toEqual({ message: 'Deleted 3 override(s)' });
        });

        it('should return count of 0 when no overrides exist', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findFirst.mockResolvedValue(mockRecurringExpense);
            mockPrismaService.recurringOverride.deleteMany.mockResolvedValue({ count: 0 });

            const result = await service.deleteAllOverrides(mockUserId, mockExpenseId);

            expect(result).toEqual({ message: 'Deleted 0 override(s)' });
        });

        it('should invalidate personal expense cache for personal expenses', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findFirst.mockResolvedValue(mockRecurringExpense);
            mockPrismaService.recurringOverride.deleteMany.mockResolvedValue({ count: 1 });

            await service.deleteAllOverrides(mockUserId, mockExpenseId);

            expect(mockCacheService.invalidatePersonalExpenses).toHaveBeenCalledWith(mockUserId);
            expect(mockCacheService.invalidateSharedExpenses).not.toHaveBeenCalled();
            expect(mockCacheService.invalidateDashboard).toHaveBeenCalledWith(mockHouseholdId);
        });

        it('should invalidate shared expense cache for shared expenses', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findFirst.mockResolvedValue(mockSharedRecurringExpense);
            mockPrismaService.recurringOverride.deleteMany.mockResolvedValue({ count: 1 });

            await service.deleteAllOverrides(mockUserId, mockSharedRecurringExpense.id);

            expect(mockCacheService.invalidateSharedExpenses).toHaveBeenCalledWith(mockHouseholdId);
            expect(mockCacheService.invalidatePersonalExpenses).not.toHaveBeenCalled();
            expect(mockCacheService.invalidateDashboard).toHaveBeenCalledWith(mockHouseholdId);
        });

        it('should throw NotFoundException if user is not in a household', async () => {
            mockExpenseHelper.requireMembership.mockRejectedValue(
                new NotFoundException('You must be in a household to manage expenses'),
            );

            try {
                await service.deleteAllOverrides(mockUserId, mockExpenseId);
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('You must be in a household to manage expenses');
            }

            expect(mockPrismaService.expense.findFirst).not.toHaveBeenCalled();
        });

        it('should throw NotFoundException if expense is not found', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findFirst.mockResolvedValue(null);

            try {
                await service.deleteAllOverrides(mockUserId, mockExpenseId);
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('Expense not found');
            }

            expect(mockPrismaService.recurringOverride.deleteMany).not.toHaveBeenCalled();
        });

        it('should not reveal expenses from other households', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findFirst.mockResolvedValue(null);

            try {
                await service.deleteAllOverrides(mockUserId, 'expense-in-other-household');
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('Expense not found');
            }
        });
    });
    //#endregion

    //#region batchUpsertOverrides
    describe('batchUpsertOverrides', () => {
        const batchOverrides = [
            { year: 2026, month: 7, amount: 55.0 },
            { year: 2026, month: 8, amount: 55.0 },
            { year: 2026, month: 9, amount: 55.0, skipped: true },
        ];

        const mockBatchResults = batchOverrides.map((o, i) => ({
            id: `override-batch-${i}`,
            expenseId: mockExpenseId,
            month: o.month,
            year: o.year,
            amount: o.amount,
            skipped: o.skipped ?? false,
            createdAt: new Date('2026-06-15T10:30:00.000Z'),
            updatedAt: new Date('2026-06-15T10:30:00.000Z'),
        }));

        it('should batch upsert overrides in a transaction and return all results', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findFirst.mockResolvedValue(mockRecurringExpense);
            mockPrismaService.$transaction.mockResolvedValue(mockBatchResults);

            const result = await service.batchUpsertOverrides(mockUserId, mockExpenseId, batchOverrides);

            expect(mockPrismaService.$transaction).toHaveBeenCalledWith(
                expect.arrayContaining([expect.anything(), expect.anything(), expect.anything()]),
            );
            expect(result).toHaveLength(3);
            expect(result[0].month).toBe(7);
            expect(result[1].month).toBe(8);
            expect(result[2].month).toBe(9);
            expect(result[2].skipped).toBe(true);
        });

        it('should invalidate personal expense cache for personal expenses', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findFirst.mockResolvedValue(mockRecurringExpense);
            mockPrismaService.$transaction.mockResolvedValue(mockBatchResults);

            await service.batchUpsertOverrides(mockUserId, mockExpenseId, batchOverrides);

            expect(mockCacheService.invalidatePersonalExpenses).toHaveBeenCalledWith(mockUserId);
            expect(mockCacheService.invalidateSharedExpenses).not.toHaveBeenCalled();
            expect(mockCacheService.invalidateDashboard).toHaveBeenCalledWith(mockHouseholdId);
        });

        it('should invalidate shared expense cache for shared expenses', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findFirst.mockResolvedValue(mockSharedRecurringExpense);
            mockPrismaService.$transaction.mockResolvedValue(mockBatchResults);

            await service.batchUpsertOverrides(mockUserId, mockSharedRecurringExpense.id, batchOverrides);

            expect(mockCacheService.invalidateSharedExpenses).toHaveBeenCalledWith(mockHouseholdId);
            expect(mockCacheService.invalidatePersonalExpenses).not.toHaveBeenCalled();
            expect(mockCacheService.invalidateDashboard).toHaveBeenCalledWith(mockHouseholdId);
        });

        it('should handle empty overrides array', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findFirst.mockResolvedValue(mockRecurringExpense);
            mockPrismaService.$transaction.mockResolvedValue([]);

            const result = await service.batchUpsertOverrides(mockUserId, mockExpenseId, []);

            expect(result).toEqual([]);
        });

        it('should throw NotFoundException if user is not in a household', async () => {
            mockExpenseHelper.requireMembership.mockRejectedValue(
                new NotFoundException('You must be in a household to manage expenses'),
            );

            try {
                await service.batchUpsertOverrides(mockUserId, mockExpenseId, batchOverrides);
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('You must be in a household to manage expenses');
            }

            expect(mockPrismaService.expense.findFirst).not.toHaveBeenCalled();
        });

        it('should throw NotFoundException if expense is not found', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findFirst.mockResolvedValue(null);

            try {
                await service.batchUpsertOverrides(mockUserId, mockExpenseId, batchOverrides);
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('Expense not found');
            }

            expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
        });

        it('should throw BadRequestException if expense is not recurring', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findFirst.mockResolvedValue(mockOneTimeExpense);

            try {
                await service.batchUpsertOverrides(mockUserId, mockOneTimeExpense.id, batchOverrides);
                expect.unreachable('Should have thrown BadRequestException');
            } catch (error) {
                expect(error).toBeInstanceOf(BadRequestException);
                expect(error.message).toBe('Only recurring expenses can have overrides');
            }

            expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
        });

        it('should not reveal expenses from other households', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findFirst.mockResolvedValue(null);

            try {
                await service.batchUpsertOverrides(mockUserId, 'expense-in-other-household', batchOverrides);
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('Expense not found');
            }
        });
    });
    //#endregion

    //#region deleteUpcomingOverrides
    describe('deleteUpcomingOverrides', () => {
        it('should delete overrides from a given month forward', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findFirst.mockResolvedValue(mockRecurringExpense);
            mockPrismaService.recurringOverride.deleteMany.mockResolvedValue({ count: 5 });

            const result = await service.deleteUpcomingOverrides(mockUserId, mockExpenseId, 2026, 7);

            expect(mockPrismaService.recurringOverride.deleteMany).toHaveBeenCalledWith({
                where: {
                    expenseId: mockExpenseId,
                    OR: [
                        { year: { gt: 2026 } },
                        { year: 2026, month: { gte: 7 } },
                    ],
                },
            });
            expect(result).toEqual({ message: 'Deleted 5 upcoming override(s)' });
        });

        it('should include overrides in the starting month (inclusive)', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findFirst.mockResolvedValue(mockRecurringExpense);
            mockPrismaService.recurringOverride.deleteMany.mockResolvedValue({ count: 1 });

            await service.deleteUpcomingOverrides(mockUserId, mockExpenseId, 2026, 12);

            expect(mockPrismaService.recurringOverride.deleteMany).toHaveBeenCalledWith({
                where: {
                    expenseId: mockExpenseId,
                    OR: [
                        { year: { gt: 2026 } },
                        { year: 2026, month: { gte: 12 } },
                    ],
                },
            });
        });

        it('should handle January boundary (includes all of current and future years)', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findFirst.mockResolvedValue(mockRecurringExpense);
            mockPrismaService.recurringOverride.deleteMany.mockResolvedValue({ count: 12 });

            const result = await service.deleteUpcomingOverrides(mockUserId, mockExpenseId, 2026, 1);

            expect(mockPrismaService.recurringOverride.deleteMany).toHaveBeenCalledWith({
                where: {
                    expenseId: mockExpenseId,
                    OR: [
                        { year: { gt: 2026 } },
                        { year: 2026, month: { gte: 1 } },
                    ],
                },
            });
            expect(result).toEqual({ message: 'Deleted 12 upcoming override(s)' });
        });

        it('should return count of 0 when no upcoming overrides exist', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findFirst.mockResolvedValue(mockRecurringExpense);
            mockPrismaService.recurringOverride.deleteMany.mockResolvedValue({ count: 0 });

            const result = await service.deleteUpcomingOverrides(mockUserId, mockExpenseId, 2026, 7);

            expect(result).toEqual({ message: 'Deleted 0 upcoming override(s)' });
        });

        it('should invalidate personal expense cache for personal expenses', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findFirst.mockResolvedValue(mockRecurringExpense);
            mockPrismaService.recurringOverride.deleteMany.mockResolvedValue({ count: 1 });

            await service.deleteUpcomingOverrides(mockUserId, mockExpenseId, 2026, 7);

            expect(mockCacheService.invalidatePersonalExpenses).toHaveBeenCalledWith(mockUserId);
            expect(mockCacheService.invalidateSharedExpenses).not.toHaveBeenCalled();
            expect(mockCacheService.invalidateDashboard).toHaveBeenCalledWith(mockHouseholdId);
        });

        it('should invalidate shared expense cache for shared expenses', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findFirst.mockResolvedValue(mockSharedRecurringExpense);
            mockPrismaService.recurringOverride.deleteMany.mockResolvedValue({ count: 1 });

            await service.deleteUpcomingOverrides(mockUserId, mockSharedRecurringExpense.id, 2026, 7);

            expect(mockCacheService.invalidateSharedExpenses).toHaveBeenCalledWith(mockHouseholdId);
            expect(mockCacheService.invalidatePersonalExpenses).not.toHaveBeenCalled();
            expect(mockCacheService.invalidateDashboard).toHaveBeenCalledWith(mockHouseholdId);
        });

        it('should throw NotFoundException if user is not in a household', async () => {
            mockExpenseHelper.requireMembership.mockRejectedValue(
                new NotFoundException('You must be in a household to manage expenses'),
            );

            try {
                await service.deleteUpcomingOverrides(mockUserId, mockExpenseId, 2026, 7);
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('You must be in a household to manage expenses');
            }

            expect(mockPrismaService.expense.findFirst).not.toHaveBeenCalled();
        });

        it('should throw NotFoundException if expense is not found', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findFirst.mockResolvedValue(null);

            try {
                await service.deleteUpcomingOverrides(mockUserId, mockExpenseId, 2026, 7);
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('Expense not found');
            }

            expect(mockPrismaService.recurringOverride.deleteMany).not.toHaveBeenCalled();
        });

        it('should not reveal expenses from other households', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findFirst.mockResolvedValue(null);

            try {
                await service.deleteUpcomingOverrides(mockUserId, 'expense-in-other-household', 2026, 7);
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('Expense not found');
            }
        });
    });
    //#endregion
});
