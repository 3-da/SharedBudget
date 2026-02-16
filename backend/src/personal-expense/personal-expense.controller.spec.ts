import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { PersonalExpenseController } from './personal-expense.controller';
import { PersonalExpenseService } from './personal-expense.service';
import { ExpenseCategory, ExpenseFrequency } from '../generated/prisma/enums';
import { PersonalExpenseResponseDto } from './dto/personal-expense-response.dto';

describe('PersonalExpenseController', () => {
    let controller: PersonalExpenseController;
    let service: PersonalExpenseService;

    const mockUserId = 'user-123';
    const mockExpenseId = 'expense-001';

    const mockExpenseResponse: PersonalExpenseResponseDto = {
        id: mockExpenseId,
        householdId: 'household-456',
        createdById: mockUserId,
        name: 'Gym membership',
        amount: 49.99,
        category: 'RECURRING',
        frequency: 'MONTHLY',
        yearlyPaymentStrategy: null,
        installmentFrequency: null,
        installmentCount: null,
        paymentMonth: null,
        month: null,
        year: null,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    const mockMessageResponse = { message: 'Personal expense deleted successfully.' };

    const mockPersonalExpenseService = {
        listPersonalExpenses: vi.fn(() => Promise.resolve([mockExpenseResponse])),
        createPersonalExpense: vi.fn(() => Promise.resolve(mockExpenseResponse)),
        getPersonalExpense: vi.fn(() => Promise.resolve(mockExpenseResponse)),
        updatePersonalExpense: vi.fn(() => Promise.resolve(mockExpenseResponse)),
        deletePersonalExpense: vi.fn(() => Promise.resolve(mockMessageResponse)),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [PersonalExpenseController],
            providers: [{ provide: PersonalExpenseService, useValue: mockPersonalExpenseService }],
        }).compile();

        controller = module.get<PersonalExpenseController>(PersonalExpenseController);
        service = module.get<PersonalExpenseService>(PersonalExpenseService);

        vi.clearAllMocks();
    });

    describe('listPersonalExpenses', () => {
        it('should call service.listPersonalExpenses with userId and query', async () => {
            const query = { category: ExpenseCategory.RECURRING };
            const result = await controller.listPersonalExpenses(mockUserId, query);

            expect(service.listPersonalExpenses).toHaveBeenCalledWith(mockUserId, query);
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe(mockExpenseId);
        });

        it('should pass empty query when no filters provided', async () => {
            const result = await controller.listPersonalExpenses(mockUserId, {});

            expect(service.listPersonalExpenses).toHaveBeenCalledWith(mockUserId, {});
            expect(result).toHaveLength(1);
        });
    });

    describe('createPersonalExpense', () => {
        it('should call service.createPersonalExpense with userId and dto', async () => {
            const dto = {
                name: 'Gym membership',
                amount: 49.99,
                category: ExpenseCategory.RECURRING,
                frequency: ExpenseFrequency.MONTHLY,
            };
            const result = await controller.createPersonalExpense(mockUserId, dto);

            expect(service.createPersonalExpense).toHaveBeenCalledWith(mockUserId, dto);
            expect(result.id).toBe(mockExpenseId);
        });
    });

    describe('getPersonalExpense', () => {
        it('should call service.getPersonalExpense with userId and expenseId', async () => {
            const result = await controller.getPersonalExpense(mockUserId, mockExpenseId);

            expect(service.getPersonalExpense).toHaveBeenCalledWith(mockUserId, mockExpenseId);
            expect(result.name).toBe('Gym membership');
        });
    });

    describe('updatePersonalExpense', () => {
        it('should call service.updatePersonalExpense with userId, expenseId and dto', async () => {
            const dto = { name: 'Updated gym', amount: 54.99 };
            const result = await controller.updatePersonalExpense(mockUserId, mockExpenseId, dto);

            expect(service.updatePersonalExpense).toHaveBeenCalledWith(mockUserId, mockExpenseId, dto);
            expect(result.id).toBe(mockExpenseId);
        });
    });

    describe('deletePersonalExpense', () => {
        it('should call service.deletePersonalExpense with userId and expenseId', async () => {
            const result = await controller.deletePersonalExpense(mockUserId, mockExpenseId);

            expect(service.deletePersonalExpense).toHaveBeenCalledWith(mockUserId, mockExpenseId);
            expect(result.message).toBe('Personal expense deleted successfully.');
        });
    });
});
