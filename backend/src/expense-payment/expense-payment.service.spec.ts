import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ExpensePaymentService } from './expense-payment.service';
import { PrismaService } from '../prisma/prisma.service';
import { ExpenseHelperService } from '../common/expense/expense-helper.service';
import { CacheService } from '../common/cache/cache.service';
import { DashboardCalculatorService } from '../dashboard/dashboard-calculator.service';
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
        isFixed: true,
        deletedAt: null,
    };

    const mockFlexibleExpense = {
        id: 'expense-flex-001',
        householdId: mockHouseholdId,
        createdById: mockUserId,
        name: 'Groceries',
        amount: 300,
        type: ExpenseType.PERSONAL,
        isFixed: false,
        deletedAt: null,
    };

    const mockSharedExpense = {
        id: 'expense-shared-001',
        householdId: mockHouseholdId,
        createdById: mockUserId,
        name: 'Internet bill',
        amount: 59.99,
        type: ExpenseType.SHARED,
        isFixed: true,
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
        paidAmount: null,
        createdAt: new Date('2026-06-15T10:30:00.000Z'),
        updatedAt: new Date('2026-06-15T10:30:00.000Z'),
    };

    const mockPrismaService = {
        expensePaymentStatus: {
            upsert: vi.fn(),
            findUnique: vi.fn(),
            findMany: vi.fn(),
            update: vi.fn(),
        },
        recurringOverride: {
            findMany: vi.fn(),
        },
    };

    const mockExpenseHelper = {
        requireMembership: vi.fn(),
        findVisibleExpense: vi.fn(),
        visibleExpenseFilter: vi.fn(),
    };

    const mockCacheService = {
        invalidatePersonalExpenses: vi.fn(),
        invalidateSharedExpenses: vi.fn(),
        invalidateDashboard: vi.fn(),
        invalidateExpenseCache: vi.fn(),
    };

    const mockCalculator = {
        getMonthlyAmount: vi.fn(),
        getMonthlyAmounts: vi.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ExpensePaymentService,
                { provide: PrismaService, useValue: mockPrismaService },
                { provide: ExpenseHelperService, useValue: mockExpenseHelper },
                { provide: CacheService, useValue: mockCacheService },
                { provide: DashboardCalculatorService, useValue: mockCalculator },
            ],
        }).compile();

        service = module.get<ExpensePaymentService>(ExpensePaymentService);

        vi.clearAllMocks();

        // Safe defaults so tests that don't care about remainingAmount don't need to mock the calculator themselves
        mockPrismaService.recurringOverride.findMany.mockResolvedValue([]);
        mockCalculator.getMonthlyAmounts.mockResolvedValue(new Map());
        mockCalculator.getMonthlyAmount.mockReturnValue(0);
    });

    //#region markPaid
    describe('markPaid', () => {
        const dto = { month: 6, year: 2026 };

        it('should mark an expense as paid and return the payment status', async () => {
            // Arrange
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockExpenseHelper.findVisibleExpense.mockResolvedValue(mockPersonalExpense);
            mockPrismaService.expensePaymentStatus.upsert.mockResolvedValue(mockPaymentStatusRecord);

            // Act
            const result = await service.markPaid(mockUserId, mockExpenseId, dto);

            // Assert
            expect(mockExpenseHelper.requireMembership).toHaveBeenCalledWith(mockUserId);
            expect(mockExpenseHelper.findVisibleExpense).toHaveBeenCalledWith(mockExpenseId, mockHouseholdId, mockUserId);
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
                    paidAmount: null,
                },
                update: {
                    status: PaymentStatus.PAID,
                    paidAt: expect.any(Date),
                    paidById: mockUserId,
                    paidAmount: null,
                },
            });
            expect(result.id).toBe('ps-001');
            expect(result.status).toBe(PaymentStatus.PAID);
            expect(result.expenseId).toBe(mockExpenseId);
            expect(result.month).toBe(6);
            expect(result.year).toBe(2026);
            expect(result.paidAmount).toBeNull();
        });

        it('should invalidate personal expense cache for personal expenses', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockExpenseHelper.findVisibleExpense.mockResolvedValue(mockPersonalExpense);
            mockPrismaService.expensePaymentStatus.upsert.mockResolvedValue(mockPaymentStatusRecord);

            await service.markPaid(mockUserId, mockExpenseId, dto);

            expect(mockCacheService.invalidateExpenseCache).toHaveBeenCalledWith(mockUserId, mockPersonalExpense.type, mockHouseholdId);
        });

        it('should invalidate shared expense cache for shared expenses', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockExpenseHelper.findVisibleExpense.mockResolvedValue(mockSharedExpense);
            mockPrismaService.expensePaymentStatus.upsert.mockResolvedValue({
                ...mockPaymentStatusRecord,
                expenseId: mockSharedExpense.id,
            });

            await service.markPaid(mockUserId, mockSharedExpense.id, dto);

            expect(mockCacheService.invalidateExpenseCache).toHaveBeenCalledWith(mockUserId, mockSharedExpense.type, mockHouseholdId);
        });

        it('should throw NotFoundException if user is not in a household', async () => {
            mockExpenseHelper.requireMembership.mockRejectedValue(new NotFoundException('You must be in a household to manage expenses'));

            try {
                await service.markPaid(mockUserId, mockExpenseId, dto);
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error: any) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('You must be in a household to manage expenses');
            }

            expect(mockExpenseHelper.findVisibleExpense).not.toHaveBeenCalled();
        });

        it('should throw NotFoundException if expense is not found in household', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockExpenseHelper.findVisibleExpense.mockRejectedValue(new NotFoundException('Expense not found'));

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
            mockExpenseHelper.findVisibleExpense.mockRejectedValue(new NotFoundException('Expense not found'));

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
            mockExpenseHelper.findVisibleExpense.mockResolvedValue(mockPersonalExpense);
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
            mockExpenseHelper.findVisibleExpense.mockResolvedValue(mockPersonalExpense);
            mockPrismaService.expensePaymentStatus.upsert.mockResolvedValue({
                ...mockPaymentStatusRecord,
                month: 12,
            });

            const result = await service.markPaid(mockUserId, mockExpenseId, { month: 12, year: 2026 });

            expect(result.month).toBe(12);
        });

        it('should throw BadRequestException if expense is flexible and no paidAmount is provided', async () => {
            // Arrange
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockExpenseHelper.findVisibleExpense.mockResolvedValue(mockFlexibleExpense);

            // Act & Assert
            await expect(service.markPaid(mockUserId, mockFlexibleExpense.id, { month: 6, year: 2026 })).rejects.toThrow(BadRequestException);
            await expect(service.markPaid(mockUserId, mockFlexibleExpense.id, { month: 6, year: 2026 })).rejects.toThrow(
                'paidAmount is required for flexible expenses',
            );
            expect(mockPrismaService.expensePaymentStatus.upsert).not.toHaveBeenCalled();
        });

        it('should store paidAmount for flexible expenses and return it in response', async () => {
            // Arrange
            const flexiblePaymentRecord = {
                ...mockPaymentStatusRecord,
                expenseId: mockFlexibleExpense.id,
                paidAmount: 275.5,
            };
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockExpenseHelper.findVisibleExpense.mockResolvedValue(mockFlexibleExpense);
            mockPrismaService.expensePaymentStatus.upsert.mockResolvedValue(flexiblePaymentRecord);

            // Act
            const result = await service.markPaid(mockUserId, mockFlexibleExpense.id, {
                month: 6,
                year: 2026,
                paidAmount: 275.5,
            });

            // Assert
            expect(mockPrismaService.expensePaymentStatus.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    create: expect.objectContaining({ paidAmount: 275.5 }),
                    update: expect.objectContaining({ paidAmount: 275.5 }),
                }),
            );
            expect(result.paidAmount).toBe(275.5);
        });

        it('should store null paidAmount for fixed expenses even if paidAmount is provided', async () => {
            // Arrange
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockExpenseHelper.findVisibleExpense.mockResolvedValue(mockPersonalExpense); // isFixed: true
            mockPrismaService.expensePaymentStatus.upsert.mockResolvedValue(mockPaymentStatusRecord);

            // Act
            await service.markPaid(mockUserId, mockExpenseId, { month: 6, year: 2026, paidAmount: 100 });

            // Assert — paidAmount must be null for fixed expenses regardless of what was passed
            expect(mockPrismaService.expensePaymentStatus.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    create: expect.objectContaining({ paidAmount: null }),
                    update: expect.objectContaining({ paidAmount: null }),
                }),
            );
        });

        it('should compute remainingAmount from the override-adjusted monthly amount, not the base amount', async () => {
            // Arrange — a recurring override raised June's effective amount from 300 to 400
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockExpenseHelper.findVisibleExpense.mockResolvedValue(mockFlexibleExpense);
            mockPrismaService.expensePaymentStatus.upsert.mockResolvedValue({
                ...mockPaymentStatusRecord,
                expenseId: mockFlexibleExpense.id,
                paidAmount: 300,
            });
            mockCalculator.getMonthlyAmounts.mockResolvedValue(new Map([[mockFlexibleExpense.id, 400]]));

            // Act
            const result = await service.markPaid(mockUserId, mockFlexibleExpense.id, {
                month: 6,
                year: 2026,
                paidAmount: 300,
            });

            // Assert
            expect(mockCalculator.getMonthlyAmounts).toHaveBeenCalledWith([mockFlexibleExpense], 6, 2026);
            expect(result.remainingAmount).toBe(100); // 400 (override) - 300 (paid), not 300 - 300
        });

        it('should report zero remainingAmount for a fixed expense marked paid', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockExpenseHelper.findVisibleExpense.mockResolvedValue(mockPersonalExpense); // isFixed: true
            mockPrismaService.expensePaymentStatus.upsert.mockResolvedValue(mockPaymentStatusRecord);

            const result = await service.markPaid(mockUserId, mockExpenseId, dto);

            expect(result.remainingAmount).toBe(0);
        });
    });
    //#endregion

    //#region undoPaid
    describe('undoPaid', () => {
        const dto = { month: 6, year: 2026 };

        it('should reset payment status to PENDING and clear paidAmount', async () => {
            // Arrange
            const paidFlexibleRecord = {
                ...mockPaymentStatusRecord,
                paidAmount: 275.5,
            };
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockExpenseHelper.findVisibleExpense.mockResolvedValue(mockPersonalExpense);
            mockPrismaService.expensePaymentStatus.findUnique.mockResolvedValue(paidFlexibleRecord);
            mockPrismaService.expensePaymentStatus.update.mockResolvedValue({
                ...mockPaymentStatusRecord,
                status: PaymentStatus.PENDING,
                paidAt: null,
                paidAmount: null,
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
                    paidAmount: null,
                },
            });
            expect(result.status).toBe(PaymentStatus.PENDING);
            expect(result.paidAt).toBeNull();
            expect(result.paidAmount).toBeNull();
        });

        it('should invalidate cache after undoing paid status', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockExpenseHelper.findVisibleExpense.mockResolvedValue(mockPersonalExpense);
            mockPrismaService.expensePaymentStatus.findUnique.mockResolvedValue(mockPaymentStatusRecord);
            mockPrismaService.expensePaymentStatus.update.mockResolvedValue({
                ...mockPaymentStatusRecord,
                status: PaymentStatus.PENDING,
                paidAt: null,
            });

            await service.undoPaid(mockUserId, mockExpenseId, dto);

            expect(mockCacheService.invalidateExpenseCache).toHaveBeenCalledWith(mockUserId, mockPersonalExpense.type, mockHouseholdId);
        });

        it('should throw NotFoundException if user is not in a household', async () => {
            mockExpenseHelper.requireMembership.mockRejectedValue(new NotFoundException('You must be in a household to manage expenses'));

            try {
                await service.undoPaid(mockUserId, mockExpenseId, dto);
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error: any) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('You must be in a household to manage expenses');
            }

            expect(mockExpenseHelper.findVisibleExpense).not.toHaveBeenCalled();
        });

        it('should throw NotFoundException if expense is not found', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockExpenseHelper.findVisibleExpense.mockRejectedValue(new NotFoundException('Expense not found'));

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
            mockExpenseHelper.findVisibleExpense.mockResolvedValue(mockPersonalExpense);
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
            mockExpenseHelper.findVisibleExpense.mockResolvedValue(mockPersonalExpense);
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
            mockExpenseHelper.findVisibleExpense.mockResolvedValue(mockPersonalExpense);
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
            mockExpenseHelper.findVisibleExpense.mockResolvedValue(mockPersonalExpense);
            mockPrismaService.expensePaymentStatus.upsert.mockResolvedValue({
                ...mockPaymentStatusRecord,
                status: PaymentStatus.CANCELLED,
                paidAt: null,
            });

            await service.cancel(mockUserId, mockExpenseId, dto);

            expect(mockCacheService.invalidateExpenseCache).toHaveBeenCalledWith(mockUserId, mockPersonalExpense.type, mockHouseholdId);
        });

        it('should invalidate shared expense cache when cancelling a shared expense', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockExpenseHelper.findVisibleExpense.mockResolvedValue(mockSharedExpense);
            mockPrismaService.expensePaymentStatus.upsert.mockResolvedValue({
                ...mockPaymentStatusRecord,
                expenseId: mockSharedExpense.id,
                status: PaymentStatus.CANCELLED,
            });

            await service.cancel(mockUserId, mockSharedExpense.id, dto);

            expect(mockCacheService.invalidateExpenseCache).toHaveBeenCalledWith(mockUserId, mockSharedExpense.type, mockHouseholdId);
        });

        it('should throw NotFoundException if user is not in a household', async () => {
            mockExpenseHelper.requireMembership.mockRejectedValue(new NotFoundException('You must be in a household to manage expenses'));

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
            mockExpenseHelper.findVisibleExpense.mockRejectedValue(new NotFoundException('Expense not found'));

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
            mockExpenseHelper.findVisibleExpense.mockResolvedValue(mockPersonalExpense);
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
            mockExpenseHelper.findVisibleExpense.mockResolvedValue(mockPersonalExpense);
            mockPrismaService.expensePaymentStatus.findMany.mockResolvedValue([]);

            const result = await service.getPaymentStatuses(mockUserId, mockExpenseId);

            expect(result).toEqual([]);
        });

        it('should throw NotFoundException if user is not in a household', async () => {
            mockExpenseHelper.requireMembership.mockRejectedValue(new NotFoundException('You must be in a household to manage expenses'));

            try {
                await service.getPaymentStatuses(mockUserId, mockExpenseId);
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error: any) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('You must be in a household to manage expenses');
            }

            expect(mockExpenseHelper.findVisibleExpense).not.toHaveBeenCalled();
        });

        it('should throw NotFoundException if expense is not found', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockExpenseHelper.findVisibleExpense.mockRejectedValue(new NotFoundException('Expense not found'));

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
            mockExpenseHelper.findVisibleExpense.mockRejectedValue(new NotFoundException('Expense not found'));

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
            mockExpenseHelper.findVisibleExpense.mockResolvedValue(mockPersonalExpense); // isFixed: true
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
                paidAmount: null,
                remainingAmount: 0, // PAID + isFixed: nothing outstanding
                createdAt: mockPaymentStatusRecord.createdAt,
                updatedAt: mockPaymentStatusRecord.updatedAt,
            });
        });

        it("should apply the matching month's override amount when computing remainingAmount", async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockExpenseHelper.findVisibleExpense.mockResolvedValue(mockFlexibleExpense);
            mockPrismaService.expensePaymentStatus.findMany.mockResolvedValue([
                { ...mockPaymentStatusRecord, expenseId: mockFlexibleExpense.id, month: 6, year: 2026, paidAmount: 300 },
            ]);
            mockPrismaService.recurringOverride.findMany.mockResolvedValue([{ month: 6, year: 2026, amount: 400 }]);
            mockCalculator.getMonthlyAmount.mockReturnValue(400);

            const result = await service.getPaymentStatuses(mockUserId, mockFlexibleExpense.id);

            expect(mockCalculator.getMonthlyAmount).toHaveBeenCalledWith(mockFlexibleExpense, 6, 2026, 400);
            expect(result[0].remainingAmount).toBe(100); // 400 (override) - 300 (paid)
        });
    });
    //#endregion

    //#region getBatchPaymentStatuses
    describe('getBatchPaymentStatuses', () => {
        it("should scope the query to shared expenses and the caller's own personal expenses", async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockExpenseHelper.visibleExpenseFilter.mockReturnValue({
                OR: [{ type: ExpenseType.SHARED }, { type: ExpenseType.PERSONAL, createdById: mockUserId }],
            });
            mockPrismaService.expensePaymentStatus.findMany.mockResolvedValue([]);

            await service.getBatchPaymentStatuses(mockUserId, 6, 2026);

            expect(mockExpenseHelper.visibleExpenseFilter).toHaveBeenCalledWith(mockUserId);
            expect(mockPrismaService.expensePaymentStatus.findMany).toHaveBeenCalledWith({
                where: {
                    month: 6,
                    year: 2026,
                    expense: {
                        householdId: mockHouseholdId,
                        deletedAt: null,
                        OR: [{ type: ExpenseType.SHARED }, { type: ExpenseType.PERSONAL, createdById: mockUserId }],
                    },
                },
                include: { expense: true },
            });
        });

        it('should compute remainingAmount from the override-adjusted monthly amount for each expense', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockExpenseHelper.visibleExpenseFilter.mockReturnValue({ OR: [] });
            mockPrismaService.expensePaymentStatus.findMany.mockResolvedValue([
                { ...mockPaymentStatusRecord, expenseId: mockFlexibleExpense.id, paidAmount: 300, expense: mockFlexibleExpense },
            ]);
            mockCalculator.getMonthlyAmounts.mockResolvedValue(new Map([[mockFlexibleExpense.id, 400]]));

            const result = await service.getBatchPaymentStatuses(mockUserId, 6, 2026);

            expect(mockCalculator.getMonthlyAmounts).toHaveBeenCalledWith([mockFlexibleExpense], 6, 2026);
            expect(result[0].remainingAmount).toBe(100); // 400 (override) - 300 (paid)
        });

        it('should throw NotFoundException if user is not in a household', async () => {
            mockExpenseHelper.requireMembership.mockRejectedValue(new NotFoundException('You must be in a household to manage expenses'));

            try {
                await service.getBatchPaymentStatuses(mockUserId, 6, 2026);
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error: any) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('You must be in a household to manage expenses');
            }

            expect(mockPrismaService.expensePaymentStatus.findMany).not.toHaveBeenCalled();
        });
    });
    //#endregion

    //#region cross-member IDOR prevention
    describe('cross-member access control', () => {
        const dto = { month: 6, year: 2026 };

        beforeEach(() => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            // Another member's personal expense is invisible to this caller —
            // the shared helper throws instead of returning it.
            mockExpenseHelper.findVisibleExpense.mockRejectedValue(new NotFoundException('Expense not found'));
        });

        it("should not let a member mark another member's personal expense as paid", async () => {
            try {
                await service.markPaid(mockUserId, 'expense-other-001', dto);
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error: any) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('Expense not found');
            }

            expect(mockPrismaService.expensePaymentStatus.upsert).not.toHaveBeenCalled();
        });

        it("should not let a member undo another member's personal expense payment", async () => {
            try {
                await service.undoPaid(mockUserId, 'expense-other-001', dto);
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error: any) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('Expense not found');
            }

            expect(mockPrismaService.expensePaymentStatus.findUnique).not.toHaveBeenCalled();
        });

        it("should not let a member cancel another member's personal expense", async () => {
            try {
                await service.cancel(mockUserId, 'expense-other-001', dto);
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error: any) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('Expense not found');
            }

            expect(mockPrismaService.expensePaymentStatus.upsert).not.toHaveBeenCalled();
        });

        it("should not let a member read another member's personal expense payment statuses", async () => {
            try {
                await service.getPaymentStatuses(mockUserId, 'expense-other-001');
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error: any) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('Expense not found');
            }

            expect(mockPrismaService.expensePaymentStatus.findMany).not.toHaveBeenCalled();
        });

        it('should allow any member to mark a shared expense as paid', async () => {
            mockExpenseHelper.findVisibleExpense.mockResolvedValue(mockSharedExpense);
            mockPrismaService.expensePaymentStatus.upsert.mockResolvedValue({
                ...mockPaymentStatusRecord,
                expenseId: mockSharedExpense.id,
            });

            const result = await service.markPaid(mockUserId, mockSharedExpense.id, dto);

            expect(result.expenseId).toBe(mockSharedExpense.id);
            expect(mockPrismaService.expensePaymentStatus.upsert).toHaveBeenCalled();
        });

        it('should allow a member to mark their own personal expense as paid', async () => {
            mockExpenseHelper.findVisibleExpense.mockResolvedValue(mockPersonalExpense);
            mockPrismaService.expensePaymentStatus.upsert.mockResolvedValue(mockPaymentStatusRecord);

            const result = await service.markPaid(mockUserId, mockExpenseId, dto);

            expect(result.id).toBe('ps-001');
            expect(mockPrismaService.expensePaymentStatus.upsert).toHaveBeenCalled();
        });
    });
    //#endregion
});
