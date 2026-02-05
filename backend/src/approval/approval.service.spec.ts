import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ApprovalService } from './approval.service';
import { PrismaService } from '../prisma/prisma.service';
import { ExpenseHelperService } from '../common/expense/expense-helper.service';
import { CacheService } from '../common/cache/cache.service';
import { ApprovalAction, ApprovalStatus, ExpenseCategory, ExpenseFrequency, ExpenseType } from '../generated/prisma/enums';

describe('ApprovalService', () => {
    let service: ApprovalService;

    const mockUserId = 'user-123';
    const mockReviewerId = 'user-789';
    const mockHouseholdId = 'household-456';
    const mockApprovalId = 'approval-001';
    const mockExpenseId = 'expense-001';

    const mockMembership = {
        userId: mockUserId,
        householdId: mockHouseholdId,
        role: 'OWNER',
    };

    const mockReviewerMembership = {
        userId: mockReviewerId,
        householdId: mockHouseholdId,
        role: 'MEMBER',
    };

    const mockPendingCreateApproval = {
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
            paymentMonth: null,
            month: null,
            year: null,
        },
        createdAt: new Date('2026-01-15'),
        reviewedAt: null,
    };

    const mockPendingUpdateApproval = {
        id: 'approval-002',
        expenseId: mockExpenseId,
        householdId: mockHouseholdId,
        action: ApprovalAction.UPDATE,
        status: ApprovalStatus.PENDING,
        requestedById: mockUserId,
        reviewedById: null,
        message: null,
        proposedData: { name: 'Updated Rent', amount: 850 },
        createdAt: new Date('2026-01-16'),
        reviewedAt: null,
    };

    const mockPendingDeleteApproval = {
        id: 'approval-003',
        expenseId: mockExpenseId,
        householdId: mockHouseholdId,
        action: ApprovalAction.DELETE,
        status: ApprovalStatus.PENDING,
        requestedById: mockUserId,
        reviewedById: null,
        message: null,
        proposedData: null,
        createdAt: new Date('2026-01-17'),
        reviewedAt: null,
    };

    const mockAcceptedApproval = {
        ...mockPendingCreateApproval,
        status: ApprovalStatus.ACCEPTED,
        reviewedById: mockReviewerId,
        message: 'Looks good',
        reviewedAt: new Date('2026-01-16'),
    };

    const mockRejectedApproval = {
        ...mockPendingUpdateApproval,
        status: ApprovalStatus.REJECTED,
        reviewedById: mockReviewerId,
        message: 'Too expensive',
        reviewedAt: new Date('2026-01-17'),
    };

    const mockTxExpenseApproval = {
        update: vi.fn(),
    };

    const mockTxExpense = {
        create: vi.fn(),
        update: vi.fn(),
    };

    const mockTx = {
        expenseApproval: mockTxExpenseApproval,
        expense: mockTxExpense,
    };

    const mockPrismaService = {
        expenseApproval: {
            findMany: vi.fn(),
            findFirst: vi.fn(),
            update: vi.fn(),
        },
        $transaction: vi.fn(),
    };

    const mockExpenseHelper = {
        requireMembership: vi.fn(),
    };

    const mockCacheService = {
        getOrSet: vi.fn((key, ttl, fetchFn) => fetchFn()),
        invalidateApprovals: vi.fn(),
        invalidateHousehold: vi.fn(),
        pendingApprovalsKey: vi.fn((householdId) => `cache:approvals:pending:${householdId}`),
        approvalHistoryKey: vi.fn((householdId, status) => `cache:approvals:history:${householdId}:${status ?? 'all'}`),
        summaryTTL: 120,
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ApprovalService,
                { provide: PrismaService, useValue: mockPrismaService },
                { provide: ExpenseHelperService, useValue: mockExpenseHelper },
                { provide: CacheService, useValue: mockCacheService },
            ],
        }).compile();

        service = module.get<ApprovalService>(ApprovalService);

        vi.clearAllMocks();
    });

    //#region listPendingApprovals
    describe('listPendingApprovals', () => {
        it('should return all pending approvals for the household', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expenseApproval.findMany.mockResolvedValue([mockPendingCreateApproval]);

            const result = await service.listPendingApprovals(mockUserId);

            expect(mockExpenseHelper.requireMembership).toHaveBeenCalledWith(mockUserId);
            expect(mockPrismaService.expenseApproval.findMany).toHaveBeenCalledWith({
                where: {
                    householdId: mockHouseholdId,
                    status: ApprovalStatus.PENDING,
                },
                orderBy: { createdAt: 'desc' },
            });
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe(mockApprovalId);
            expect(result[0].status).toBe(ApprovalStatus.PENDING);
        });

        it('should return empty array when no pending approvals exist', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expenseApproval.findMany.mockResolvedValue([]);

            const result = await service.listPendingApprovals(mockUserId);

            expect(result).toEqual([]);
        });

        it('should throw NotFoundException if user has no household', async () => {
            mockExpenseHelper.requireMembership.mockRejectedValue(new NotFoundException('You must be in a household to manage expenses'));

            await expect(service.listPendingApprovals(mockUserId)).rejects.toThrow(NotFoundException);
            await expect(service.listPendingApprovals(mockUserId)).rejects.toThrow('You must be in a household to manage expenses');
            expect(mockPrismaService.expenseApproval.findMany).not.toHaveBeenCalled();
        });

        it('should include reviewer fields in the response', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expenseApproval.findMany.mockResolvedValue([mockPendingCreateApproval]);

            const result = await service.listPendingApprovals(mockUserId);

            expect(result[0].reviewedById).toBeNull();
            expect(result[0].message).toBeNull();
            expect(result[0].reviewedAt).toBeNull();
        });
    });
    //#endregion

    //#region listApprovalHistory
    describe('listApprovalHistory', () => {
        it('should return all past approvals (accepted and rejected) when no filter', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expenseApproval.findMany.mockResolvedValue([mockAcceptedApproval, mockRejectedApproval]);

            const result = await service.listApprovalHistory(mockUserId, {});

            expect(mockPrismaService.expenseApproval.findMany).toHaveBeenCalledWith({
                where: {
                    householdId: mockHouseholdId,
                    status: { in: [ApprovalStatus.ACCEPTED, ApprovalStatus.REJECTED] },
                },
                orderBy: { createdAt: 'desc' },
            });
            expect(result).toHaveLength(2);
        });

        it('should filter by ACCEPTED status when provided', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expenseApproval.findMany.mockResolvedValue([mockAcceptedApproval]);

            const result = await service.listApprovalHistory(mockUserId, { status: ApprovalStatus.ACCEPTED });

            expect(mockPrismaService.expenseApproval.findMany).toHaveBeenCalledWith({
                where: {
                    householdId: mockHouseholdId,
                    status: ApprovalStatus.ACCEPTED,
                },
                orderBy: { createdAt: 'desc' },
            });
            expect(result).toHaveLength(1);
            expect(result[0].status).toBe(ApprovalStatus.ACCEPTED);
        });

        it('should filter by REJECTED status when provided', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expenseApproval.findMany.mockResolvedValue([mockRejectedApproval]);

            const result = await service.listApprovalHistory(mockUserId, { status: ApprovalStatus.REJECTED });

            expect(mockPrismaService.expenseApproval.findMany).toHaveBeenCalledWith({
                where: {
                    householdId: mockHouseholdId,
                    status: ApprovalStatus.REJECTED,
                },
                orderBy: { createdAt: 'desc' },
            });
            expect(result).toHaveLength(1);
            expect(result[0].status).toBe(ApprovalStatus.REJECTED);
        });

        it('should return empty array when no history exists', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expenseApproval.findMany.mockResolvedValue([]);

            const result = await service.listApprovalHistory(mockUserId, {});

            expect(result).toEqual([]);
        });

        it('should throw NotFoundException if user has no household', async () => {
            mockExpenseHelper.requireMembership.mockRejectedValue(new NotFoundException('You must be in a household to manage expenses'));

            await expect(service.listApprovalHistory(mockUserId, {})).rejects.toThrow(NotFoundException);
            await expect(service.listApprovalHistory(mockUserId, {})).rejects.toThrow('You must be in a household to manage expenses');
        });

        it('should include reviewer fields in history responses', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expenseApproval.findMany.mockResolvedValue([mockAcceptedApproval]);

            const result = await service.listApprovalHistory(mockUserId, {});

            expect(result[0].reviewedById).toBe(mockReviewerId);
            expect(result[0].message).toBe('Looks good');
            expect(result[0].reviewedAt).toEqual(new Date('2026-01-16'));
        });
    });
    //#endregion

    //#region acceptApproval
    describe('acceptApproval', () => {
        it('should accept a CREATE approval and create the expense', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockReviewerMembership);
            mockPrismaService.expenseApproval.findFirst.mockResolvedValue(mockPendingCreateApproval);
            const updatedApproval = {
                ...mockPendingCreateApproval,
                status: ApprovalStatus.ACCEPTED,
                reviewedById: mockReviewerId,
                message: 'Approved',
                reviewedAt: expect.any(Date),
            };
            mockTxExpenseApproval.update.mockResolvedValue(updatedApproval);
            mockTxExpense.create.mockResolvedValue({});
            mockPrismaService.$transaction.mockImplementation(async (cb) => cb(mockTx));

            const result = await service.acceptApproval(mockReviewerId, mockApprovalId, { message: 'Approved' });

            expect(mockPrismaService.expenseApproval.findFirst).toHaveBeenCalledWith({
                where: { id: mockApprovalId, householdId: mockHouseholdId },
            });
            expect(mockTxExpenseApproval.update).toHaveBeenCalledWith({
                where: { id: mockApprovalId },
                data: {
                    status: ApprovalStatus.ACCEPTED,
                    reviewedById: mockReviewerId,
                    message: 'Approved',
                    reviewedAt: expect.any(Date),
                },
            });
            expect(mockTxExpense.create).toHaveBeenCalledWith({
                data: {
                    householdId: mockHouseholdId,
                    createdById: mockUserId,
                    type: ExpenseType.SHARED,
                    name: 'Monthly Rent',
                    amount: 800,
                    category: ExpenseCategory.RECURRING,
                    frequency: ExpenseFrequency.MONTHLY,
                    paidByUserId: null,
                    yearlyPaymentStrategy: null,
                    installmentFrequency: null,
                    paymentMonth: null,
                    month: null,
                    year: null,
                },
            });
            expect(result.status).toBe(ApprovalStatus.ACCEPTED);
            expect(result.reviewedById).toBe(mockReviewerId);
        });

        it('should accept a CREATE approval without message', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockReviewerMembership);
            mockPrismaService.expenseApproval.findFirst.mockResolvedValue(mockPendingCreateApproval);
            const updatedApproval = {
                ...mockPendingCreateApproval,
                status: ApprovalStatus.ACCEPTED,
                reviewedById: mockReviewerId,
                message: null,
                reviewedAt: expect.any(Date),
            };
            mockTxExpenseApproval.update.mockResolvedValue(updatedApproval);
            mockTxExpense.create.mockResolvedValue({});
            mockPrismaService.$transaction.mockImplementation(async (cb) => cb(mockTx));

            const result = await service.acceptApproval(mockReviewerId, mockApprovalId, {});

            expect(mockTxExpenseApproval.update).toHaveBeenCalledWith({
                where: { id: mockApprovalId },
                data: expect.objectContaining({ message: null }),
            });
            expect(result.message).toBeNull();
        });

        it('should accept an UPDATE approval and update the expense', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockReviewerMembership);
            mockPrismaService.expenseApproval.findFirst.mockResolvedValue(mockPendingUpdateApproval);
            const updatedApproval = {
                ...mockPendingUpdateApproval,
                status: ApprovalStatus.ACCEPTED,
                reviewedById: mockReviewerId,
                message: null,
                reviewedAt: expect.any(Date),
            };
            mockTxExpenseApproval.update.mockResolvedValue(updatedApproval);
            mockTxExpense.update.mockResolvedValue({});
            mockPrismaService.$transaction.mockImplementation(async (cb) => cb(mockTx));

            const result = await service.acceptApproval(mockReviewerId, 'approval-002', {});

            expect(mockTxExpense.update).toHaveBeenCalledWith({
                where: { id: mockExpenseId },
                data: { name: 'Updated Rent', amount: 850 },
            });
            expect(result.status).toBe(ApprovalStatus.ACCEPTED);
        });

        it('should accept a DELETE approval and soft-delete the expense', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockReviewerMembership);
            mockPrismaService.expenseApproval.findFirst.mockResolvedValue(mockPendingDeleteApproval);
            const updatedApproval = {
                ...mockPendingDeleteApproval,
                status: ApprovalStatus.ACCEPTED,
                reviewedById: mockReviewerId,
                message: null,
                reviewedAt: expect.any(Date),
            };
            mockTxExpenseApproval.update.mockResolvedValue(updatedApproval);
            mockTxExpense.update.mockResolvedValue({});
            mockPrismaService.$transaction.mockImplementation(async (cb) => cb(mockTx));

            const result = await service.acceptApproval(mockReviewerId, 'approval-003', {});

            expect(mockTxExpense.update).toHaveBeenCalledWith({
                where: { id: mockExpenseId },
                data: { deletedAt: expect.any(Date) },
            });
            expect(result.status).toBe(ApprovalStatus.ACCEPTED);
        });

        it('should throw NotFoundException if user has no household', async () => {
            mockExpenseHelper.requireMembership.mockRejectedValue(new NotFoundException('You must be in a household to manage expenses'));

            await expect(service.acceptApproval(mockReviewerId, mockApprovalId, {})).rejects.toThrow(NotFoundException);
            await expect(service.acceptApproval(mockReviewerId, mockApprovalId, {})).rejects.toThrow('You must be in a household to manage expenses');
        });

        it('should throw NotFoundException if approval does not exist', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockReviewerMembership);
            mockPrismaService.expenseApproval.findFirst.mockResolvedValue(null);

            await expect(service.acceptApproval(mockReviewerId, 'nonexistent', {})).rejects.toThrow(NotFoundException);
            await expect(service.acceptApproval(mockReviewerId, 'nonexistent', {})).rejects.toThrow('Approval not found');
        });

        it('should throw NotFoundException if approval belongs to a different household', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockReviewerMembership);
            mockPrismaService.expenseApproval.findFirst.mockResolvedValue(null);

            await expect(service.acceptApproval(mockReviewerId, 'other-household-approval', {})).rejects.toThrow('Approval not found');
        });

        it('should throw ConflictException if approval is already accepted', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockReviewerMembership);
            mockPrismaService.expenseApproval.findFirst.mockResolvedValue(mockAcceptedApproval);

            await expect(service.acceptApproval(mockReviewerId, mockApprovalId, {})).rejects.toThrow(ConflictException);
            await expect(service.acceptApproval(mockReviewerId, mockApprovalId, {})).rejects.toThrow('This approval has already been reviewed');
        });

        it('should throw ConflictException if approval is already rejected', async () => {
            const rejectedApproval = { ...mockPendingCreateApproval, status: ApprovalStatus.REJECTED };
            mockExpenseHelper.requireMembership.mockResolvedValue(mockReviewerMembership);
            mockPrismaService.expenseApproval.findFirst.mockResolvedValue(rejectedApproval);

            await expect(service.acceptApproval(mockReviewerId, mockApprovalId, {})).rejects.toThrow(ConflictException);
            await expect(service.acceptApproval(mockReviewerId, mockApprovalId, {})).rejects.toThrow('This approval has already been reviewed');
        });

        it('should throw ForbiddenException if user tries to accept their own approval', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expenseApproval.findFirst.mockResolvedValue(mockPendingCreateApproval);

            await expect(service.acceptApproval(mockUserId, mockApprovalId, {})).rejects.toThrow(ForbiddenException);
            await expect(service.acceptApproval(mockUserId, mockApprovalId, {})).rejects.toThrow('You cannot review your own approval');
        });

        it('should not create expense when transaction fails', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockReviewerMembership);
            mockPrismaService.expenseApproval.findFirst.mockResolvedValue(mockPendingCreateApproval);
            mockPrismaService.$transaction.mockRejectedValue(new Error('Transaction failed'));

            await expect(service.acceptApproval(mockReviewerId, mockApprovalId, {})).rejects.toThrow('Transaction failed');
        });
    });
    //#endregion

    //#region rejectApproval
    describe('rejectApproval', () => {
        it('should reject a pending approval with a message', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockReviewerMembership);
            mockPrismaService.expenseApproval.findFirst.mockResolvedValue(mockPendingCreateApproval);
            const updatedApproval = {
                ...mockPendingCreateApproval,
                status: ApprovalStatus.REJECTED,
                reviewedById: mockReviewerId,
                message: 'Too expensive',
                reviewedAt: expect.any(Date),
            };
            mockPrismaService.expenseApproval.update.mockResolvedValue(updatedApproval);

            const result = await service.rejectApproval(mockReviewerId, mockApprovalId, { message: 'Too expensive' });

            expect(mockPrismaService.expenseApproval.update).toHaveBeenCalledWith({
                where: { id: mockApprovalId },
                data: {
                    status: ApprovalStatus.REJECTED,
                    reviewedById: mockReviewerId,
                    message: 'Too expensive',
                    reviewedAt: expect.any(Date),
                },
            });
            expect(result.status).toBe(ApprovalStatus.REJECTED);
            expect(result.reviewedById).toBe(mockReviewerId);
            expect(result.message).toBe('Too expensive');
        });

        it('should throw NotFoundException if user has no household', async () => {
            mockExpenseHelper.requireMembership.mockRejectedValue(new NotFoundException('You must be in a household to manage expenses'));

            await expect(service.rejectApproval(mockReviewerId, mockApprovalId, { message: 'No' })).rejects.toThrow(NotFoundException);
            await expect(service.rejectApproval(mockReviewerId, mockApprovalId, { message: 'No' })).rejects.toThrow(
                'You must be in a household to manage expenses',
            );
        });

        it('should throw NotFoundException if approval does not exist', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockReviewerMembership);
            mockPrismaService.expenseApproval.findFirst.mockResolvedValue(null);

            await expect(service.rejectApproval(mockReviewerId, 'nonexistent', { message: 'No' })).rejects.toThrow(NotFoundException);
            await expect(service.rejectApproval(mockReviewerId, 'nonexistent', { message: 'No' })).rejects.toThrow('Approval not found');
        });

        it('should throw ConflictException if approval is not pending', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockReviewerMembership);
            mockPrismaService.expenseApproval.findFirst.mockResolvedValue(mockAcceptedApproval);

            await expect(service.rejectApproval(mockReviewerId, mockApprovalId, { message: 'No' })).rejects.toThrow(ConflictException);
            await expect(service.rejectApproval(mockReviewerId, mockApprovalId, { message: 'No' })).rejects.toThrow('This approval has already been reviewed');
        });

        it('should throw ForbiddenException if user tries to reject their own approval', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expenseApproval.findFirst.mockResolvedValue(mockPendingCreateApproval);

            await expect(service.rejectApproval(mockUserId, mockApprovalId, { message: 'No' })).rejects.toThrow(ForbiddenException);
            await expect(service.rejectApproval(mockUserId, mockApprovalId, { message: 'No' })).rejects.toThrow('You cannot review your own approval');
        });

        it('should not modify any expense data on rejection', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockReviewerMembership);
            mockPrismaService.expenseApproval.findFirst.mockResolvedValue(mockPendingCreateApproval);
            const updatedApproval = {
                ...mockPendingCreateApproval,
                status: ApprovalStatus.REJECTED,
                reviewedById: mockReviewerId,
                message: 'Denied',
                reviewedAt: new Date(),
            };
            mockPrismaService.expenseApproval.update.mockResolvedValue(updatedApproval);

            await service.rejectApproval(mockReviewerId, mockApprovalId, { message: 'Denied' });

            expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
        });
    });
    //#endregion
});
