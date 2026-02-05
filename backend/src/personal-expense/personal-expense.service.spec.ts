import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PersonalExpenseService } from './personal-expense.service';
import { PrismaService } from '../prisma/prisma.service';
import { ExpenseHelperService } from '../common/expense/expense-helper.service';
import { CacheService } from '../common/cache/cache.service';
import { ExpenseCategory, ExpenseFrequency, ExpenseType, InstallmentFrequency, YearlyPaymentStrategy } from '../generated/prisma/enums';

describe('PersonalExpenseService', () => {
    let service: PersonalExpenseService;

    const mockUserId = 'user-123';
    const mockOtherUserId = 'user-789';
    const mockHouseholdId = 'household-456';
    const mockExpenseId = 'expense-001';

    const mockMembership = {
        userId: mockUserId,
        householdId: mockHouseholdId,
        role: 'OWNER',
    };

    const mockExpenseRecord = {
        id: mockExpenseId,
        householdId: mockHouseholdId,
        createdById: mockUserId,
        name: 'Gym membership',
        amount: 49.99,
        type: ExpenseType.PERSONAL,
        category: ExpenseCategory.RECURRING,
        frequency: ExpenseFrequency.MONTHLY,
        yearlyPaymentStrategy: null,
        installmentFrequency: null,
        paymentMonth: null,
        month: null,
        year: null,
        createdAt: new Date('2026-01-15'),
        updatedAt: new Date('2026-01-15'),
        deletedAt: null,
    };

    const mockPrismaService = {
        expense: {
            findMany: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
        },
    };

    const mockExpenseHelper = {
        requireMembership: vi.fn(),
        findExpenseOrFail: vi.fn(),
    };

    const mockCacheService = {
        getOrSet: vi.fn((key, ttl, fetchFn) => fetchFn()),
        invalidatePersonalExpenses: vi.fn(),
        invalidateDashboard: vi.fn(),
        invalidateSavings: vi.fn(),
        personalExpensesKey: vi.fn((userId, filterHash) => `cache:expenses:personal:${userId}:${filterHash}`),
        hashParams: vi.fn(() => 'default'),
        expensesTTL: 60,
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PersonalExpenseService,
                { provide: PrismaService, useValue: mockPrismaService },
                { provide: ExpenseHelperService, useValue: mockExpenseHelper },
                { provide: CacheService, useValue: mockCacheService },
            ],
        }).compile();

        service = module.get<PersonalExpenseService>(PersonalExpenseService);

        vi.clearAllMocks();
    });

    //#region listPersonalExpenses
    describe('listPersonalExpenses', () => {
        it('should return all personal expenses for the user', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findMany.mockResolvedValue([mockExpenseRecord]);

            const result = await service.listPersonalExpenses(mockUserId, {});

            expect(mockExpenseHelper.requireMembership).toHaveBeenCalledWith(mockUserId);
            expect(mockPrismaService.expense.findMany).toHaveBeenCalledWith({
                where: {
                    createdById: mockUserId,
                    type: ExpenseType.PERSONAL,
                    deletedAt: null,
                },
                orderBy: { createdAt: 'desc' },
            });
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe(mockExpenseId);
            expect(result[0].amount).toBe(49.99);
        });

        it('should return empty array when user has no expenses', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findMany.mockResolvedValue([]);

            const result = await service.listPersonalExpenses(mockUserId, {});

            expect(result).toEqual([]);
        });

        it('should filter by category when provided', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findMany.mockResolvedValue([]);

            await service.listPersonalExpenses(mockUserId, { category: ExpenseCategory.ONE_TIME });

            expect(mockPrismaService.expense.findMany).toHaveBeenCalledWith({
                where: {
                    createdById: mockUserId,
                    type: ExpenseType.PERSONAL,
                    deletedAt: null,
                    category: ExpenseCategory.ONE_TIME,
                },
                orderBy: { createdAt: 'desc' },
            });
        });

        it('should filter by frequency when provided', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findMany.mockResolvedValue([]);

            await service.listPersonalExpenses(mockUserId, { frequency: ExpenseFrequency.YEARLY });

            expect(mockPrismaService.expense.findMany).toHaveBeenCalledWith({
                where: {
                    createdById: mockUserId,
                    type: ExpenseType.PERSONAL,
                    deletedAt: null,
                    frequency: ExpenseFrequency.YEARLY,
                },
                orderBy: { createdAt: 'desc' },
            });
        });

        it('should filter by both category and frequency when provided', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findMany.mockResolvedValue([]);

            await service.listPersonalExpenses(mockUserId, {
                category: ExpenseCategory.RECURRING,
                frequency: ExpenseFrequency.MONTHLY,
            });

            expect(mockPrismaService.expense.findMany).toHaveBeenCalledWith({
                where: {
                    createdById: mockUserId,
                    type: ExpenseType.PERSONAL,
                    deletedAt: null,
                    category: ExpenseCategory.RECURRING,
                    frequency: ExpenseFrequency.MONTHLY,
                },
                orderBy: { createdAt: 'desc' },
            });
        });

        it('should throw NotFoundException if user has no household', async () => {
            mockExpenseHelper.requireMembership.mockRejectedValue(new NotFoundException('You must be in a household to manage expenses'));

            try {
                await service.listPersonalExpenses(mockUserId, {});
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('You must be in a household to manage expenses');
            }
            expect(mockPrismaService.expense.findMany).not.toHaveBeenCalled();
        });

        it('should convert Decimal amount to number in response', async () => {
            const expenseWithDecimal = { ...mockExpenseRecord, amount: { toNumber: () => 49.99, toString: () => '49.99' } };
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.findMany.mockResolvedValue([expenseWithDecimal]);

            const result = await service.listPersonalExpenses(mockUserId, {});

            expect(typeof result[0].amount).toBe('number');
        });
    });
    //#endregion

    //#region createPersonalExpense
    describe('createPersonalExpense', () => {
        const createDto = {
            name: 'Gym membership',
            amount: 49.99,
            category: ExpenseCategory.RECURRING,
            frequency: ExpenseFrequency.MONTHLY,
        };

        it('should create a personal expense and return it', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.create.mockResolvedValue(mockExpenseRecord);

            const result = await service.createPersonalExpense(mockUserId, createDto);

            expect(mockPrismaService.expense.create).toHaveBeenCalledWith({
                data: {
                    householdId: mockHouseholdId,
                    createdById: mockUserId,
                    name: 'Gym membership',
                    amount: 49.99,
                    type: ExpenseType.PERSONAL,
                    category: ExpenseCategory.RECURRING,
                    frequency: ExpenseFrequency.MONTHLY,
                    yearlyPaymentStrategy: null,
                    installmentFrequency: null,
                    paymentMonth: null,
                    month: null,
                    year: null,
                },
            });
            expect(result.id).toBe(mockExpenseId);
            expect(result.name).toBe('Gym membership');
        });

        it('should create a yearly expense with FULL payment strategy', async () => {
            const yearlyDto = {
                name: 'Car insurance',
                amount: 600,
                category: ExpenseCategory.RECURRING,
                frequency: ExpenseFrequency.YEARLY,
                yearlyPaymentStrategy: YearlyPaymentStrategy.FULL,
                paymentMonth: 6,
            };
            const yearlyExpense = {
                ...mockExpenseRecord,
                name: 'Car insurance',
                amount: 600,
                frequency: ExpenseFrequency.YEARLY,
                yearlyPaymentStrategy: YearlyPaymentStrategy.FULL,
                paymentMonth: 6,
            };
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.create.mockResolvedValue(yearlyExpense);

            const result = await service.createPersonalExpense(mockUserId, yearlyDto);

            expect(mockPrismaService.expense.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    frequency: ExpenseFrequency.YEARLY,
                    yearlyPaymentStrategy: YearlyPaymentStrategy.FULL,
                    paymentMonth: 6,
                    installmentFrequency: null,
                }),
            });
            expect(result.yearlyPaymentStrategy).toBe(YearlyPaymentStrategy.FULL);
            expect(result.paymentMonth).toBe(6);
        });

        it('should create a yearly expense with INSTALLMENTS strategy', async () => {
            const installmentDto = {
                name: 'Property tax',
                amount: 1200,
                category: ExpenseCategory.RECURRING,
                frequency: ExpenseFrequency.YEARLY,
                yearlyPaymentStrategy: YearlyPaymentStrategy.INSTALLMENTS,
                installmentFrequency: InstallmentFrequency.QUARTERLY,
            };
            const installmentExpense = {
                ...mockExpenseRecord,
                name: 'Property tax',
                amount: 1200,
                frequency: ExpenseFrequency.YEARLY,
                yearlyPaymentStrategy: YearlyPaymentStrategy.INSTALLMENTS,
                installmentFrequency: InstallmentFrequency.QUARTERLY,
            };
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.create.mockResolvedValue(installmentExpense);

            const result = await service.createPersonalExpense(mockUserId, installmentDto);

            expect(result.installmentFrequency).toBe(InstallmentFrequency.QUARTERLY);
        });

        it('should create a one-time expense with month and year', async () => {
            const oneTimeDto = {
                name: 'New laptop',
                amount: 1500,
                category: ExpenseCategory.ONE_TIME,
                frequency: ExpenseFrequency.MONTHLY,
                month: 3,
                year: 2026,
            };
            const oneTimeExpense = {
                ...mockExpenseRecord,
                name: 'New laptop',
                amount: 1500,
                category: ExpenseCategory.ONE_TIME,
                month: 3,
                year: 2026,
            };
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.expense.create.mockResolvedValue(oneTimeExpense);

            const result = await service.createPersonalExpense(mockUserId, oneTimeDto);

            expect(result.month).toBe(3);
            expect(result.year).toBe(2026);
        });

        it('should throw NotFoundException if user has no household', async () => {
            mockExpenseHelper.requireMembership.mockRejectedValue(new NotFoundException('You must be in a household to manage expenses'));

            try {
                await service.createPersonalExpense(mockUserId, createDto);
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('You must be in a household to manage expenses');
            }
            expect(mockPrismaService.expense.create).not.toHaveBeenCalled();
        });
    });
    //#endregion

    //#region getPersonalExpense
    describe('getPersonalExpense', () => {
        it('should return a personal expense by id', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockExpenseHelper.findExpenseOrFail.mockResolvedValue(mockExpenseRecord);

            const result = await service.getPersonalExpense(mockUserId, mockExpenseId);

            expect(mockExpenseHelper.findExpenseOrFail).toHaveBeenCalledWith(mockExpenseId, mockHouseholdId, ExpenseType.PERSONAL);
            expect(result.id).toBe(mockExpenseId);
        });

        it('should allow a household member to view another members expense', async () => {
            const alexMembership = { userId: mockOtherUserId, householdId: mockHouseholdId, role: 'MEMBER' };
            const samsExpense = { ...mockExpenseRecord, createdById: mockUserId };

            mockExpenseHelper.requireMembership.mockResolvedValue(alexMembership);
            mockExpenseHelper.findExpenseOrFail.mockResolvedValue(samsExpense);

            const result = await service.getPersonalExpense(mockOtherUserId, mockExpenseId);

            expect(result.id).toBe(mockExpenseId);
            expect(result.createdById).toBe(mockUserId);
        });

        it('should throw NotFoundException if user has no household', async () => {
            mockExpenseHelper.requireMembership.mockRejectedValue(new NotFoundException('You must be in a household to manage expenses'));

            try {
                await service.getPersonalExpense(mockUserId, mockExpenseId);
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('You must be in a household to manage expenses');
            }
        });

        it('should throw NotFoundException if expense does not exist', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockExpenseHelper.findExpenseOrFail.mockRejectedValue(new NotFoundException('Personal expense not found'));

            try {
                await service.getPersonalExpense(mockUserId, 'nonexistent-id');
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('Personal expense not found');
            }
        });

        it('should not reveal expenses from other households (enumeration prevention)', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockExpenseHelper.findExpenseOrFail.mockRejectedValue(new NotFoundException('Personal expense not found'));

            try {
                await service.getPersonalExpense(mockUserId, 'expense-in-other-household');
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('Personal expense not found');
            }
        });
    });
    //#endregion

    //#region updatePersonalExpense
    describe('updatePersonalExpense', () => {
        const updateDto = { name: 'Updated gym', amount: 54.99 };

        it('should update an expense owned by the user', async () => {
            const updatedExpense = { ...mockExpenseRecord, name: 'Updated gym', amount: 54.99 };
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockExpenseHelper.findExpenseOrFail.mockResolvedValue(mockExpenseRecord);
            mockPrismaService.expense.update.mockResolvedValue(updatedExpense);

            const result = await service.updatePersonalExpense(mockUserId, mockExpenseId, updateDto);

            expect(mockPrismaService.expense.update).toHaveBeenCalledWith({
                where: { id: mockExpenseId },
                data: { name: 'Updated gym', amount: 54.99 },
            });
            expect(result.name).toBe('Updated gym');
            expect(result.amount).toBe(54.99);
        });

        it('should only update provided fields (partial update)', async () => {
            const partialDto = { amount: 60 };
            const updatedExpense = { ...mockExpenseRecord, amount: 60 };
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockExpenseHelper.findExpenseOrFail.mockResolvedValue(mockExpenseRecord);
            mockPrismaService.expense.update.mockResolvedValue(updatedExpense);

            await service.updatePersonalExpense(mockUserId, mockExpenseId, partialDto);

            expect(mockPrismaService.expense.update).toHaveBeenCalledWith({
                where: { id: mockExpenseId },
                data: { amount: 60 },
            });
        });

        it('should pass empty data object when no fields are provided', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockExpenseHelper.findExpenseOrFail.mockResolvedValue(mockExpenseRecord);
            mockPrismaService.expense.update.mockResolvedValue(mockExpenseRecord);

            await service.updatePersonalExpense(mockUserId, mockExpenseId, {});

            expect(mockPrismaService.expense.update).toHaveBeenCalledWith({
                where: { id: mockExpenseId },
                data: {},
            });
        });

        it('should throw NotFoundException if user has no household', async () => {
            mockExpenseHelper.requireMembership.mockRejectedValue(new NotFoundException('You must be in a household to manage expenses'));

            try {
                await service.updatePersonalExpense(mockUserId, mockExpenseId, updateDto);
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('You must be in a household to manage expenses');
            }
        });

        it('should throw NotFoundException if expense does not exist', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockExpenseHelper.findExpenseOrFail.mockRejectedValue(new NotFoundException('Personal expense not found'));

            try {
                await service.updatePersonalExpense(mockUserId, 'nonexistent-id', updateDto);
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('Personal expense not found');
            }
        });

        it('should throw ForbiddenException if user is not the creator', async () => {
            const samsExpense = { ...mockExpenseRecord, createdById: mockOtherUserId };
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockExpenseHelper.findExpenseOrFail.mockResolvedValue(samsExpense);

            try {
                await service.updatePersonalExpense(mockUserId, mockExpenseId, updateDto);
                expect.unreachable('Should have thrown ForbiddenException');
            } catch (error) {
                expect(error).toBeInstanceOf(ForbiddenException);
                expect(error.message).toBe('You can only modify your own personal expenses');
            }
            expect(mockPrismaService.expense.update).not.toHaveBeenCalled();
        });
    });
    //#endregion

    //#region deletePersonalExpense
    describe('deletePersonalExpense', () => {
        it('should soft-delete an expense owned by the user', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockExpenseHelper.findExpenseOrFail.mockResolvedValue(mockExpenseRecord);
            mockPrismaService.expense.update.mockResolvedValue({ ...mockExpenseRecord, deletedAt: new Date() });

            const result = await service.deletePersonalExpense(mockUserId, mockExpenseId);

            expect(mockPrismaService.expense.update).toHaveBeenCalledWith({
                where: { id: mockExpenseId },
                data: { deletedAt: expect.any(Date) },
            });
            expect(result.message).toBe('Personal expense deleted successfully.');
        });

        it('should throw NotFoundException if user has no household', async () => {
            mockExpenseHelper.requireMembership.mockRejectedValue(new NotFoundException('You must be in a household to manage expenses'));

            try {
                await service.deletePersonalExpense(mockUserId, mockExpenseId);
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('You must be in a household to manage expenses');
            }
        });

        it('should throw NotFoundException if expense does not exist', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockExpenseHelper.findExpenseOrFail.mockRejectedValue(new NotFoundException('Personal expense not found'));

            try {
                await service.deletePersonalExpense(mockUserId, 'nonexistent-id');
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('Personal expense not found');
            }
        });

        it('should throw ForbiddenException if user is not the creator', async () => {
            const samsExpense = { ...mockExpenseRecord, createdById: mockOtherUserId };
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockExpenseHelper.findExpenseOrFail.mockResolvedValue(samsExpense);

            try {
                await service.deletePersonalExpense(mockUserId, mockExpenseId);
                expect.unreachable('Should have thrown ForbiddenException');
            } catch (error) {
                expect(error).toBeInstanceOf(ForbiddenException);
                expect(error.message).toBe('You can only delete your own personal expenses');
            }
            expect(mockPrismaService.expense.update).not.toHaveBeenCalled();
        });

        it('should propagate NotFoundException for already soft-deleted expenses', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockExpenseHelper.findExpenseOrFail.mockRejectedValue(new NotFoundException('Personal expense not found'));

            try {
                await service.deletePersonalExpense(mockUserId, mockExpenseId);
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('Personal expense not found');
            }
        });
    });
    //#endregion
});
