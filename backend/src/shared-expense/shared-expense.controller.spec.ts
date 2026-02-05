import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { SharedExpenseController } from './shared-expense.controller';
import { SharedExpenseService } from './shared-expense.service';
import { ExpenseCategory, ExpenseFrequency } from '../generated/prisma/enums';
import { SharedExpenseResponseDto } from './dto/shared-expense-response.dto';
import { ApprovalResponseDto } from '../approval/dto/approval-response.dto';

describe('SharedExpenseController', () => {
    let controller: SharedExpenseController;
    let service: SharedExpenseService;

    const mockUserId = 'user-123';
    const mockExpenseId = 'expense-001';

    const mockExpenseResponse: SharedExpenseResponseDto = {
        id: mockExpenseId,
        householdId: 'household-456',
        createdById: mockUserId,
        paidByUserId: null,
        name: 'Monthly Rent',
        amount: 800,
        category: 'RECURRING',
        frequency: 'MONTHLY',
        yearlyPaymentStrategy: null,
        installmentFrequency: null,
        paymentMonth: null,
        month: null,
        year: null,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    const mockApprovalResponse: ApprovalResponseDto = {
        id: 'approval-001',
        expenseId: null,
        householdId: 'household-456',
        action: 'CREATE',
        status: 'PENDING',
        requestedById: mockUserId,
        reviewedById: null,
        message: null,
        proposedData: { name: 'Monthly Rent', amount: 800 },
        createdAt: new Date(),
        reviewedAt: null,
    };

    const mockSharedExpenseService = {
        listSharedExpenses: vi.fn(() => Promise.resolve([mockExpenseResponse])),
        getSharedExpense: vi.fn(() => Promise.resolve(mockExpenseResponse)),
        proposeCreateSharedExpense: vi.fn(() => Promise.resolve(mockApprovalResponse)),
        proposeUpdateSharedExpense: vi.fn(() => Promise.resolve({ ...mockApprovalResponse, action: 'UPDATE', expenseId: mockExpenseId })),
        proposeDeleteSharedExpense: vi.fn(() => Promise.resolve({ ...mockApprovalResponse, action: 'DELETE', expenseId: mockExpenseId, proposedData: null })),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [SharedExpenseController],
            providers: [{ provide: SharedExpenseService, useValue: mockSharedExpenseService }],
        }).compile();

        controller = module.get<SharedExpenseController>(SharedExpenseController);
        service = module.get<SharedExpenseService>(SharedExpenseService);

        vi.clearAllMocks();
    });

    describe('listSharedExpenses', () => {
        it('should call service.listSharedExpenses with userId and query', async () => {
            const query = { category: ExpenseCategory.RECURRING };
            const result = await controller.listSharedExpenses(mockUserId, query);

            expect(service.listSharedExpenses).toHaveBeenCalledWith(mockUserId, query);
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe(mockExpenseId);
        });

        it('should pass empty query when no filters provided', async () => {
            const result = await controller.listSharedExpenses(mockUserId, {});

            expect(service.listSharedExpenses).toHaveBeenCalledWith(mockUserId, {});
            expect(result).toHaveLength(1);
        });
    });

    describe('getSharedExpense', () => {
        it('should call service.getSharedExpense with userId and expenseId', async () => {
            const result = await controller.getSharedExpense(mockUserId, mockExpenseId);

            expect(service.getSharedExpense).toHaveBeenCalledWith(mockUserId, mockExpenseId);
            expect(result.name).toBe('Monthly Rent');
        });
    });

    describe('proposeCreateSharedExpense', () => {
        it('should call service.proposeCreateSharedExpense with userId and dto', async () => {
            const dto = {
                name: 'Monthly Rent',
                amount: 800,
                category: ExpenseCategory.RECURRING,
                frequency: ExpenseFrequency.MONTHLY,
            };
            const result = await controller.proposeCreateSharedExpense(mockUserId, dto);

            expect(service.proposeCreateSharedExpense).toHaveBeenCalledWith(mockUserId, dto);
            expect(result.id).toBe('approval-001');
            expect(result.action).toBe('CREATE');
        });
    });

    describe('proposeUpdateSharedExpense', () => {
        it('should call service.proposeUpdateSharedExpense with userId, expenseId and dto', async () => {
            const dto = { name: 'Updated Rent', amount: 850 };
            const result = await controller.proposeUpdateSharedExpense(mockUserId, mockExpenseId, dto);

            expect(service.proposeUpdateSharedExpense).toHaveBeenCalledWith(mockUserId, mockExpenseId, dto);
            expect(result.action).toBe('UPDATE');
        });
    });

    describe('proposeDeleteSharedExpense', () => {
        it('should call service.proposeDeleteSharedExpense with userId and expenseId', async () => {
            const result = await controller.proposeDeleteSharedExpense(mockUserId, mockExpenseId);

            expect(service.proposeDeleteSharedExpense).toHaveBeenCalledWith(mockUserId, mockExpenseId);
            expect(result.action).toBe('DELETE');
            expect(result.proposedData).toBeNull();
        });
    });
});
