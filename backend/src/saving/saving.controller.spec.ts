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
        upsertPersonalSaving: vi.fn(() => Promise.resolve(mockPersonalSavingResponse)),
        getHouseholdSavings: vi.fn(() => Promise.resolve([mockPersonalSavingResponse])),
        upsertSharedSaving: vi.fn(() => Promise.resolve(mockSharedSavingResponse)),
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

            expect(service.getMySavings).toHaveBeenCalledWith(mockUserId);
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

    describe('upsertPersonalSaving', () => {
        it('should call service.upsertPersonalSaving with userId and dto', async () => {
            const dto = { amount: 200 };
            const result = await controller.upsertPersonalSaving(mockUserId, dto);

            expect(service.upsertPersonalSaving).toHaveBeenCalledWith(mockUserId, dto);
            expect(result.id).toBe('saving-001');
            expect(result.isShared).toBe(false);
        });
    });

    describe('getHouseholdSavings', () => {
        it('should call service.getHouseholdSavings with userId', async () => {
            const result = await controller.getHouseholdSavings(mockUserId);

            expect(service.getHouseholdSavings).toHaveBeenCalledWith(mockUserId);
            expect(result).toHaveLength(1);
        });

        it('should return empty array when no household savings exist', async () => {
            mockSavingService.getHouseholdSavings.mockResolvedValue([]);

            const result = await controller.getHouseholdSavings(mockUserId);

            expect(result).toEqual([]);
        });
    });

    describe('upsertSharedSaving', () => {
        it('should call service.upsertSharedSaving with userId and dto', async () => {
            const dto = { amount: 100 };
            const result = await controller.upsertSharedSaving(mockUserId, dto);

            expect(service.upsertSharedSaving).toHaveBeenCalledWith(mockUserId, dto);
            expect(result.id).toBe('saving-002');
            expect(result.isShared).toBe(true);
        });
    });
});
