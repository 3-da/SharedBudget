import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ExpenseHelperService } from './expense-helper.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ApprovalStatus, ExpenseType } from '../../generated/prisma/enums';

describe('ExpenseHelperService', () => {
    let service: ExpenseHelperService;

    const mockUserId = 'user-123';
    const mockHouseholdId = 'household-456';
    const mockExpenseId = 'expense-001';

    const mockMembership = {
        userId: mockUserId,
        householdId: mockHouseholdId,
        role: 'OWNER',
    };

    const mockPrismaService = {
        householdMember: { findUnique: vi.fn() },
        expense: { findFirst: vi.fn() },
        expenseApproval: { findFirst: vi.fn() },
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [ExpenseHelperService, { provide: PrismaService, useValue: mockPrismaService }],
        }).compile();

        service = module.get<ExpenseHelperService>(ExpenseHelperService);

        vi.clearAllMocks();
    });

    //#region requireMembership
    describe('requireMembership', () => {
        it('should return membership when user belongs to a household', async () => {
            mockPrismaService.householdMember.findUnique.mockResolvedValue(mockMembership);

            const result = await service.requireMembership(mockUserId);

            expect(mockPrismaService.householdMember.findUnique).toHaveBeenCalledWith({
                where: { userId: mockUserId },
            });
            expect(result).toEqual(mockMembership);
        });

        it('should throw NotFoundException when user has no household', async () => {
            mockPrismaService.householdMember.findUnique.mockResolvedValue(null);

            await expect(service.requireMembership(mockUserId)).rejects.toThrow(NotFoundException);
            await expect(service.requireMembership(mockUserId)).rejects.toThrow(
                'You must be in a household to manage expenses',
            );
        });
    });
    //#endregion

    //#region findExpenseOrFail
    describe('findExpenseOrFail', () => {
        const mockExpense = {
            id: mockExpenseId,
            householdId: mockHouseholdId,
            type: ExpenseType.PERSONAL,
            deletedAt: null,
        };

        it('should return personal expense when found', async () => {
            mockPrismaService.expense.findFirst.mockResolvedValue(mockExpense);

            const result = await service.findExpenseOrFail(mockExpenseId, mockHouseholdId, ExpenseType.PERSONAL);

            expect(mockPrismaService.expense.findFirst).toHaveBeenCalledWith({
                where: { id: mockExpenseId, type: ExpenseType.PERSONAL, householdId: mockHouseholdId, deletedAt: null },
            });
            expect(result).toEqual(mockExpense);
        });

        it('should return shared expense when found', async () => {
            const sharedExpense = { ...mockExpense, type: ExpenseType.SHARED };
            mockPrismaService.expense.findFirst.mockResolvedValue(sharedExpense);

            const result = await service.findExpenseOrFail(mockExpenseId, mockHouseholdId, ExpenseType.SHARED);

            expect(mockPrismaService.expense.findFirst).toHaveBeenCalledWith({
                where: { id: mockExpenseId, type: ExpenseType.SHARED, householdId: mockHouseholdId, deletedAt: null },
            });
            expect(result).toEqual(sharedExpense);
        });

        it('should throw NotFoundException with "Personal" label when personal expense not found', async () => {
            mockPrismaService.expense.findFirst.mockResolvedValue(null);

            await expect(
                service.findExpenseOrFail(mockExpenseId, mockHouseholdId, ExpenseType.PERSONAL),
            ).rejects.toThrow(NotFoundException);
            await expect(
                service.findExpenseOrFail(mockExpenseId, mockHouseholdId, ExpenseType.PERSONAL),
            ).rejects.toThrow('Personal expense not found');
        });

        it('should throw NotFoundException with "Shared" label when shared expense not found', async () => {
            mockPrismaService.expense.findFirst.mockResolvedValue(null);

            await expect(
                service.findExpenseOrFail(mockExpenseId, mockHouseholdId, ExpenseType.SHARED),
            ).rejects.toThrow(NotFoundException);
            await expect(
                service.findExpenseOrFail(mockExpenseId, mockHouseholdId, ExpenseType.SHARED),
            ).rejects.toThrow('Shared expense not found');
        });

        it('should not find soft-deleted expenses (deletedAt filter)', async () => {
            mockPrismaService.expense.findFirst.mockResolvedValue(null);

            await expect(
                service.findExpenseOrFail(mockExpenseId, mockHouseholdId, ExpenseType.PERSONAL),
            ).rejects.toThrow(NotFoundException);

            expect(mockPrismaService.expense.findFirst).toHaveBeenCalledWith({
                where: expect.objectContaining({ deletedAt: null }),
            });
        });
    });
    //#endregion

    //#region validatePaidByUserId
    describe('validatePaidByUserId', () => {
        it('should pass when paidByUserId is a member of the household', async () => {
            const paidByUserId = 'payer-123';
            mockPrismaService.householdMember.findUnique.mockResolvedValue({
                userId: paidByUserId,
                householdId: mockHouseholdId,
            });

            await expect(service.validatePaidByUserId(paidByUserId, mockHouseholdId)).resolves.not.toThrow();
        });

        it('should throw NotFoundException when paidByUserId does not exist', async () => {
            mockPrismaService.householdMember.findUnique.mockResolvedValue(null);

            await expect(service.validatePaidByUserId('nonexistent', mockHouseholdId)).rejects.toThrow(
                NotFoundException,
            );
            await expect(service.validatePaidByUserId('nonexistent', mockHouseholdId)).rejects.toThrow(
                'The specified payer is not a member of this household',
            );
        });

        it('should throw NotFoundException when paidByUserId is in a different household', async () => {
            mockPrismaService.householdMember.findUnique.mockResolvedValue({
                userId: 'other-user',
                householdId: 'other-household',
            });

            await expect(service.validatePaidByUserId('other-user', mockHouseholdId)).rejects.toThrow(
                NotFoundException,
            );
            await expect(service.validatePaidByUserId('other-user', mockHouseholdId)).rejects.toThrow(
                'The specified payer is not a member of this household',
            );
        });
    });
    //#endregion

    //#region checkNoPendingApproval
    describe('checkNoPendingApproval', () => {
        it('should pass when no pending approval exists', async () => {
            mockPrismaService.expenseApproval.findFirst.mockResolvedValue(null);

            await expect(service.checkNoPendingApproval(mockExpenseId)).resolves.not.toThrow();

            expect(mockPrismaService.expenseApproval.findFirst).toHaveBeenCalledWith({
                where: { expenseId: mockExpenseId, status: ApprovalStatus.PENDING },
            });
        });

        it('should throw ConflictException when pending approval exists', async () => {
            mockPrismaService.expenseApproval.findFirst.mockResolvedValue({
                id: 'approval-001',
                status: ApprovalStatus.PENDING,
            });

            await expect(service.checkNoPendingApproval(mockExpenseId)).rejects.toThrow(ConflictException);
            await expect(service.checkNoPendingApproval(mockExpenseId)).rejects.toThrow(
                'There is already a pending approval for this expense',
            );
        });
    });
    //#endregion
});
