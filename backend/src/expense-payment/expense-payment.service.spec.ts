import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ExpensePaymentService } from './expense-payment.service';
import { PrismaService } from '../prisma/prisma.service';
import { ExpenseHelperService } from '../common/expense/expense-helper.service';
import { CacheService } from '../common/cache/cache.service';
import { ExpenseType, PaymentStatus } from '../generated/prisma/enums';

describe('ExpensePaymentService', () => {
    let service: ExpensePaymentService;

    const mockUserId = 'user-123';
    const mockHouseholdId = 'household-456';
    const mockExpenseId = 'expense-001';

    const mockMembership = {
        userId: mockUserId,
        householdId: mockHouseholdId,
        role: 'MEMBER',
    };

    const mockPersonalExpense = {
        id: mockExpenseId,
        householdId: mockHouseholdId,
        createdById: mockUserId,
        name: 'Gym membership',
        amount: 49.99,
        type: ExpenseType.PERSONAL,
        deletedAt: null,
    };

    const mockSharedExpense = {
        id: 'expense-shared-001',
        householdId: mockHouseholdId,
        createdById: mockUserId,
        name: 'Internet bill',
        amount: 59.99,
        type: ExpenseType.SHARED,
        deletedAt: null,
    };

    const mockPaymentStatusRecord = {
        id: 'ps-001',
        expenseId: mockExpenseId,
        month: 6,
        year: 2026,
        status: PaymentStatus.PAID,
        paidAt: new Date('2026-06-15T10:30:00.000Z'),
        paidById: mockUserId,
        createdAt: new Date('2026-06-15T10:30:00.000Z'),
        updatedAt: new Date('2026-06-15T10:30:00.000Z'),
    };

    const mockPrismaService = {
        expense: {
            findFirst: vi.fn(),
        },
        expensePaymentStatus: {
            upsert: vi.fn(),
            findUnique: vi.fn(),
            findMany: vi.fn(),
            update: vi.fn(),
        },
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
                ExpensePaymentService,
                { provide: PrismaService, useValue: mockPrismaService },
                { provide: ExpenseHelperService, useValue: mockExpenseHelper },
                { provide: CacheService, useValue: mockCacheService },
            ],
        }).compile();

        service = module.get<ExpensePaymentService>(ExpensePaymentService);

        vi.clearAllMocks();
    });

    //#region markPaid
    describe('markPaid', () => {
        const dto = { month: 6, year: 2026 };

        it('should mark an expense as paid and return the payment status', async () => {
            // Arrange
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findFirst.mockResolvedValue(mockPersonalExpense);
            mockPrismaService.expensePaymentStatus.upsert.mockResolvedValue(mockPaymentStatusRecord);

            // Act
            const result = await service.markPaid(mockUserId, mockExpenseId, dto);

            // Assert
            expect(mockExpenseHelper.requireMembership).toHaveBeenCalledWith(mockUserId);
            expect(mockPrismaService.expense.findFirst).toHaveBeenCalledWith({
                where: { id: mockExpenseId, householdId: mockHouseholdId },
            });
            expect(mockPrismaService.expensePaymentStatus.upsert).toHaveBeenCalledWith({
                where: {
                    expenseId_month_year: {
                        expenseId: mockExpenseId,
                        month: 6,
                        year: 2026,
                    },
                },
                create: {
                    expenseId: mockExpenseId,
                    month: 6,
                    year: 2026,
                    status: PaymentStatus.PAID,
                    paidAt: expect.any(Date),
                    paidById: mockUserId,
                },
                update: {
                    status: PaymentStatus.PAID,
                    paidAt: expect.any(Date),
                    paidById: mockUserId,
                },
            });
            expect(result.id).toBe('ps-001');
            expect(result.status).toBe(PaymentStatus.PAID);
            expect(result.expenseId).toBe(mockExpenseId);
            expect(result.month).toBe(6);
            expect(result.year).toBe(2026);
        });

        it('should invalidate personal expense cache for personal expenses', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findFirst.mockResolvedValue(mockPersonalExpense);
            mockPrismaService.expensePaymentStatus.upsert.mockResolvedValue(mockPaymentStatusRecord);

            await service.markPaid(mockUserId, mockExpenseId, dto);

            expect(mockCacheService.invalidatePersonalExpenses).toHaveBeenCalledWith(mockUserId);
            expect(mockCacheService.invalidateSharedExpenses).not.toHaveBeenCalled();
            expect(mockCacheService.invalidateDashboard).toHaveBeenCalledWith(mockHouseholdId);
        });

        it('should invalidate shared expense cache for shared expenses', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findFirst.mockResolvedValue(mockSharedExpense);
            mockPrismaService.expensePaymentStatus.upsert.mockResolvedValue({
                ...mockPaymentStatusRecord,
                expenseId: mockSharedExpense.id,
            });

            await service.markPaid(mockUserId, mockSharedExpense.id, dto);

            expect(mockCacheService.invalidateSharedExpenses).toHaveBeenCalledWith(mockHouseholdId);
            expect(mockCacheService.invalidatePersonalExpenses).not.toHaveBeenCalled();
            expect(mockCacheService.invalidateDashboard).toHaveBeenCalledWith(mockHouseholdId);
        });

        it('should throw NotFoundException if user is not in a household', async () => {
            mockExpenseHelper.requireMembership.mockRejectedValue(
                new NotFoundException('You must be in a household to manage expenses'),
            );

            try {
                await service.markPaid(mockUserId, mockExpenseId, dto);
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error: any) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('You must be in a household to manage expenses');
            }

            expect(mockPrismaService.expense.findFirst).not.toHaveBeenCalled();
        });

        it('should throw NotFoundException if expense is not found in household', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findFirst.mockResolvedValue(null);

            try {
                await service.markPaid(mockUserId, mockExpenseId, dto);
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error: any) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('Expense not found');
            }

            expect(mockPrismaService.expensePaymentStatus.upsert).not.toHaveBeenCalled();
        });

        it('should not reveal expenses from other households (enumeration prevention)', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findFirst.mockResolvedValue(null);

            try {
                await service.markPaid(mockUserId, 'expense-in-other-household', dto);
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error: any) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('Expense not found');
            }
        });

        it('should handle boundary month value 1 (January)', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findFirst.mockResolvedValue(mockPersonalExpense);
            mockPrismaService.expensePaymentStatus.upsert.mockResolvedValue({
                ...mockPaymentStatusRecord,
                month: 1,
            });

            const result = await service.markPaid(mockUserId, mockExpenseId, { month: 1, year: 2026 });

            expect(result.month).toBe(1);
            expect(mockPrismaService.expensePaymentStatus.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        expenseId_month_year: { expenseId: mockExpenseId, month: 1, year: 2026 },
                    },
                }),
            );
        });

        it('should handle boundary month value 12 (December)', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findFirst.mockResolvedValue(mockPersonalExpense);
            mockPrismaService.expensePaymentStatus.upsert.mockResolvedValue({
                ...mockPaymentStatusRecord,
                month: 12,
            });

            const result = await service.markPaid(mockUserId, mockExpenseId, { month: 12, year: 2026 });

            expect(result.month).toBe(12);
        });
    });
    //#endregion

    //#region undoPaid
    describe('undoPaid', () => {
        const dto = { month: 6, year: 2026 };

        it('should reset payment status to PENDING', async () => {
            // Arrange
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findFirst.mockResolvedValue(mockPersonalExpense);
            mockPrismaService.expensePaymentStatus.findUnique.mockResolvedValue(mockPaymentStatusRecord);
            mockPrismaService.expensePaymentStatus.update.mockResolvedValue({
                ...mockPaymentStatusRecord,
                status: PaymentStatus.PENDING,
                paidAt: null,
            });

            // Act
            const result = await service.undoPaid(mockUserId, mockExpenseId, dto);

            // Assert
            expect(mockPrismaService.expensePaymentStatus.findUnique).toHaveBeenCalledWith({
                where: {
                    expenseId_month_year: {
                        expenseId: mockExpenseId,
                        month: 6,
                        year: 2026,
                    },
                },
            });
            expect(mockPrismaService.expensePaymentStatus.update).toHaveBeenCalledWith({
                where: { id: 'ps-001' },
                data: {
                    status: PaymentStatus.PENDING,
                    paidAt: null,
                    paidById: mockUserId,
                },
            });
            expect(result.status).toBe(PaymentStatus.PENDING);
            expect(result.paidAt).toBeNull();
        });

        it('should invalidate cache after undoing paid status', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findFirst.mockResolvedValue(mockPersonalExpense);
            mockPrismaService.expensePaymentStatus.findUnique.mockResolvedValue(mockPaymentStatusRecord);
            mockPrismaService.expensePaymentStatus.update.mockResolvedValue({
                ...mockPaymentStatusRecord,
                status: PaymentStatus.PENDING,
                paidAt: null,
            });

            await service.undoPaid(mockUserId, mockExpenseId, dto);

            expect(mockCacheService.invalidatePersonalExpenses).toHaveBeenCalledWith(mockUserId);
            expect(mockCacheService.invalidateDashboard).toHaveBeenCalledWith(mockHouseholdId);
        });

        it('should throw NotFoundException if user is not in a household', async () => {
            mockExpenseHelper.requireMembership.mockRejectedValue(
                new NotFoundException('You must be in a household to manage expenses'),
            );

            try {
                await service.undoPaid(mockUserId, mockExpenseId, dto);
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error: any) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('You must be in a household to manage expenses');
            }

            expect(mockPrismaService.expense.findFirst).not.toHaveBeenCalled();
        });

        it('should throw NotFoundException if expense is not found', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findFirst.mockResolvedValue(null);

            try {
                await service.undoPaid(mockUserId, mockExpenseId, dto);
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error: any) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('Expense not found');
            }

            expect(mockPrismaService.expensePaymentStatus.findUnique).not.toHaveBeenCalled();
        });

        it('should throw NotFoundException if no payment status record exists for the period', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findFirst.mockResolvedValue(mockPersonalExpense);
            mockPrismaService.expensePaymentStatus.findUnique.mockResolvedValue(null);

            try {
                await service.undoPaid(mockUserId, mockExpenseId, dto);
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error: any) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('No payment status found for this expense and period');
            }

            expect(mockPrismaService.expensePaymentStatus.update).not.toHaveBeenCalled();
        });

        it('should undo a cancelled status back to PENDING', async () => {
            const cancelledRecord = {
                ...mockPaymentStatusRecord,
                status: PaymentStatus.CANCELLED,
                paidAt: null,
            };
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findFirst.mockResolvedValue(mockPersonalExpense);
            mockPrismaService.expensePaymentStatus.findUnique.mockResolvedValue(cancelledRecord);
            mockPrismaService.expensePaymentStatus.update.mockResolvedValue({
                ...cancelledRecord,
                status: PaymentStatus.PENDING,
            });

            const result = await service.undoPaid(mockUserId, mockExpenseId, dto);

            expect(result.status).toBe(PaymentStatus.PENDING);
        });
    });
    //#endregion

    //#region cancel
    describe('cancel', () => {
        const dto = { month: 8, year: 2026 };

        it('should cancel an expense for the specified month', async () => {
            // Arrange
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findFirst.mockResolvedValue(mockPersonalExpense);
            mockPrismaService.expensePaymentStatus.upsert.mockResolvedValue({
                ...mockPaymentStatusRecord,
                month: 8,
                status: PaymentStatus.CANCELLED,
                paidAt: null,
            });

            // Act
            const result = await service.cancel(mockUserId, mockExpenseId, dto);

            // Assert
            expect(mockPrismaService.expensePaymentStatus.upsert).toHaveBeenCalledWith({
                where: {
                    expenseId_month_year: {
                        expenseId: mockExpenseId,
                        month: 8,
                        year: 2026,
                    },
                },
                create: {
                    expenseId: mockExpenseId,
                    month: 8,
                    year: 2026,
                    status: PaymentStatus.CANCELLED,
                    paidAt: null,
                    paidById: mockUserId,
                },
                update: {
                    status: PaymentStatus.CANCELLED,
                    paidAt: null,
                    paidById: mockUserId,
                },
            });
            expect(result.status).toBe(PaymentStatus.CANCELLED);
            expect(result.paidAt).toBeNull();
        });

        it('should invalidate cache after cancelling', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findFirst.mockResolvedValue(mockPersonalExpense);
            mockPrismaService.expensePaymentStatus.upsert.mockResolvedValue({
                ...mockPaymentStatusRecord,
                status: PaymentStatus.CANCELLED,
                paidAt: null,
            });

            await service.cancel(mockUserId, mockExpenseId, dto);

            expect(mockCacheService.invalidatePersonalExpenses).toHaveBeenCalledWith(mockUserId);
            expect(mockCacheService.invalidateDashboard).toHaveBeenCalledWith(mockHouseholdId);
        });

        it('should invalidate shared expense cache when cancelling a shared expense', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findFirst.mockResolvedValue(mockSharedExpense);
            mockPrismaService.expensePaymentStatus.upsert.mockResolvedValue({
                ...mockPaymentStatusRecord,
                expenseId: mockSharedExpense.id,
                status: PaymentStatus.CANCELLED,
            });

            await service.cancel(mockUserId, mockSharedExpense.id, dto);

            expect(mockCacheService.invalidateSharedExpenses).toHaveBeenCalledWith(mockHouseholdId);
            expect(mockCacheService.invalidatePersonalExpenses).not.toHaveBeenCalled();
            expect(mockCacheService.invalidateDashboard).toHaveBeenCalledWith(mockHouseholdId);
        });

        it('should throw NotFoundException if user is not in a household', async () => {
            mockExpenseHelper.requireMembership.mockRejectedValue(
                new NotFoundException('You must be in a household to manage expenses'),
            );

            try {
                await service.cancel(mockUserId, mockExpenseId, dto);
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error: any) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('You must be in a household to manage expenses');
            }
        });

        it('should throw NotFoundException if expense is not found', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findFirst.mockResolvedValue(null);

            try {
                await service.cancel(mockUserId, mockExpenseId, dto);
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error: any) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('Expense not found');
            }

            expect(mockPrismaService.expensePaymentStatus.upsert).not.toHaveBeenCalled();
        });
    });
    //#endregion

    //#region getPaymentStatuses
    describe('getPaymentStatuses', () => {
        it('should return all payment statuses for an expense ordered by date descending', async () => {
            const statuses = [
                { ...mockPaymentStatusRecord, month: 7, year: 2026, status: PaymentStatus.PENDING },
                { ...mockPaymentStatusRecord, month: 6, year: 2026, status: PaymentStatus.PAID },
                { ...mockPaymentStatusRecord, id: 'ps-002', month: 5, year: 2026, status: PaymentStatus.CANCELLED },
            ];
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findFirst.mockResolvedValue(mockPersonalExpense);
            mockPrismaService.expensePaymentStatus.findMany.mockResolvedValue(statuses);

            const result = await service.getPaymentStatuses(mockUserId, mockExpenseId);

            expect(mockPrismaService.expensePaymentStatus.findMany).toHaveBeenCalledWith({
                where: { expenseId: mockExpenseId },
                orderBy: [{ year: 'desc' }, { month: 'desc' }],
            });
            expect(result).toHaveLength(3);
            expect(result[0].month).toBe(7);
            expect(result[1].month).toBe(6);
            expect(result[2].month).toBe(5);
        });

        it('should return empty array when no payment statuses exist', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findFirst.mockResolvedValue(mockPersonalExpense);
            mockPrismaService.expensePaymentStatus.findMany.mockResolvedValue([]);

            const result = await service.getPaymentStatuses(mockUserId, mockExpenseId);

            expect(result).toEqual([]);
        });

        it('should throw NotFoundException if user is not in a household', async () => {
            mockExpenseHelper.requireMembership.mockRejectedValue(
                new NotFoundException('You must be in a household to manage expenses'),
            );

            try {
                await service.getPaymentStatuses(mockUserId, mockExpenseId);
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error: any) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('You must be in a household to manage expenses');
            }

            expect(mockPrismaService.expense.findFirst).not.toHaveBeenCalled();
        });

        it('should throw NotFoundException if expense is not found', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findFirst.mockResolvedValue(null);

            try {
                await service.getPaymentStatuses(mockUserId, mockExpenseId);
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error: any) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('Expense not found');
            }

            expect(mockPrismaService.expensePaymentStatus.findMany).not.toHaveBeenCalled();
        });

        it('should not reveal expenses from other households', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findFirst.mockResolvedValue(null);

            try {
                await service.getPaymentStatuses(mockUserId, 'expense-in-other-household');
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error: any) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('Expense not found');
            }
        });

        it('should map all fields correctly in response', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findFirst.mockResolvedValue(mockPersonalExpense);
            mockPrismaService.expensePaymentStatus.findMany.mockResolvedValue([mockPaymentStatusRecord]);

            const result = await service.getPaymentStatuses(mockUserId, mockExpenseId);

            expect(result[0]).toEqual({
                id: 'ps-001',
                expenseId: mockExpenseId,
                month: 6,
                year: 2026,
                status: PaymentStatus.PAID,
                paidAt: mockPaymentStatusRecord.paidAt,
                paidById: mockUserId,
                createdAt: mockPaymentStatusRecord.createdAt,
                updatedAt: mockPaymentStatusRecord.updatedAt,
            });
        });
    });
    //#endregion
});
