import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ApprovalController } from './approval.controller';
import { ApprovalService } from './approval.service';
import { ApprovalResponseDto } from './dto/approval-response.dto';
import { ApprovalStatus } from '../generated/prisma/enums';

describe('ApprovalController', () => {
    let controller: ApprovalController;
    let service: ApprovalService;

    const mockUserId = 'user-123';
    const mockApprovalId = 'approval-001';

    const mockPendingApproval: ApprovalResponseDto = {
        id: mockApprovalId,
        expenseId: null,
        householdId: 'household-456',
        action: 'CREATE',
        status: 'PENDING',
        requestedById: 'user-other',
        reviewedById: null,
        message: null,
        proposedData: { name: 'Monthly Rent', amount: 800 },
        createdAt: new Date(),
        reviewedAt: null,
    };

    const mockAcceptedApproval: ApprovalResponseDto = {
        ...mockPendingApproval,
        status: 'ACCEPTED',
        reviewedById: mockUserId,
        message: 'Looks good',
        reviewedAt: new Date(),
    };

    const mockRejectedApproval: ApprovalResponseDto = {
        ...mockPendingApproval,
        status: 'REJECTED',
        reviewedById: mockUserId,
        message: 'Too expensive',
        reviewedAt: new Date(),
    };

    const mockapprovalService = {
        listPendingApprovals: vi.fn(() => Promise.resolve([mockPendingApproval])),
        listApprovalHistory: vi.fn(() => Promise.resolve([mockAcceptedApproval, mockRejectedApproval])),
        acceptApproval: vi.fn(() => Promise.resolve(mockAcceptedApproval)),
        rejectApproval: vi.fn(() => Promise.resolve(mockRejectedApproval)),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [ApprovalController],
            providers: [{ provide: ApprovalService, useValue: mockapprovalService }],
        }).compile();

        controller = module.get<ApprovalController>(ApprovalController);
        service = module.get<ApprovalService>(ApprovalService);

        vi.clearAllMocks();
    });

    describe('listPendingApprovals', () => {
        it('should call service.listPendingApprovals with userId', async () => {
            const result = await controller.listPendingApprovals(mockUserId);

            expect(service.listPendingApprovals).toHaveBeenCalledWith(mockUserId);
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe(mockApprovalId);
            expect(result[0].status).toBe('PENDING');
        });
    });

    describe('listApprovalHistory', () => {
        it('should call service.listApprovalHistory with userId and empty query', async () => {
            const result = await controller.listApprovalHistory(mockUserId, {});

            expect(service.listApprovalHistory).toHaveBeenCalledWith(mockUserId, {});
            expect(result).toHaveLength(2);
        });

        it('should pass status filter to service', async () => {
            const query = { status: ApprovalStatus.ACCEPTED };
            await controller.listApprovalHistory(mockUserId, query);

            expect(service.listApprovalHistory).toHaveBeenCalledWith(mockUserId, query);
        });
    });

    describe('acceptApproval', () => {
        it('should call service.acceptApproval with userId, approvalId and dto', async () => {
            const dto = { message: 'Looks good' };
            const result = await controller.acceptApproval(mockUserId, mockApprovalId, dto);

            expect(service.acceptApproval).toHaveBeenCalledWith(mockUserId, mockApprovalId, dto);
            expect(result.status).toBe('ACCEPTED');
            expect(result.reviewedById).toBe(mockUserId);
        });

        it('should call service.acceptApproval without message', async () => {
            await controller.acceptApproval(mockUserId, mockApprovalId, {});

            expect(service.acceptApproval).toHaveBeenCalledWith(mockUserId, mockApprovalId, {});
        });
    });

    describe('rejectApproval', () => {
        it('should call service.rejectApproval with userId, approvalId and dto', async () => {
            const dto = { message: 'Too expensive' };
            const result = await controller.rejectApproval(mockUserId, mockApprovalId, dto);

            expect(service.rejectApproval).toHaveBeenCalledWith(mockUserId, mockApprovalId, dto);
            expect(result.status).toBe('REJECTED');
            expect(result.message).toBe('Too expensive');
        });
    });
});
