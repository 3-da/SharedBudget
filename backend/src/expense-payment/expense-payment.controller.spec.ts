import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ExpensePaymentController } from './expense-payment.controller';
import { ExpensePaymentService } from './expense-payment.service';
import { PaymentStatus } from '../generated/prisma/enums';
import { ExpensePaymentResponseDto } from './dto/expense-payment-response.dto';

describe('ExpensePaymentController', () => {
    let controller: ExpensePaymentController;
    let service: ExpensePaymentService;

    const mockUserId = 'user-123';
    const mockExpenseId = 'expense-001';

    const mockPaymentResponse: ExpensePaymentResponseDto = {
        id: 'ps-001',
        expenseId: mockExpenseId,
        month: 6,
        year: 2026,
        status: PaymentStatus.PAID,
        paidAt: new Date('2026-06-15T10:30:00.000Z'),
        paidById: mockUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    const mockPendingResponse: ExpensePaymentResponseDto = {
        ...mockPaymentResponse,
        status: PaymentStatus.PENDING,
        paidAt: null,
    };

    const mockCancelledResponse: ExpensePaymentResponseDto = {
        ...mockPaymentResponse,
        status: PaymentStatus.CANCELLED,
        paidAt: null,
    };

    const mockExpensePaymentService = {
        markPaid: vi.fn(() => Promise.resolve(mockPaymentResponse)),
        undoPaid: vi.fn(() => Promise.resolve(mockPendingResponse)),
        cancel: vi.fn(() => Promise.resolve(mockCancelledResponse)),
        getPaymentStatuses: vi.fn(() => Promise.resolve([mockPaymentResponse])),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [ExpensePaymentController],
            providers: [{ provide: ExpensePaymentService, useValue: mockExpensePaymentService }],
        }).compile();

        controller = module.get<ExpensePaymentController>(ExpensePaymentController);
        service = module.get<ExpensePaymentService>(ExpensePaymentService);

        vi.clearAllMocks();
    });

    describe('markPaid', () => {
        it('should call service.markPaid with userId, expenseId and dto', async () => {
            const dto = { month: 6, year: 2026 };
            const result = await controller.markPaid(mockUserId, mockExpenseId, dto);

            expect(service.markPaid).toHaveBeenCalledWith(mockUserId, mockExpenseId, dto);
            expect(result.status).toBe(PaymentStatus.PAID);
            expect(result.id).toBe('ps-001');
        });
    });

    describe('undoPaid', () => {
        it('should call service.undoPaid with userId, expenseId and dto', async () => {
            const dto = { month: 6, year: 2026 };
            const result = await controller.undoPaid(mockUserId, mockExpenseId, dto);

            expect(service.undoPaid).toHaveBeenCalledWith(mockUserId, mockExpenseId, dto);
            expect(result.status).toBe(PaymentStatus.PENDING);
            expect(result.paidAt).toBeNull();
        });
    });

    describe('cancelExpense', () => {
        it('should call service.cancel with userId, expenseId and dto', async () => {
            const dto = { month: 8, year: 2026 };
            const result = await controller.cancelExpense(mockUserId, mockExpenseId, dto);

            expect(service.cancel).toHaveBeenCalledWith(mockUserId, mockExpenseId, dto);
            expect(result.status).toBe(PaymentStatus.CANCELLED);
        });
    });

    describe('getPaymentStatus', () => {
        it('should call service.getPaymentStatuses with userId and expenseId', async () => {
            const result = await controller.getPaymentStatus(mockUserId, mockExpenseId);

            expect(service.getPaymentStatuses).toHaveBeenCalledWith(mockUserId, mockExpenseId);
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('ps-001');
        });

        it('should return empty array when no statuses exist', async () => {
            mockExpensePaymentService.getPaymentStatuses.mockResolvedValue([]);

            const result = await controller.getPaymentStatus(mockUserId, mockExpenseId);

            expect(result).toEqual([]);
        });
    });
});
