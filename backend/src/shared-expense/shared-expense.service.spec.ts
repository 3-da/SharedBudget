import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { SharedExpenseService } from './shared-expense.service';
import { PrismaService } from '../prisma/prisma.service';
import { ExpenseHelperService } from '../common/expense/expense-helper.service';
import { CacheService } from '../common/cache/cache.service';
import {
    ApprovalAction,
    ApprovalStatus,
    ExpenseCategory,
    ExpenseFrequency,
    ExpenseType,
    InstallmentFrequency,
    YearlyPaymentStrategy,
} from '../generated/prisma/enums';

describe('SharedExpenseService', () => {
    let service: SharedExpenseService;

    const mockUserId = 'user-123';
    const mockOtherUserId = 'user-789';
    const mockHouseholdId = 'household-456';
    const mockExpenseId = 'expense-001';
    const mockApprovalId = 'approval-001';

    const mockMembership = {
        userId: mockUserId,
        householdId: mockHouseholdId,
        role: 'OWNER',
    };

    const mockOtherMembership = {
        userId: mockOtherUserId,
        householdId: mockHouseholdId,
        role: 'MEMBER',
    };

    const mockExpenseRecord = {
        id: mockExpenseId,
        householdId: mockHouseholdId,
        createdById: mockUserId,
        paidByUserId: null,
        name: 'Monthly Rent',
        amount: 800,
        type: ExpenseType.SHARED,
        category: ExpenseCategory.RECURRING,
        frequency: ExpenseFrequency.MONTHLY,
        yearlyPaymentStrategy: null,
        installmentFrequency: null,
        installmentCount: null,
        paymentMonth: null,
        month: null,
        year: null,
        createdAt: new Date('2026-01-15'),
        updatedAt: new Date('2026-01-15'),
        deletedAt: null,
    };

    const mockApprovalRecord = {
        id: mockApprovalId,
        expenseId: null,
        householdId: mockHouseholdId,
        action: ApprovalAction.CREATE,
        status: ApprovalStatus.PENDING,
        requestedById: mockUserId,
        reviewedById: null,
        message: null,
        proposedData: {
            name: 'Monthly Rent',
            amount: 800,
            category: ExpenseCategory.RECURRING,
            frequency: ExpenseFrequency.MONTHLY,
            paidByUserId: null,
            yearlyPaymentStrategy: null,
            installmentFrequency: null,
            installmentCount: null,
            paymentMonth: null,
            month: null,
            year: null,
        },
        createdAt: new Date('2026-01-15'),
        reviewedAt: null,
    };

    const mockPrismaService = {
        expense: { findMany: vi.fn() },
        expenseApproval: { create: vi.fn() },
    };

    const mockExpenseHelper = {
        requireMembership: vi.fn(),
        findExpenseOrFail: vi.fn(),
        validatePaidByUserId: vi.fn(),
        checkNoPendingApproval: vi.fn(),
    };

    const mockCacheService = {
        getOrSet: vi.fn((key, ttl, fetchFn) => fetchFn()),
        invalidateApprovals: vi.fn(),
        invalidateSharedExpenses: vi.fn(),
        sharedExpensesKey: vi.fn((householdId, filterHash) => `cache:expenses:shared:${householdId}:${filterHash}`),
        hashParams: vi.fn(() => 'default'),
        expensesTTL: 60,
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                SharedExpenseService,
                { provide: PrismaService, useValue: mockPrismaService },
                { provide: ExpenseHelperService, useValue: mockExpenseHelper },
                { provide: CacheService, useValue: mockCacheService },
            ],
        }).compile();

        service = module.get<SharedExpenseService>(SharedExpenseService);

        vi.clearAllMocks();
    });

    //#region listSharedExpenses
    describe('listSharedExpenses', () => {
        it('should return all shared expenses for the household', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findMany.mockResolvedValue([mockExpenseRecord]);

            const result = await service.listSharedExpenses(mockUserId, {});

            expect(mockExpenseHelper.requireMembership).toHaveBeenCalledWith(mockUserId);
            expect(mockPrismaService.expense.findMany).toHaveBeenCalledWith({
                where: {
                    householdId: mockHouseholdId,
                    type: ExpenseType.SHARED,
                    deletedAt: null,
                },
                orderBy: { createdAt: 'desc' },
            });
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe(mockExpenseId);
            expect(result[0].amount).toBe(800);
        });

        it('should return empty array when household has no shared expenses', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findMany.mockResolvedValue([]);

            const result = await service.listSharedExpenses(mockUserId, {});

            expect(result).toEqual([]);
        });

        it('should filter by category when provided', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findMany.mockResolvedValue([]);

            await service.listSharedExpenses(mockUserId, { category: ExpenseCategory.ONE_TIME });

            expect(mockPrismaService.expense.findMany).toHaveBeenCalledWith({
                where: {
                    householdId: mockHouseholdId,
                    type: ExpenseType.SHARED,
                    deletedAt: null,
                    category: ExpenseCategory.ONE_TIME,
                },
                orderBy: { createdAt: 'desc' },
            });
        });

        it('should filter by frequency when provided', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findMany.mockResolvedValue([]);

            await service.listSharedExpenses(mockUserId, { frequency: ExpenseFrequency.YEARLY });

            expect(mockPrismaService.expense.findMany).toHaveBeenCalledWith({
                where: {
                    householdId: mockHouseholdId,
                    type: ExpenseType.SHARED,
                    deletedAt: null,
                    frequency: ExpenseFrequency.YEARLY,
                },
                orderBy: { createdAt: 'desc' },
            });
        });

        it('should filter by both category and frequency when provided', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findMany.mockResolvedValue([]);

            await service.listSharedExpenses(mockUserId, {
                category: ExpenseCategory.RECURRING,
                frequency: ExpenseFrequency.MONTHLY,
            });

            expect(mockPrismaService.expense.findMany).toHaveBeenCalledWith({
                where: {
                    householdId: mockHouseholdId,
                    type: ExpenseType.SHARED,
                    deletedAt: null,
                    category: ExpenseCategory.RECURRING,
                    frequency: ExpenseFrequency.MONTHLY,
                },
                orderBy: { createdAt: 'desc' },
            });
        });

        it('should throw NotFoundException if user has no household', async () => {
            mockExpenseHelper.requireMembership.mockRejectedValue(new NotFoundException('You must be in a household to manage expenses'));

            try {
                await service.listSharedExpenses(mockUserId, {});
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('You must be in a household to manage expenses');
            }
            expect(mockPrismaService.expense.findMany).not.toHaveBeenCalled();
        });

        it('should convert Decimal amount to number in response', async () => {
            const expenseWithDecimal = { ...mockExpenseRecord, amount: { toNumber: () => 800, toString: () => '800' } };
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findMany.mockResolvedValue([expenseWithDecimal]);

            const result = await service.listSharedExpenses(mockUserId, {});

            expect(typeof result[0].amount).toBe('number');
        });
    });
    //#endregion

    //#region getSharedExpense
    describe('getSharedExpense', () => {
        it('should return a shared expense by id', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockExpenseHelper.findExpenseOrFail.mockResolvedValue(mockExpenseRecord);

            const result = await service.getSharedExpense(mockUserId, mockExpenseId);

            expect(mockExpenseHelper.findExpenseOrFail).toHaveBeenCalledWith(mockExpenseId, mockHouseholdId, ExpenseType.SHARED);
            expect(result.id).toBe(mockExpenseId);
            expect(result.paidByUserId).toBeNull();
        });

        it('should allow any household member to view shared expenses', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockOtherMembership);
            mockExpenseHelper.findExpenseOrFail.mockResolvedValue(mockExpenseRecord);

            const result = await service.getSharedExpense(mockOtherUserId, mockExpenseId);

            expect(result.id).toBe(mockExpenseId);
        });

        it('should throw NotFoundException if user has no household', async () => {
            mockExpenseHelper.requireMembership.mockRejectedValue(new NotFoundException('You must be in a household to manage expenses'));

            try {
                await service.getSharedExpense(mockUserId, mockExpenseId);
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('You must be in a household to manage expenses');
            }
        });

        it('should throw NotFoundException if expense does not exist', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockExpenseHelper.findExpenseOrFail.mockRejectedValue(new NotFoundException('Shared expense not found'));

            try {
                await service.getSharedExpense(mockUserId, 'nonexistent-id');
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('Shared expense not found');
            }
        });

        it('should not reveal expenses from other households (enumeration prevention)', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockExpenseHelper.findExpenseOrFail.mockRejectedValue(new NotFoundException('Shared expense not found'));

            try {
                await service.getSharedExpense(mockUserId, 'expense-in-other-household');
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('Shared expense not found');
            }
        });
    });
    //#endregion

    //#region proposeCreateSharedExpense
    describe('proposeCreateSharedExpense', () => {
        const createDto = {
            name: 'Monthly Rent',
            amount: 800,
            category: ExpenseCategory.RECURRING,
            frequency: ExpenseFrequency.MONTHLY,
        };

        it('should create an approval for a new shared expense', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expenseApproval.create.mockResolvedValue(mockApprovalRecord);

            const result = await service.proposeCreateSharedExpense(mockUserId, createDto);

            expect(mockPrismaService.expenseApproval.create).toHaveBeenCalledWith({
                data: {
                    householdId: mockHouseholdId,
                    action: ApprovalAction.CREATE,
                    status: ApprovalStatus.PENDING,
                    requestedById: mockUserId,
                    expenseId: null,
                    proposedData: {
                        name: 'Monthly Rent',
                        amount: 800,
                        category: ExpenseCategory.RECURRING,
                        frequency: ExpenseFrequency.MONTHLY,
                        paidByUserId: null,
                        yearlyPaymentStrategy: null,
                        installmentFrequency: null,
                        installmentCount: null,
                        paymentMonth: null,
                        month: null,
                        year: null,
                    },
                },
            });
            expect(result.id).toBe(mockApprovalId);
            expect(result.action).toBe(ApprovalAction.CREATE);
            expect(result.status).toBe(ApprovalStatus.PENDING);
            expect(result.expenseId).toBeNull();
        });

        it('should create an approval with paidByUserId when specified', async () => {
            const dtoWithPayer = { ...createDto, paidByUserId: mockOtherUserId };
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockExpenseHelper.validatePaidByUserId.mockResolvedValue(undefined);
            const approvalWithPayer = {
                ...mockApprovalRecord,
                proposedData: { ...mockApprovalRecord.proposedData, paidByUserId: mockOtherUserId },
            };
            mockPrismaService.expenseApproval.create.mockResolvedValue(approvalWithPayer);

            const result = await service.proposeCreateSharedExpense(mockUserId, dtoWithPayer);

            expect(mockExpenseHelper.validatePaidByUserId).toHaveBeenCalledWith(mockOtherUserId, mockHouseholdId);
            expect(result.proposedData).toHaveProperty('paidByUserId', mockOtherUserId);
        });

        it('should create an approval for a yearly expense with FULL strategy', async () => {
            const yearlyDto = {
                name: 'Home Insurance',
                amount: 1200,
                category: ExpenseCategory.RECURRING,
                frequency: ExpenseFrequency.YEARLY,
                yearlyPaymentStrategy: YearlyPaymentStrategy.FULL,
                paymentMonth: 6,
            };
            const yearlyApproval = {
                ...mockApprovalRecord,
                proposedData: {
                    ...mockApprovalRecord.proposedData,
                    name: 'Home Insurance',
                    amount: 1200,
                    frequency: ExpenseFrequency.YEARLY,
                    yearlyPaymentStrategy: YearlyPaymentStrategy.FULL,
                    paymentMonth: 6,
                },
            };
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expenseApproval.create.mockResolvedValue(yearlyApproval);

            const result = await service.proposeCreateSharedExpense(mockUserId, yearlyDto);

            expect(mockPrismaService.expenseApproval.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    proposedData: expect.objectContaining({
                        frequency: ExpenseFrequency.YEARLY,
                        yearlyPaymentStrategy: YearlyPaymentStrategy.FULL,
                        paymentMonth: 6,
                    }),
                }),
            });
            expect(result.proposedData).toHaveProperty('yearlyPaymentStrategy', YearlyPaymentStrategy.FULL);
        });

        it('should create an approval for a yearly expense with INSTALLMENTS strategy', async () => {
            const installmentDto = {
                name: 'Property Tax',
                amount: 1200,
                category: ExpenseCategory.RECURRING,
                frequency: ExpenseFrequency.YEARLY,
                yearlyPaymentStrategy: YearlyPaymentStrategy.INSTALLMENTS,
                installmentFrequency: InstallmentFrequency.QUARTERLY,
            };
            const installmentApproval = {
                ...mockApprovalRecord,
                proposedData: {
                    ...mockApprovalRecord.proposedData,
                    name: 'Property Tax',
                    amount: 1200,
                    frequency: ExpenseFrequency.YEARLY,
                    yearlyPaymentStrategy: YearlyPaymentStrategy.INSTALLMENTS,
                    installmentFrequency: InstallmentFrequency.QUARTERLY,
                },
            };
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expenseApproval.create.mockResolvedValue(installmentApproval);

            const result = await service.proposeCreateSharedExpense(mockUserId, installmentDto);

            expect(result.proposedData).toHaveProperty('installmentFrequency', InstallmentFrequency.QUARTERLY);
        });

        it('should throw NotFoundException if user has no household', async () => {
            mockExpenseHelper.requireMembership.mockRejectedValue(new NotFoundException('You must be in a household to manage expenses'));

            try {
                await service.proposeCreateSharedExpense(mockUserId, createDto);
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('You must be in a household to manage expenses');
            }
            expect(mockPrismaService.expenseApproval.create).not.toHaveBeenCalled();
        });

        it('should throw NotFoundException if paidByUserId is not in the same household', async () => {
            const dtoWithInvalidPayer = { ...createDto, paidByUserId: 'outsider-user' };
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockExpenseHelper.validatePaidByUserId.mockRejectedValue(new NotFoundException('The specified payer is not a member of this household'));

            try {
                await service.proposeCreateSharedExpense(mockUserId, dtoWithInvalidPayer);
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('The specified payer is not a member of this household');
            }
            expect(mockPrismaService.expenseApproval.create).not.toHaveBeenCalled();
        });

        it('should throw NotFoundException if paidByUserId is in a different household', async () => {
            const dtoWithWrongHousehold = { ...createDto, paidByUserId: 'other-household-user' };
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockExpenseHelper.validatePaidByUserId.mockRejectedValue(new NotFoundException('The specified payer is not a member of this household'));

            try {
                await service.proposeCreateSharedExpense(mockUserId, dtoWithWrongHousehold);
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('The specified payer is not a member of this household');
            }
        });
    });
    //#endregion

    //#region proposeUpdateSharedExpense
    describe('proposeUpdateSharedExpense', () => {
        const updateDto = { name: 'Updated Rent', amount: 850 };

        it('should create an approval for updating a shared expense', async () => {
            const updateApproval = {
                ...mockApprovalRecord,
                action: ApprovalAction.UPDATE,
                expenseId: mockExpenseId,
                proposedData: { name: 'Updated Rent', amount: 850 },
            };
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockExpenseHelper.findExpenseOrFail.mockResolvedValue(mockExpenseRecord);
            mockExpenseHelper.checkNoPendingApproval.mockResolvedValue(undefined);
            mockPrismaService.expenseApproval.create.mockResolvedValue(updateApproval);

            const result = await service.proposeUpdateSharedExpense(mockUserId, mockExpenseId, updateDto);

            expect(mockExpenseHelper.findExpenseOrFail).toHaveBeenCalledWith(mockExpenseId, mockHouseholdId, ExpenseType.SHARED);
            expect(mockExpenseHelper.checkNoPendingApproval).toHaveBeenCalledWith(mockExpenseId);
            expect(mockPrismaService.expenseApproval.create).toHaveBeenCalledWith({
                data: {
                    householdId: mockHouseholdId,
                    action: ApprovalAction.UPDATE,
                    status: ApprovalStatus.PENDING,
                    requestedById: mockUserId,
                    expenseId: mockExpenseId,
                    proposedData: { name: 'Updated Rent', amount: 850 },
                },
            });
            expect(result.action).toBe(ApprovalAction.UPDATE);
            expect(result.expenseId).toBe(mockExpenseId);
        });

        it('should only include provided fields in proposedData (partial update)', async () => {
            const partialDto = { amount: 900 };
            const partialApproval = {
                ...mockApprovalRecord,
                action: ApprovalAction.UPDATE,
                expenseId: mockExpenseId,
                proposedData: { amount: 900 },
            };
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockExpenseHelper.findExpenseOrFail.mockResolvedValue(mockExpenseRecord);
            mockExpenseHelper.checkNoPendingApproval.mockResolvedValue(undefined);
            mockPrismaService.expenseApproval.create.mockResolvedValue(partialApproval);

            await service.proposeUpdateSharedExpense(mockUserId, mockExpenseId, partialDto);

            expect(mockPrismaService.expenseApproval.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    proposedData: { amount: 900 },
                }),
            });
        });

        it('should validate paidByUserId when provided in update', async () => {
            const dtoWithPayer = { paidByUserId: mockOtherUserId };
            const approvalWithPayer = {
                ...mockApprovalRecord,
                action: ApprovalAction.UPDATE,
                expenseId: mockExpenseId,
                proposedData: { paidByUserId: mockOtherUserId },
            };
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockExpenseHelper.findExpenseOrFail.mockResolvedValue(mockExpenseRecord);
            mockExpenseHelper.checkNoPendingApproval.mockResolvedValue(undefined);
            mockExpenseHelper.validatePaidByUserId.mockResolvedValue(undefined);
            mockPrismaService.expenseApproval.create.mockResolvedValue(approvalWithPayer);

            const result = await service.proposeUpdateSharedExpense(mockUserId, mockExpenseId, dtoWithPayer);

            expect(mockExpenseHelper.validatePaidByUserId).toHaveBeenCalledWith(mockOtherUserId, mockHouseholdId);
            expect(result.proposedData).toHaveProperty('paidByUserId', mockOtherUserId);
        });

        it('should throw NotFoundException if user has no household', async () => {
            mockExpenseHelper.requireMembership.mockRejectedValue(new NotFoundException('You must be in a household to manage expenses'));

            try {
                await service.proposeUpdateSharedExpense(mockUserId, mockExpenseId, updateDto);
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('You must be in a household to manage expenses');
            }
        });

        it('should throw NotFoundException if expense does not exist', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockExpenseHelper.findExpenseOrFail.mockRejectedValue(new NotFoundException('Shared expense not found'));

            try {
                await service.proposeUpdateSharedExpense(mockUserId, 'nonexistent-id', updateDto);
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('Shared expense not found');
            }
        });

        it('should throw ConflictException if pending approval already exists', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockExpenseHelper.findExpenseOrFail.mockResolvedValue(mockExpenseRecord);
            mockExpenseHelper.checkNoPendingApproval.mockRejectedValue(new ConflictException('There is already a pending approval for this expense'));

            try {
                await service.proposeUpdateSharedExpense(mockUserId, mockExpenseId, updateDto);
                expect.unreachable('Should have thrown ConflictException');
            } catch (error) {
                expect(error).toBeInstanceOf(ConflictException);
                expect(error.message).toBe('There is already a pending approval for this expense');
            }
            expect(mockPrismaService.expenseApproval.create).not.toHaveBeenCalled();
        });

        it('should throw NotFoundException if paidByUserId is not in the household', async () => {
            const dtoWithInvalidPayer = { paidByUserId: 'outsider-user' };
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockExpenseHelper.findExpenseOrFail.mockResolvedValue(mockExpenseRecord);
            mockExpenseHelper.checkNoPendingApproval.mockResolvedValue(undefined);
            mockExpenseHelper.validatePaidByUserId.mockRejectedValue(new NotFoundException('The specified payer is not a member of this household'));

            try {
                await service.proposeUpdateSharedExpense(mockUserId, mockExpenseId, dtoWithInvalidPayer);
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('The specified payer is not a member of this household');
            }
        });
    });
    //#endregion

    //#region proposeDeleteSharedExpense
    describe('proposeDeleteSharedExpense', () => {
        it('should create an approval for deleting a shared expense', async () => {
            const deleteApproval = {
                ...mockApprovalRecord,
                action: ApprovalAction.DELETE,
                expenseId: mockExpenseId,
                proposedData: null,
            };
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockExpenseHelper.findExpenseOrFail.mockResolvedValue(mockExpenseRecord);
            mockExpenseHelper.checkNoPendingApproval.mockResolvedValue(undefined);
            mockPrismaService.expenseApproval.create.mockResolvedValue(deleteApproval);

            const result = await service.proposeDeleteSharedExpense(mockUserId, mockExpenseId);

            expect(mockPrismaService.expenseApproval.create).toHaveBeenCalledWith({
                data: {
                    householdId: mockHouseholdId,
                    action: ApprovalAction.DELETE,
                    status: ApprovalStatus.PENDING,
                    requestedById: mockUserId,
                    expenseId: mockExpenseId,
                },
            });
            expect(result.action).toBe(ApprovalAction.DELETE);
            expect(result.expenseId).toBe(mockExpenseId);
            expect(result.proposedData).toBeNull();
        });

        it('should throw NotFoundException if user has no household', async () => {
            mockExpenseHelper.requireMembership.mockRejectedValue(new NotFoundException('You must be in a household to manage expenses'));

            try {
                await service.proposeDeleteSharedExpense(mockUserId, mockExpenseId);
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('You must be in a household to manage expenses');
            }
        });

        it('should throw NotFoundException if expense does not exist', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockExpenseHelper.findExpenseOrFail.mockRejectedValue(new NotFoundException('Shared expense not found'));

            try {
                await service.proposeDeleteSharedExpense(mockUserId, 'nonexistent-id');
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('Shared expense not found');
            }
        });

        it('should throw ConflictException if pending approval already exists', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockExpenseHelper.findExpenseOrFail.mockResolvedValue(mockExpenseRecord);
            mockExpenseHelper.checkNoPendingApproval.mockRejectedValue(new ConflictException('There is already a pending approval for this expense'));

            try {
                await service.proposeDeleteSharedExpense(mockUserId, mockExpenseId);
                expect.unreachable('Should have thrown ConflictException');
            } catch (error) {
                expect(error).toBeInstanceOf(ConflictException);
                expect(error.message).toBe('There is already a pending approval for this expense');
            }
            expect(mockPrismaService.expenseApproval.create).not.toHaveBeenCalled();
        });

        it('should not reveal expenses from other households', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockExpenseHelper.findExpenseOrFail.mockRejectedValue(new NotFoundException('Shared expense not found'));

            try {
                await service.proposeDeleteSharedExpense(mockUserId, 'expense-in-other-household');
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('Shared expense not found');
            }
        });
    });
    //#endregion
});
