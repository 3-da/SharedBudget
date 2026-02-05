import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../prisma/prisma.service';
import { ExpenseHelperService } from '../common/expense/expense-helper.service';
import { CacheService } from '../common/cache/cache.service';

describe('DashboardService', () => {
    let service: DashboardService;

    const mockUserId = 'user-alex';
    const mockPartnerId = 'user-sam';
    const mockHouseholdId = 'household-456';

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const mockMembers = [
        {
            id: 'member-1',
            userId: mockUserId,
            householdId: mockHouseholdId,
            role: 'OWNER',
            user: { id: mockUserId, firstName: 'Alex', lastName: 'Owner' },
        },
        {
            id: 'member-2',
            userId: mockPartnerId,
            householdId: mockHouseholdId,
            role: 'MEMBER',
            user: { id: mockPartnerId, firstName: 'Sam', lastName: 'Member' },
        },
    ];

    const mockSalaries = [
        {
            id: 'salary-1',
            userId: mockUserId,
            householdId: mockHouseholdId,
            defaultAmount: { valueOf: () => 3500 },
            currentAmount: { valueOf: () => 3200 },
            month: currentMonth,
            year: currentYear,
        },
        {
            id: 'salary-2',
            userId: mockPartnerId,
            householdId: mockHouseholdId,
            defaultAmount: { valueOf: () => 2500 },
            currentAmount: { valueOf: () => 2500 },
            month: currentMonth,
            year: currentYear,
        },
    ];

    const mockExpenses = [
        {
            id: 'exp-1',
            householdId: mockHouseholdId,
            createdById: mockUserId,
            name: 'Gym',
            amount: { valueOf: () => 50 },
            type: 'PERSONAL',
            category: 'RECURRING',
            frequency: 'MONTHLY',
            paidByUserId: null,
            yearlyPaymentStrategy: null,
            installmentFrequency: null,
            paymentMonth: null,
            month: null,
            year: null,
            deletedAt: null,
        },
        {
            id: 'exp-2',
            householdId: mockHouseholdId,
            createdById: mockPartnerId,
            name: 'Hairdresser',
            amount: { valueOf: () => 30 },
            type: 'PERSONAL',
            category: 'RECURRING',
            frequency: 'MONTHLY',
            paidByUserId: null,
            yearlyPaymentStrategy: null,
            installmentFrequency: null,
            paymentMonth: null,
            month: null,
            year: null,
            deletedAt: null,
        },
        {
            id: 'exp-3',
            householdId: mockHouseholdId,
            createdById: mockUserId,
            name: 'Monthly Rent',
            amount: { valueOf: () => 800 },
            type: 'SHARED',
            category: 'RECURRING',
            frequency: 'MONTHLY',
            paidByUserId: null, // split equally
            yearlyPaymentStrategy: null,
            installmentFrequency: null,
            paymentMonth: null,
            month: null,
            year: null,
            deletedAt: null,
        },
        {
            id: 'exp-4',
            householdId: mockHouseholdId,
            createdById: mockUserId,
            name: 'Electricity',
            amount: { valueOf: () => 120 },
            type: 'SHARED',
            category: 'RECURRING',
            frequency: 'MONTHLY',
            paidByUserId: mockUserId, // Alex pays full
            yearlyPaymentStrategy: null,
            installmentFrequency: null,
            paymentMonth: null,
            month: null,
            year: null,
            deletedAt: null,
        },
    ];

    const mockPrismaService = {
        householdMember: { findMany: vi.fn(), findUnique: vi.fn() },
        salary: { findMany: vi.fn() },
        expense: { findMany: vi.fn() },
        expenseApproval: { count: vi.fn() },
        settlement: { findUnique: vi.fn(), create: vi.fn() },
    };

    const mockExpenseHelper = {
        requireMembership: vi.fn(),
    };

    const mockCacheService = {
        getOrSet: vi.fn((key, ttl, fetchFn) => fetchFn()),
        invalidateDashboard: vi.fn(),
        dashboardKey: vi.fn((householdId, year, month) => `cache:dashboard:${householdId}:${year}:${month}`),
        savingsKey: vi.fn((householdId, year, month) => `cache:savings:${householdId}:${year}:${month}`),
        settlementKey: vi.fn((householdId, year, month) => `cache:settlement:${householdId}:${year}:${month}`),
        summaryTTL: 120,
        settlementTTL: 120,
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                DashboardService,
                { provide: PrismaService, useValue: mockPrismaService },
                { provide: ExpenseHelperService, useValue: mockExpenseHelper },
                { provide: CacheService, useValue: mockCacheService },
            ],
        }).compile();

        service = module.get<DashboardService>(DashboardService);

        vi.clearAllMocks();

        // Default mocks
        mockExpenseHelper.requireMembership.mockResolvedValue({
            userId: mockUserId,
            householdId: mockHouseholdId,
        });
        mockPrismaService.householdMember.findMany.mockResolvedValue(mockMembers);
        mockPrismaService.salary.findMany.mockResolvedValue(mockSalaries);
        mockPrismaService.expense.findMany.mockResolvedValue(mockExpenses);
        mockPrismaService.expenseApproval.count.mockResolvedValue(2);
        mockPrismaService.settlement.findUnique.mockResolvedValue(null);
    });

    describe('getOverview', () => {
        it('should return a complete dashboard overview', async () => {
            const result = await service.getOverview(mockUserId);

            expect(result.month).toBe(currentMonth);
            expect(result.year).toBe(currentYear);
            expect(result.income).toHaveLength(2);
            expect(result.totalDefaultIncome).toBe(6000);
            expect(result.totalCurrentIncome).toBe(5700);
            expect(result.expenses.personalExpenses).toHaveLength(2);
            expect(result.expenses.sharedExpensesTotal).toBe(920);
            expect(result.savings.members).toHaveLength(2);
            expect(result.pendingApprovalsCount).toBe(2);
        });

        it('should throw NotFoundException when user is not in a household', async () => {
            mockExpenseHelper.requireMembership.mockRejectedValue(new NotFoundException('You must be in a household to manage expenses'));

            await expect(service.getOverview(mockUserId)).rejects.toThrow(NotFoundException);
            await expect(service.getOverview(mockUserId)).rejects.toThrow('You must be in a household to manage expenses');
        });

        it('should handle household with no salaries set', async () => {
            mockPrismaService.salary.findMany.mockResolvedValue([]);

            const result = await service.getOverview(mockUserId);

            expect(result.totalDefaultIncome).toBe(0);
            expect(result.totalCurrentIncome).toBe(0);
            expect(result.income[0].defaultSalary).toBe(0);
            expect(result.income[0].currentSalary).toBe(0);
        });

        it('should handle household with no expenses', async () => {
            mockPrismaService.expense.findMany.mockResolvedValue([]);

            const result = await service.getOverview(mockUserId);

            expect(result.expenses.sharedExpensesTotal).toBe(0);
            expect(result.expenses.totalHouseholdExpenses).toBe(0);
            expect(result.expenses.personalExpenses[0].personalExpensesTotal).toBe(0);
        });

        it('should include pending approvals count', async () => {
            mockPrismaService.expenseApproval.count.mockResolvedValue(5);

            const result = await service.getOverview(mockUserId);

            expect(result.pendingApprovalsCount).toBe(5);
        });

        it('should return zero pending approvals when none exist', async () => {
            mockPrismaService.expenseApproval.count.mockResolvedValue(0);

            const result = await service.getOverview(mockUserId);

            expect(result.pendingApprovalsCount).toBe(0);
        });
    });

    describe('getSavings', () => {
        it('should return savings breakdown per member', async () => {
            const result = await service.getSavings(mockUserId);

            expect(result.members).toHaveLength(2);

            // Alex: 3500 (default) - 50 (personal) - 460 (shared/2) = 2990
            const alexSavings = result.members.find((m) => m.userId === mockUserId);
            expect(alexSavings).toBeDefined();
            expect(alexSavings!.defaultSavings).toBe(2990);
            // Alex current: 3200 - 50 - 460 = 2690
            expect(alexSavings!.currentSavings).toBe(2690);

            // Sam: 2500 (default) - 30 (personal) - 460 (shared/2) = 2010
            const samSavings = result.members.find((m) => m.userId === mockPartnerId);
            expect(samSavings).toBeDefined();
            expect(samSavings!.defaultSavings).toBe(2010);
            expect(samSavings!.currentSavings).toBe(2010);
        });

        it('should calculate correct total household savings', async () => {
            const result = await service.getSavings(mockUserId);

            // Total default: 2990 + 2010 = 5000
            expect(result.totalDefaultSavings).toBe(5000);
            // Total current: 2690 + 2010 = 4700
            expect(result.totalCurrentSavings).toBe(4700);
        });

        it('should handle negative savings (expenses exceed income)', async () => {
            mockPrismaService.salary.findMany.mockResolvedValue([
                { ...mockSalaries[0], defaultAmount: { valueOf: () => 100 }, currentAmount: { valueOf: () => 100 } },
                { ...mockSalaries[1], defaultAmount: { valueOf: () => 100 }, currentAmount: { valueOf: () => 100 } },
            ]);

            const result = await service.getSavings(mockUserId);

            const alexSavings = result.members.find((m) => m.userId === mockUserId);
            // 100 - 50 - 460 = -410
            expect(alexSavings!.defaultSavings).toBe(-410);
        });

        it('should throw NotFoundException when user is not in a household', async () => {
            mockExpenseHelper.requireMembership.mockRejectedValue(new NotFoundException('You must be in a household to manage expenses'));

            await expect(service.getSavings(mockUserId)).rejects.toThrow(NotFoundException);
            await expect(service.getSavings(mockUserId)).rejects.toThrow('You must be in a household to manage expenses');
        });

        it('should handle member with no salary record (defaults to zero)', async () => {
            // Only Alex has a salary
            mockPrismaService.salary.findMany.mockResolvedValue([mockSalaries[0]]);

            const result = await service.getSavings(mockUserId);

            const samSavings = result.members.find((m) => m.userId === mockPartnerId);
            // 0 - 30 - 460 = -490
            expect(samSavings!.defaultSavings).toBe(-490);
            expect(samSavings!.currentSavings).toBe(-490);
        });
    });

    describe('getSettlement', () => {
        it('should calculate settlement when one member pays full for shared expense', async () => {
            const result = await service.getSettlement(mockUserId);

            // Rent: €800 split equally → each pays 400, fair share 400 each → net 0
            // Electricity: €120 paid by Alex → Alex pays 120, fair share 60 each
            //   Alex: paid 120, fair share 60 → balance +60
            //   Sam: paid 0, fair share 60 → balance -60
            // Total: Sam owes Alex €60
            expect(result.amount).toBe(60);
            expect(result.owedByUserId).toBe(mockPartnerId);
            expect(result.owedToUserId).toBe(mockUserId);
            expect(result.message).toBe('Sam owes you €60.00');
            expect(result.isSettled).toBe(false);
        });

        it('should return zero settlement when all expenses are split equally', async () => {
            // Only split expenses, no single-payer ones
            const splitOnlyExpenses = mockExpenses.filter((e) => e.paidByUserId === null);
            mockPrismaService.expense.findMany.mockResolvedValue(splitOnlyExpenses);

            const result = await service.getSettlement(mockUserId);

            expect(result.amount).toBe(0);
            expect(result.owedByUserId).toBeNull();
            expect(result.owedToUserId).toBeNull();
            expect(result.message).toBe('All shared expenses are balanced — no settlement needed.');
        });

        it('should return zero settlement when there are no shared expenses', async () => {
            const personalOnly = mockExpenses.filter((e) => e.type === 'PERSONAL');
            mockPrismaService.expense.findMany.mockResolvedValue(personalOnly);

            const result = await service.getSettlement(mockUserId);

            expect(result.amount).toBe(0);
            expect(result.message).toBe('All shared expenses are balanced — no settlement needed.');
        });

        it('should show relative message when requesting user owes money', async () => {
            // Partner (Sam) is requesting — Sam owes Alex
            mockExpenseHelper.requireMembership.mockResolvedValue({
                userId: mockPartnerId,
                householdId: mockHouseholdId,
            });

            const result = await service.getSettlement(mockPartnerId);

            expect(result.amount).toBe(60);
            expect(result.message).toBe('You owe Alex €60.00');
        });

        it('should indicate when month is already settled', async () => {
            mockPrismaService.settlement.findUnique.mockResolvedValue({
                id: 'settlement-1',
                householdId: mockHouseholdId,
                month: currentMonth,
                year: currentYear,
            });

            const result = await service.getSettlement(mockUserId);

            expect(result.isSettled).toBe(true);
        });

        it('should throw NotFoundException when user is not in a household', async () => {
            mockExpenseHelper.requireMembership.mockRejectedValue(new NotFoundException('You must be in a household to manage expenses'));

            await expect(service.getSettlement(mockUserId)).rejects.toThrow(NotFoundException);
            await expect(service.getSettlement(mockUserId)).rejects.toThrow('You must be in a household to manage expenses');
        });

        it('should handle yearly expenses with monthly equivalent in settlement', async () => {
            const yearlyExpense = {
                id: 'exp-yearly',
                householdId: mockHouseholdId,
                createdById: mockUserId,
                name: 'Insurance',
                amount: { valueOf: () => 1200 },
                type: 'SHARED',
                category: 'RECURRING',
                frequency: 'YEARLY',
                paidByUserId: mockUserId, // Alex pays full
                yearlyPaymentStrategy: 'FULL',
                installmentFrequency: null,
                paymentMonth: 6,
                month: null,
                year: null,
                deletedAt: null,
            };

            mockPrismaService.expense.findMany.mockResolvedValue([yearlyExpense]);

            const result = await service.getSettlement(mockUserId);

            // €1200/12 = €100/month, Alex pays all, fair share = 50 each
            // Alex: paid 100, fair share 50 → balance +50
            // Sam: paid 0, fair share 50 → balance -50
            expect(result.amount).toBe(50);
            expect(result.owedByUserId).toBe(mockPartnerId);
            expect(result.owedToUserId).toBe(mockUserId);
        });

        it('should handle one-time expenses only in their specific month', async () => {
            const oneTimeExpense = {
                id: 'exp-onetime',
                householdId: mockHouseholdId,
                createdById: mockUserId,
                name: 'Furniture',
                amount: { valueOf: () => 500 },
                type: 'SHARED',
                category: 'ONE_TIME',
                frequency: 'MONTHLY',
                paidByUserId: mockUserId,
                yearlyPaymentStrategy: null,
                installmentFrequency: null,
                paymentMonth: null,
                month: currentMonth,
                year: currentYear,
                deletedAt: null,
            };

            mockPrismaService.expense.findMany.mockResolvedValue([oneTimeExpense]);

            const result = await service.getSettlement(mockUserId);

            // €500, Alex pays full, fair share = 250 each
            // Alex: paid 500, fair share 250 → balance +250
            expect(result.amount).toBe(250);
        });

        it('should ignore one-time expenses from a different month', async () => {
            const differentMonthExpense = {
                id: 'exp-diff',
                householdId: mockHouseholdId,
                createdById: mockUserId,
                name: 'Past purchase',
                amount: { valueOf: () => 500 },
                type: 'SHARED',
                category: 'ONE_TIME',
                frequency: 'MONTHLY',
                paidByUserId: mockUserId,
                yearlyPaymentStrategy: null,
                installmentFrequency: null,
                paymentMonth: null,
                month: currentMonth === 12 ? 1 : currentMonth + 1, // different month
                year: currentYear,
                deletedAt: null,
            };

            mockPrismaService.expense.findMany.mockResolvedValue([differentMonthExpense]);

            const result = await service.getSettlement(mockUserId);

            expect(result.amount).toBe(0);
        });
    });

    describe('markSettlementPaid', () => {
        it('should create a settlement record when there is an outstanding balance', async () => {
            mockPrismaService.settlement.create.mockResolvedValue({
                id: 'settlement-new',
                householdId: mockHouseholdId,
                month: currentMonth,
                year: currentYear,
                amount: { valueOf: () => 60 },
                paidByUserId: mockPartnerId,
                paidToUserId: mockUserId,
                paidAt: now,
            });

            const result = await service.markSettlementPaid(mockUserId);

            expect(result.id).toBe('settlement-new');
            expect(result.amount).toBe(60);
            expect(result.paidByUserId).toBe(mockPartnerId);
            expect(result.paidToUserId).toBe(mockUserId);
            expect(mockPrismaService.settlement.create).toHaveBeenCalledWith({
                data: {
                    householdId: mockHouseholdId,
                    month: currentMonth,
                    year: currentYear,
                    amount: 60,
                    paidByUserId: mockPartnerId,
                    paidToUserId: mockUserId,
                },
            });
        });

        it('should throw ConflictException with correct message when already settled', async () => {
            mockPrismaService.settlement.findUnique.mockResolvedValue({
                id: 'existing-settlement',
                householdId: mockHouseholdId,
                month: currentMonth,
                year: currentYear,
            });

            await expect(service.markSettlementPaid(mockUserId)).rejects.toThrow(ConflictException);
            await expect(service.markSettlementPaid(mockUserId)).rejects.toThrow('Settlement has already been marked as paid for this month');
        });

        it('should throw BadRequestException with correct message when no settlement needed', async () => {
            // Only split expenses, no payer differences → balance is 0
            const splitOnlyExpenses = mockExpenses.filter((e) => e.paidByUserId === null);
            mockPrismaService.expense.findMany.mockResolvedValue(splitOnlyExpenses);

            await expect(service.markSettlementPaid(mockUserId)).rejects.toThrow(BadRequestException);
            await expect(service.markSettlementPaid(mockUserId)).rejects.toThrow('No settlement needed — shared expenses are balanced');
        });

        it('should throw NotFoundException when user is not in a household', async () => {
            mockExpenseHelper.requireMembership.mockRejectedValue(new NotFoundException('You must be in a household to manage expenses'));

            await expect(service.markSettlementPaid(mockUserId)).rejects.toThrow(NotFoundException);
            await expect(service.markSettlementPaid(mockUserId)).rejects.toThrow('You must be in a household to manage expenses');
        });

        it('should throw BadRequestException when no shared expenses exist', async () => {
            mockPrismaService.expense.findMany.mockResolvedValue([]);

            await expect(service.markSettlementPaid(mockUserId)).rejects.toThrow(BadRequestException);
            await expect(service.markSettlementPaid(mockUserId)).rejects.toThrow('No settlement needed — shared expenses are balanced');
        });
    });

    describe('edge cases', () => {
        it('should handle a single-member household', async () => {
            mockPrismaService.householdMember.findMany.mockResolvedValue([mockMembers[0]]);
            mockPrismaService.salary.findMany.mockResolvedValue([mockSalaries[0]]);
            mockPrismaService.expense.findMany.mockResolvedValue([mockExpenses[0]]); // personal only

            const result = await service.getOverview(mockUserId);

            expect(result.income).toHaveLength(1);
            expect(result.totalDefaultIncome).toBe(3500);
            expect(result.settlement.amount).toBe(0);
        });

        it('should handle household with no members gracefully', async () => {
            mockPrismaService.householdMember.findMany.mockResolvedValue([]);
            mockPrismaService.salary.findMany.mockResolvedValue([]);
            mockPrismaService.expense.findMany.mockResolvedValue([]);

            const result = await service.getOverview(mockUserId);

            expect(result.income).toHaveLength(0);
            expect(result.totalDefaultIncome).toBe(0);
            expect(result.expenses.sharedExpensesTotal).toBe(0);
            expect(result.settlement.amount).toBe(0);
        });

        it('should correctly normalize yearly expenses to monthly equivalent', async () => {
            const yearlyExpense = {
                id: 'exp-yearly',
                householdId: mockHouseholdId,
                createdById: mockUserId,
                name: 'Annual Insurance',
                amount: { valueOf: () => 1200 },
                type: 'PERSONAL',
                category: 'RECURRING',
                frequency: 'YEARLY',
                paidByUserId: null,
                yearlyPaymentStrategy: 'INSTALLMENTS',
                installmentFrequency: 'QUARTERLY',
                paymentMonth: null,
                month: null,
                year: null,
                deletedAt: null,
            };

            mockPrismaService.expense.findMany.mockResolvedValue([yearlyExpense]);

            const result = await service.getOverview(mockUserId);

            // €1200 / 12 = €100/month
            const alexExpense = result.expenses.personalExpenses.find((pe) => pe.userId === mockUserId);
            expect(alexExpense!.personalExpensesTotal).toBe(100);
        });

        it('should round financial amounts to 2 decimal places', async () => {
            const oddExpense = {
                id: 'exp-odd',
                householdId: mockHouseholdId,
                createdById: mockUserId,
                name: 'Odd Amount',
                amount: { valueOf: () => 100 },
                type: 'SHARED',
                category: 'RECURRING',
                frequency: 'YEARLY', // 100/12 = 8.333...
                paidByUserId: null,
                yearlyPaymentStrategy: null,
                installmentFrequency: null,
                paymentMonth: null,
                month: null,
                year: null,
                deletedAt: null,
            };

            mockPrismaService.expense.findMany.mockResolvedValue([oddExpense]);

            const result = await service.getOverview(mockUserId);

            // 100/12 = 8.333... → should be rounded to 8.33
            expect(result.expenses.sharedExpensesTotal).toBe(8.33);
        });
    });
});
