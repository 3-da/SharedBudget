import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { RecurringOverrideController } from './recurring-override.controller';
import { RecurringOverrideService } from './recurring-override.service';
import { RecurringOverrideResponseDto } from './dto/recurring-override-response.dto';

describe('RecurringOverrideController', () => {
    let controller: RecurringOverrideController;
    let service: RecurringOverrideService;

    const mockUserId = 'user-123';
    const mockExpenseId = 'expense-001';

    const mockOverrideResponse: RecurringOverrideResponseDto = {
        id: 'override-001',
        expenseId: mockExpenseId,
        month: 7,
        year: 2026,
        amount: 55.0,
        skipped: false,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    const mockRecurringOverrideService = {
        upsertOverride: vi.fn(() => Promise.resolve(mockOverrideResponse)),
        updateDefaultAmount: vi.fn(() => Promise.resolve({ message: 'Default amount updated successfully' })),
        listOverrides: vi.fn(() => Promise.resolve([mockOverrideResponse])),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [RecurringOverrideController],
            providers: [{ provide: RecurringOverrideService, useValue: mockRecurringOverrideService }],
        }).compile();

        controller = module.get<RecurringOverrideController>(RecurringOverrideController);
        service = module.get<RecurringOverrideService>(RecurringOverrideService);

        vi.clearAllMocks();
    });

    describe('upsertOverride', () => {
        it('should call service.upsertOverride with all parameters', async () => {
            const dto = { amount: 55.0 };
            const result = await controller.upsertOverride(mockUserId, mockExpenseId, 2026, 7, dto);

            expect(service.upsertOverride).toHaveBeenCalledWith(mockUserId, mockExpenseId, 2026, 7, dto);
            expect(result.id).toBe('override-001');
            expect(result.amount).toBe(55.0);
        });
    });

    describe('updateDefaultAmount', () => {
        it('should call service.updateDefaultAmount with userId, expenseId and dto', async () => {
            const dto = { amount: 520.0 };
            const result = await controller.updateDefaultAmount(mockUserId, mockExpenseId, dto);

            expect(service.updateDefaultAmount).toHaveBeenCalledWith(mockUserId, mockExpenseId, dto);
            expect(result).toEqual({ message: 'Default amount updated successfully' });
        });
    });

    describe('listOverrides', () => {
        it('should call service.listOverrides with userId and expenseId', async () => {
            const result = await controller.listOverrides(mockUserId, mockExpenseId);

            expect(service.listOverrides).toHaveBeenCalledWith(mockUserId, mockExpenseId);
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('override-001');
        });

        it('should return empty array when no overrides exist', async () => {
            mockRecurringOverrideService.listOverrides.mockResolvedValue([]);

            const result = await controller.listOverrides(mockUserId, mockExpenseId);

            expect(result).toEqual([]);
        });
    });
});
