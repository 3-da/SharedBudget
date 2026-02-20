import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { SavingController } from './saving.controller';
import { SavingService } from './saving.service';
import { SavingResponseDto } from './dto/saving-response.dto';

describe('SavingController', () => {
    let controller: SavingController;
    let service: SavingService;

    const mockUserId = 'user-123';

    const mockPersonalSavingResponse: SavingResponseDto = {
        id: 'saving-001',
        userId: mockUserId,
        householdId: 'household-456',
        amount: 200,
        month: 6,
        year: 2026,
        isShared: false,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    const mockSharedSavingResponse: SavingResponseDto = {
        ...mockPersonalSavingResponse,
        id: 'saving-002',
        amount: 100,
        isShared: true,
    };

    const mockSavingService = {
        getMySavings: vi.fn(() => Promise.resolve([mockPersonalSavingResponse, mockSharedSavingResponse])),
        addPersonalSaving: vi.fn(() => Promise.resolve(mockPersonalSavingResponse)),
        withdrawPersonalSaving: vi.fn(() => Promise.resolve(mockPersonalSavingResponse)),
        getHouseholdSavings: vi.fn(() => Promise.resolve([mockPersonalSavingResponse])),
        addSharedSaving: vi.fn(() => Promise.resolve(mockSharedSavingResponse)),
        requestSharedWithdrawal: vi.fn(() => Promise.resolve({ approvalId: 'approval-001', message: 'Withdrawal request submitted for approval' })),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [SavingController],
            providers: [{ provide: SavingService, useValue: mockSavingService }],
        }).compile();

        controller = module.get<SavingController>(SavingController);
        service = module.get<SavingService>(SavingService);

        vi.clearAllMocks();
    });

    describe('getMySavings', () => {
        it('should call service.getMySavings with userId', async () => {
            const result = await controller.getMySavings(mockUserId);

            expect(service.getMySavings).toHaveBeenCalledWith(mockUserId, undefined, undefined);
            expect(result).toHaveLength(2);
            expect(result[0].isShared).toBe(false);
            expect(result[1].isShared).toBe(true);
        });

        it('should return empty array when no savings exist', async () => {
            mockSavingService.getMySavings.mockResolvedValue([]);

            const result = await controller.getMySavings(mockUserId);

            expect(result).toEqual([]);
        });
    });

    describe('addPersonalSaving', () => {
        it('should call service.addPersonalSaving with userId and dto', async () => {
            const dto = { amount: 50 };
            const result = await controller.addPersonalSaving(mockUserId, dto);

            expect(service.addPersonalSaving).toHaveBeenCalledWith(mockUserId, dto);
            expect(result.id).toBe('saving-001');
            expect(result.isShared).toBe(false);
        });
    });

    describe('withdrawPersonalSaving', () => {
        it('should call service.withdrawPersonalSaving with userId and dto', async () => {
            const dto = { amount: 50 };
            const result = await controller.withdrawPersonalSaving(mockUserId, dto);

            expect(service.withdrawPersonalSaving).toHaveBeenCalledWith(mockUserId, dto);
            expect(result.id).toBe('saving-001');
        });
    });

    describe('getHouseholdSavings', () => {
        it('should call service.getHouseholdSavings with userId', async () => {
            const result = await controller.getHouseholdSavings(mockUserId);

            expect(service.getHouseholdSavings).toHaveBeenCalledWith(mockUserId, undefined, undefined);
            expect(result).toHaveLength(1);
        });

        it('should return empty array when no household savings exist', async () => {
            mockSavingService.getHouseholdSavings.mockResolvedValue([]);

            const result = await controller.getHouseholdSavings(mockUserId);

            expect(result).toEqual([]);
        });
    });

    describe('addSharedSaving', () => {
        it('should call service.addSharedSaving with userId and dto', async () => {
            const dto = { amount: 50 };
            const result = await controller.addSharedSaving(mockUserId, dto);

            expect(service.addSharedSaving).toHaveBeenCalledWith(mockUserId, dto);
            expect(result.id).toBe('saving-002');
            expect(result.isShared).toBe(true);
        });
    });

    describe('requestSharedWithdrawal', () => {
        it('should call service.requestSharedWithdrawal with userId and dto', async () => {
            const dto = { amount: 50 };
            const result = await controller.requestSharedWithdrawal(mockUserId, dto);

            expect(service.requestSharedWithdrawal).toHaveBeenCalledWith(mockUserId, dto);
            expect(result.approvalId).toBe('approval-001');
            expect(result.message).toBe('Withdrawal request submitted for approval');
        });
    });
});
