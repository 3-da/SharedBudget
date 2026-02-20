import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ApprovalService } from './approval.service';
import { PrismaService } from '../prisma/prisma.service';
import { ExpenseHelperService } from '../common/expense/expense-helper.service';
import { CacheService } from '../common/cache/cache.service';
import { SavingService } from '../saving/saving.service';
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

    const mockRequestedByUser = {
        id: mockUserId,
        firstName: 'Sam',
        lastName: 'Smith',
    };

    const mockReviewerUser = {
        id: mockReviewerId,
        firstName: 'Alex',
        lastName: 'Jones',
    };

    const mockPendingCreateApproval = {
        id: mockApprovalId,
        expenseId: null,
        householdId: mockHouseholdId,
        action: ApprovalAction.CREATE,
        status: ApprovalStatus.PENDING,
        requestedById: mockUserId,
        requestedBy: mockRequestedByUser,
        reviewedById: null,
        reviewedBy: null,
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

    const mockPendingUpdateApproval = {
        id: 'approval-002',
        expenseId: mockExpenseId,
        householdId: mockHouseholdId,
        action: ApprovalAction.UPDATE,
        status: ApprovalStatus.PENDING,
        requestedById: mockUserId,
        requestedBy: mockRequestedByUser,
        reviewedById: null,
        reviewedBy: null,
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
        requestedBy: mockRequestedByUser,
        reviewedById: null,
        reviewedBy: null,
        message: null,
        proposedData: null,
        createdAt: new Date('2026-01-17'),
        reviewedAt: null,
    };

    const mockAcceptedApproval = {
        ...mockPendingCreateApproval,
        status: ApprovalStatus.ACCEPTED,
        reviewedById: mockReviewerId,
        reviewedBy: mockReviewerUser,
        message: 'Looks good',
        reviewedAt: new Date('2026-01-16'),
    };

    const mockRejectedApproval = {
        ...mockPendingUpdateApproval,
        status: ApprovalStatus.REJECTED,
        reviewedById: mockReviewerId,
        reviewedBy: mockReviewerUser,
        message: 'Too expensive',
        reviewedAt: new Date('2026-01-17'),
    };

    const mockTxExpenseApproval = {
        update: vi.fn(),
        updateMany: vi.fn(),
        findUniqueOrThrow: vi.fn(),
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
            updateMany: vi.fn(),
            findUniqueOrThrow: vi.fn(),
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

    const mockSavingService = {
        executeSharedWithdrawal: vi.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ApprovalService,
                { provide: PrismaService, useValue: mockPrismaService },
                { provide: ExpenseHelperService, useValue: mockExpenseHelper },
                { provide: CacheService, useValue: mockCacheService },
                { provide: SavingService, useValue: mockSavingService },
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
                include: {
                    requestedBy: { select: { id: true, firstName: true, lastName: true } },
                    reviewedBy: { select: { id: true, firstName: true, lastName: true } },
                },
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
                    status: { in: [ApprovalStatus.ACCEPTED, ApprovalStatus.REJECTED, ApprovalStatus.CANCELLED] },
                },
                orderBy: { createdAt: 'desc' },
                include: {
                    requestedBy: { select: { id: true, firstName: true, lastName: true } },
                    reviewedBy: { select: { id: true, firstName: true, lastName: true } },
                },
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
                include: {
                    requestedBy: { select: { id: true, firstName: true, lastName: true } },
                    reviewedBy: { select: { id: true, firstName: true, lastName: true } },
                },
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
                include: {
                    requestedBy: { select: { id: true, firstName: true, lastName: true } },
                    reviewedBy: { select: { id: true, firstName: true, lastName: true } },
                },
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
            mockTxExpenseApproval.updateMany.mockResolvedValue({ count: 1 });
            mockTxExpenseApproval.findUniqueOrThrow.mockResolvedValue(updatedApproval);
            mockTxExpense.create.mockResolvedValue({});
            mockPrismaService.$transaction.mockImplementation(async (cb) => cb(mockTx));

            const result = await service.acceptApproval(mockReviewerId, mockApprovalId, { message: 'Approved' });

            expect(mockPrismaService.expenseApproval.findFirst).toHaveBeenCalledWith({
                where: { id: mockApprovalId, householdId: mockHouseholdId },
            });
            expect(mockTxExpenseApproval.updateMany).toHaveBeenCalledWith({
                where: { id: mockApprovalId, status: ApprovalStatus.PENDING },
                data: {
                    status: ApprovalStatus.ACCEPTED,
                    reviewedById: mockReviewerId,
                    message: 'Approved',
                    reviewedAt: expect.any(Date),
                },
            });
            expect(mockTxExpenseApproval.findUniqueOrThrow).toHaveBeenCalledWith({
                where: { id: mockApprovalId },
                include: {
                    requestedBy: { select: { id: true, firstName: true, lastName: true } },
                    reviewedBy: { select: { id: true, firstName: true, lastName: true } },
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
                    installmentCount: null,
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
            mockTxExpenseApproval.updateMany.mockResolvedValue({ count: 1 });
            mockTxExpenseApproval.findUniqueOrThrow.mockResolvedValue(updatedApproval);
            mockTxExpense.create.mockResolvedValue({});
            mockPrismaService.$transaction.mockImplementation(async (cb) => cb(mockTx));

            const result = await service.acceptApproval(mockReviewerId, mockApprovalId, {});

            expect(mockTxExpenseApproval.updateMany).toHaveBeenCalledWith({
                where: { id: mockApprovalId, status: ApprovalStatus.PENDING },
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
            mockTxExpenseApproval.updateMany.mockResolvedValue({ count: 1 });
            mockTxExpenseApproval.findUniqueOrThrow.mockResolvedValue(updatedApproval);
            mockTxExpense.update.mockResolvedValue({});
            mockPrismaService.$transaction.mockImplementation(async (cb) => cb(mockTx));

            const result = await service.acceptApproval(mockReviewerId, 'approval-002', {});

            expect(mockTxExpense.update).toHaveBeenCalledWith({
                where: { id: mockExpenseId },
                data: expect.objectContaining({ name: 'Updated Rent', amount: 850 }),
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
            mockTxExpenseApproval.updateMany.mockResolvedValue({ count: 1 });
            mockTxExpenseApproval.findUniqueOrThrow.mockResolvedValue(updatedApproval);
            mockTxExpense.update.mockResolvedValue({});
            mockPrismaService.$transaction.mockImplementation(async (cb) => cb(mockTx));

            const result = await service.acceptApproval(mockReviewerId, 'approval-003', {});

            expect(mockTxExpense.update).toHaveBeenCalledWith({
                where: { id: mockExpenseId },
                data: { deletedAt: expect.any(Date) },
            });
            expect(result.status).toBe(ApprovalStatus.ACCEPTED);
        });

        it('should accept a WITHDRAW_SAVINGS approval and execute the withdrawal', async () => {
            const withdrawApproval = {
                id: 'approval-004',
                expenseId: null,
                householdId: mockHouseholdId,
                action: ApprovalAction.WITHDRAW_SAVINGS,
                status: ApprovalStatus.PENDING,
                requestedById: mockUserId,
                requestedBy: mockRequestedByUser,
                reviewedById: null,
                reviewedBy: null,
                message: null,
                proposedData: { amount: 50, month: 6, year: 2026 },
                createdAt: new Date('2026-01-18'),
                reviewedAt: null,
            };
            mockExpenseHelper.requireMembership.mockResolvedValue(mockReviewerMembership);
            mockPrismaService.expenseApproval.findFirst.mockResolvedValue(withdrawApproval);
            const updatedApproval = {
                ...withdrawApproval,
                status: ApprovalStatus.ACCEPTED,
                reviewedById: mockReviewerId,
                reviewedBy: mockReviewerUser,
                message: null,
                reviewedAt: expect.any(Date),
            };
            mockTxExpenseApproval.updateMany.mockResolvedValue({ count: 1 });
            mockTxExpenseApproval.findUniqueOrThrow.mockResolvedValue(updatedApproval);
            mockSavingService.executeSharedWithdrawal.mockResolvedValue(undefined);
            mockPrismaService.$transaction.mockImplementation(async (cb) => cb(mockTx));

            const result = await service.acceptApproval(mockReviewerId, 'approval-004', {});

            expect(mockSavingService.executeSharedWithdrawal).toHaveBeenCalledWith(
                mockUserId,
                mockHouseholdId,
                50,
                6,
                2026,
                mockTx,
            );
            expect(result.status).toBe(ApprovalStatus.ACCEPTED);
            expect(mockCacheService.invalidateHousehold).toHaveBeenCalledWith(mockHouseholdId);
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
            mockTxExpenseApproval.updateMany.mockResolvedValue({ count: 0 });
            mockPrismaService.$transaction.mockImplementation(async (cb) => cb(mockTx));

            await expect(service.acceptApproval(mockReviewerId, mockApprovalId, {})).rejects.toThrow(ConflictException);
            await expect(service.acceptApproval(mockReviewerId, mockApprovalId, {})).rejects.toThrow('This approval has already been reviewed or cancelled');
        });

        it('should throw ConflictException if approval is already rejected', async () => {
            const rejectedApproval = { ...mockPendingCreateApproval, status: ApprovalStatus.REJECTED };
            mockExpenseHelper.requireMembership.mockResolvedValue(mockReviewerMembership);
            mockPrismaService.expenseApproval.findFirst.mockResolvedValue(rejectedApproval);
            mockTxExpenseApproval.updateMany.mockResolvedValue({ count: 0 });
            mockPrismaService.$transaction.mockImplementation(async (cb) => cb(mockTx));

            await expect(service.acceptApproval(mockReviewerId, mockApprovalId, {})).rejects.toThrow(ConflictException);
            await expect(service.acceptApproval(mockReviewerId, mockApprovalId, {})).rejects.toThrow('This approval has already been reviewed or cancelled');
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

        it('should throw ConflictException on concurrent acceptance (TOCTOU prevention)', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockReviewerMembership);
            // Approval appears pending when fetched, but another request accepted it before our updateMany
            mockPrismaService.expenseApproval.findFirst.mockResolvedValue(mockPendingCreateApproval);
            mockTxExpenseApproval.updateMany.mockResolvedValue({ count: 0 });
            mockPrismaService.$transaction.mockImplementation(async (cb) => cb(mockTx));

            await expect(service.acceptApproval(mockReviewerId, mockApprovalId, {})).rejects.toThrow(ConflictException);
            await expect(service.acceptApproval(mockReviewerId, mockApprovalId, {})).rejects.toThrow('This approval has already been reviewed or cancelled');
            expect(mockTxExpense.create).not.toHaveBeenCalled();
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
            mockPrismaService.expenseApproval.updateMany.mockResolvedValue({ count: 1 });
            mockPrismaService.expenseApproval.findUniqueOrThrow.mockResolvedValue(updatedApproval);

            const result = await service.rejectApproval(mockReviewerId, mockApprovalId, { message: 'Too expensive' });

            expect(mockPrismaService.expenseApproval.updateMany).toHaveBeenCalledWith({
                where: { id: mockApprovalId, status: ApprovalStatus.PENDING },
                data: {
                    status: ApprovalStatus.REJECTED,
                    reviewedById: mockReviewerId,
                    message: 'Too expensive',
                    reviewedAt: expect.any(Date),
                },
            });
            expect(mockPrismaService.expenseApproval.findUniqueOrThrow).toHaveBeenCalledWith({
                where: { id: mockApprovalId },
                include: {
                    requestedBy: { select: { id: true, firstName: true, lastName: true } },
                    reviewedBy: { select: { id: true, firstName: true, lastName: true } },
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
            mockPrismaService.expenseApproval.updateMany.mockResolvedValue({ count: 0 });

            await expect(service.rejectApproval(mockReviewerId, mockApprovalId, { message: 'No' })).rejects.toThrow(ConflictException);
            await expect(service.rejectApproval(mockReviewerId, mockApprovalId, { message: 'No' })).rejects.toThrow(
                'This approval has already been reviewed or cancelled',
            );
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
            mockPrismaService.expenseApproval.updateMany.mockResolvedValue({ count: 1 });
            mockPrismaService.expenseApproval.findUniqueOrThrow.mockResolvedValue(updatedApproval);

            await service.rejectApproval(mockReviewerId, mockApprovalId, { message: 'Denied' });

            expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
        });
    });
    //#endregion

    //#region cancelApproval
    describe('cancelApproval', () => {
        it('should cancel a pending approval by the original requester', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expenseApproval.findFirst.mockResolvedValue(mockPendingCreateApproval);
            const updatedApproval = {
                ...mockPendingCreateApproval,
                status: ApprovalStatus.CANCELLED,
                reviewedById: mockUserId,
                reviewedBy: mockRequestedByUser,
                message: 'Cancelled by requester',
                reviewedAt: expect.any(Date),
            };
            mockPrismaService.expenseApproval.updateMany.mockResolvedValue({ count: 1 });
            mockPrismaService.expenseApproval.findUniqueOrThrow.mockResolvedValue(updatedApproval);

            const result = await service.cancelApproval(mockUserId, mockApprovalId);

            expect(mockExpenseHelper.requireMembership).toHaveBeenCalledWith(mockUserId);
            expect(mockPrismaService.expenseApproval.findFirst).toHaveBeenCalledWith({
                where: { id: mockApprovalId, householdId: mockHouseholdId },
            });
            expect(mockPrismaService.expenseApproval.updateMany).toHaveBeenCalledWith({
                where: { id: mockApprovalId, status: ApprovalStatus.PENDING },
                data: {
                    status: ApprovalStatus.CANCELLED,
                    reviewedById: mockUserId,
                    message: 'Cancelled by requester',
                    reviewedAt: expect.any(Date),
                },
            });
            expect(mockPrismaService.expenseApproval.findUniqueOrThrow).toHaveBeenCalledWith({
                where: { id: mockApprovalId },
                include: {
                    requestedBy: { select: { id: true, firstName: true, lastName: true } },
                    reviewedBy: { select: { id: true, firstName: true, lastName: true } },
                },
            });
            expect(result.status).toBe(ApprovalStatus.CANCELLED);
            expect(result.reviewedById).toBe(mockUserId);
            expect(result.message).toBe('Cancelled by requester');
        });

        it('should invalidate approval caches after cancellation', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expenseApproval.findFirst.mockResolvedValue(mockPendingCreateApproval);
            const updatedApproval = {
                ...mockPendingCreateApproval,
                status: ApprovalStatus.CANCELLED,
                reviewedById: mockUserId,
                reviewedBy: mockRequestedByUser,
                message: 'Cancelled by requester',
                reviewedAt: new Date(),
            };
            mockPrismaService.expenseApproval.updateMany.mockResolvedValue({ count: 1 });
            mockPrismaService.expenseApproval.findUniqueOrThrow.mockResolvedValue(updatedApproval);

            await service.cancelApproval(mockUserId, mockApprovalId);

            expect(mockCacheService.invalidateApprovals).toHaveBeenCalledWith(mockHouseholdId);
            expect(mockCacheService.invalidateHousehold).not.toHaveBeenCalled();
        });

        it('should not use a transaction (no expense changes)', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expenseApproval.findFirst.mockResolvedValue(mockPendingCreateApproval);
            const updatedApproval = {
                ...mockPendingCreateApproval,
                status: ApprovalStatus.CANCELLED,
                reviewedById: mockUserId,
                reviewedBy: mockRequestedByUser,
                message: 'Cancelled by requester',
                reviewedAt: new Date(),
            };
            mockPrismaService.expenseApproval.updateMany.mockResolvedValue({ count: 1 });
            mockPrismaService.expenseApproval.findUniqueOrThrow.mockResolvedValue(updatedApproval);

            await service.cancelApproval(mockUserId, mockApprovalId);

            expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
        });

        it('should throw NotFoundException if user has no household', async () => {
            mockExpenseHelper.requireMembership.mockRejectedValue(new NotFoundException('You must be in a household to manage expenses'));

            await expect(service.cancelApproval(mockUserId, mockApprovalId)).rejects.toThrow(NotFoundException);
            await expect(service.cancelApproval(mockUserId, mockApprovalId)).rejects.toThrow('You must be in a household to manage expenses');
        });

        it('should throw NotFoundException if approval does not exist', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expenseApproval.findFirst.mockResolvedValue(null);

            await expect(service.cancelApproval(mockUserId, 'nonexistent')).rejects.toThrow(NotFoundException);
            await expect(service.cancelApproval(mockUserId, 'nonexistent')).rejects.toThrow('Approval not found');
        });

        it('should throw ConflictException if approval is already accepted', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expenseApproval.findFirst.mockResolvedValue(mockAcceptedApproval);
            mockPrismaService.expenseApproval.updateMany.mockResolvedValue({ count: 0 });

            await expect(service.cancelApproval(mockUserId, mockApprovalId)).rejects.toThrow(ConflictException);
            await expect(service.cancelApproval(mockUserId, mockApprovalId)).rejects.toThrow('This approval has already been reviewed or cancelled');
        });

        it('should throw ConflictException if approval is already rejected', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expenseApproval.findFirst.mockResolvedValue(mockRejectedApproval);
            mockPrismaService.expenseApproval.updateMany.mockResolvedValue({ count: 0 });

            await expect(service.cancelApproval(mockUserId, mockApprovalId)).rejects.toThrow(ConflictException);
            await expect(service.cancelApproval(mockUserId, mockApprovalId)).rejects.toThrow('This approval has already been reviewed or cancelled');
        });

        it('should throw ForbiddenException if user is not the original requester', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockReviewerMembership);
            mockPrismaService.expenseApproval.findFirst.mockResolvedValue(mockPendingCreateApproval);

            await expect(service.cancelApproval(mockReviewerId, mockApprovalId)).rejects.toThrow(ForbiddenException);
            await expect(service.cancelApproval(mockReviewerId, mockApprovalId)).rejects.toThrow('Only the requester can cancel their own approval');
        });
    });
    //#endregion
});
