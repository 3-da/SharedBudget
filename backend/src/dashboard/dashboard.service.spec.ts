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
        expensePaymentStatus: { findMany: vi.fn() },
        settlement: { findUnique: vi.fn(), create: vi.fn() },
        saving: { findMany: vi.fn() },
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
        mockPrismaService.expensePaymentStatus.findMany.mockResolvedValue([]);
        mockPrismaService.settlement.findUnique.mockResolvedValue(null);
        mockPrismaService.saving.findMany.mockResolvedValue([]);
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
            expect(result.expenses.remainingHouseholdExpenses).toBe(0);
            expect(result.expenses.personalExpenses[0].personalExpensesTotal).toBe(0);
        });

        it('should compute remainingHouseholdExpenses as total minus paid', async () => {
            // Mark exp-1 (Gym, €50) as PAID
            mockPrismaService.expensePaymentStatus.findMany.mockResolvedValue([
                { expenseId: 'exp-1', month: currentMonth, year: currentYear, status: 'PAID' },
            ]);

            const result = await service.getOverview(mockUserId);

            // Total: Gym(50) + Hairdresser(30) + Rent(800) + Electricity(120) = 1000
            expect(result.expenses.totalHouseholdExpenses).toBe(1000);
            // Gym is paid → remaining = 1000 - 50 = 950
            expect(result.expenses.remainingHouseholdExpenses).toBe(950);
        });

        it('should include pending approvals count excluding own approvals', async () => {
            mockPrismaService.expenseApproval.count.mockResolvedValue(5);

            const result = await service.getOverview(mockUserId);

            expect(result.pendingApprovalsCount).toBe(5);
            // Verify the count call excludes the requesting user's own approvals
            expect(mockPrismaService.expenseApproval.count).toHaveBeenCalledWith({
                where: {
                    householdId: mockHouseholdId,
                    status: 'PENDING',
                    requestedById: { not: mockUserId },
                },
            });
        });

        it('should return zero pending approvals when none exist', async () => {
            mockPrismaService.expenseApproval.count.mockResolvedValue(0);

            const result = await service.getOverview(mockUserId);

            expect(result.pendingApprovalsCount).toBe(0);
        });

        it('should return yearly averaged data when mode is yearly', async () => {
            const result = await service.getOverview(mockUserId, 'yearly');

            // With consistent mock data across all 12 months, averages should equal monthly values
            expect(result.income).toHaveLength(2);
            expect(result.totalDefaultIncome).toBe(6000);
            expect(result.totalCurrentIncome).toBe(5700);
            expect(result.month).toBe(currentMonth);
            expect(result.year).toBe(currentYear);
        });

        it('should compute savings from actual Saving records in overview', async () => {
            mockPrismaService.saving.findMany.mockResolvedValue([
                { userId: mockUserId, amount: { valueOf: () => 500 }, isShared: false },
                { userId: mockUserId, amount: { valueOf: () => 200 }, isShared: true },
            ]);

            const result = await service.getOverview(mockUserId);

            expect(result.savings.totalPersonalSavings).toBe(500);
            expect(result.savings.totalSharedSavings).toBe(200);
            expect(result.savings.totalSavings).toBe(700);
        });

        it('should compute totalRemainingBudget in overview', async () => {
            // No savings, no paid expenses
            // Alex: 3200 - 50 (personal) - 460 (shared/2) - 0 - 0 = 2690
            // Sam: 2500 - 30 (personal) - 460 (shared/2) - 0 - 0 = 2010
            // Total remaining budget = 2690 + 2010 = 4700
            const result = await service.getOverview(mockUserId);

            expect(result.savings.totalRemainingBudget).toBe(4700);
        });
    });

    describe('getSavings', () => {
        it('should return savings breakdown per member with zero actual savings when no records', async () => {
            const result = await service.getSavings(mockUserId);

            expect(result.members).toHaveLength(2);

            const alexSavings = result.members.find((m) => m.userId === mockUserId);
            expect(alexSavings).toBeDefined();
            // No saving records → personalSavings and sharedSavings are 0
            expect(alexSavings!.personalSavings).toBe(0);
            expect(alexSavings!.sharedSavings).toBe(0);
            // Alex: remainingBudget = 3200 - 50 - 460 - 0 - 0 = 2690
            expect(alexSavings!.remainingBudget).toBe(2690);

            const samSavings = result.members.find((m) => m.userId === mockPartnerId);
            expect(samSavings).toBeDefined();
            expect(samSavings!.personalSavings).toBe(0);
            expect(samSavings!.sharedSavings).toBe(0);
            // Sam: remainingBudget = 2500 - 30 - 460 - 0 - 0 = 2010
            expect(samSavings!.remainingBudget).toBe(2010);
        });

        it('should return actual savings from Saving records', async () => {
            mockPrismaService.saving.findMany.mockResolvedValue([
                { userId: mockUserId, amount: { valueOf: () => 500 }, isShared: false },
                { userId: mockUserId, amount: { valueOf: () => 200 }, isShared: true },
                { userId: mockPartnerId, amount: { valueOf: () => 300 }, isShared: false },
            ]);

            const result = await service.getSavings(mockUserId);

            const alexSavings = result.members.find((m) => m.userId === mockUserId);
            expect(alexSavings!.personalSavings).toBe(500);
            expect(alexSavings!.sharedSavings).toBe(200);

            const samSavings = result.members.find((m) => m.userId === mockPartnerId);
            expect(samSavings!.personalSavings).toBe(300);
            expect(samSavings!.sharedSavings).toBe(0);

            expect(result.totalPersonalSavings).toBe(800);
            expect(result.totalSharedSavings).toBe(200);
        });

        it('should calculate correct totalSavings and totalRemainingBudget', async () => {
            mockPrismaService.saving.findMany.mockResolvedValue([
                { userId: mockUserId, amount: { valueOf: () => 500 }, isShared: false },
                { userId: mockUserId, amount: { valueOf: () => 200 }, isShared: true },
                { userId: mockPartnerId, amount: { valueOf: () => 300 }, isShared: false },
            ]);

            const result = await service.getSavings(mockUserId);

            // Total savings = 500 + 200 + 300 = 1000
            expect(result.totalSavings).toBe(1000);
            // Alex remaining: 3200 - 50 - 460 - 500 - 200 = 1990
            // Sam remaining: 2500 - 30 - 460 - 300 - 0 = 1710
            // Total: 1990 + 1710 = 3700
            expect(result.totalRemainingBudget).toBe(3700);
        });

        it('should calculate correct total household savings with no saving records', async () => {
            const result = await service.getSavings(mockUserId);

            // No saving records → totalSavings = 0
            expect(result.totalPersonalSavings).toBe(0);
            expect(result.totalSharedSavings).toBe(0);
            expect(result.totalSavings).toBe(0);
            // Remaining budget = total income - total expenses - 0 savings
            expect(result.totalRemainingBudget).toBe(4700);
        });

        it('should handle negative remaining budget (expenses + savings exceed income)', async () => {
            mockPrismaService.salary.findMany.mockResolvedValue([
                { ...mockSalaries[0], defaultAmount: { valueOf: () => 100 }, currentAmount: { valueOf: () => 100 } },
                { ...mockSalaries[1], defaultAmount: { valueOf: () => 100 }, currentAmount: { valueOf: () => 100 } },
            ]);

            const result = await service.getSavings(mockUserId);

            const alexSavings = result.members.find((m) => m.userId === mockUserId);
            // 100 - 50 - 460 - 0 - 0 = -410
            expect(alexSavings!.remainingBudget).toBe(-410);
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
            // 0 - 30 - 460 - 0 - 0 = -490
            expect(samSavings!.remainingBudget).toBe(-490);
        });

        it('should subtract savings from remaining budget', async () => {
            mockPrismaService.saving.findMany.mockResolvedValue([
                { userId: mockUserId, amount: { valueOf: () => 1000 }, isShared: false },
            ]);

            const result = await service.getSavings(mockUserId);

            const alexSavings = result.members.find((m) => m.userId === mockUserId);
            // 3200 - 50 - 460 - 1000 - 0 = 1690
            expect(alexSavings!.remainingBudget).toBe(1690);
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

        it('should handle yearly FULL expense only in payment month for settlement', async () => {
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
                paymentMonth: currentMonth, // use current month so it triggers
                month: null,
                year: null,
                deletedAt: null,
            };

            mockPrismaService.expense.findMany.mockResolvedValue([yearlyExpense]);

            const result = await service.getSettlement(mockUserId);

            // FULL in payment month: full €1200, Alex pays all, fair share = 600 each
            // Alex: paid 1200, fair share 600 → balance +600
            // Sam: paid 0, fair share 600 → balance -600
            expect(result.amount).toBe(600);
            expect(result.owedByUserId).toBe(mockPartnerId);
            expect(result.owedToUserId).toBe(mockUserId);
        });

        it('should return zero settlement for yearly FULL expense outside payment month', async () => {
            const otherMonth = currentMonth === 6 ? 7 : 6;
            const yearlyExpense = {
                id: 'exp-yearly',
                householdId: mockHouseholdId,
                createdById: mockUserId,
                name: 'Insurance',
                amount: { valueOf: () => 1200 },
                type: 'SHARED',
                category: 'RECURRING',
                frequency: 'YEARLY',
                paidByUserId: mockUserId,
                yearlyPaymentStrategy: 'FULL',
                installmentFrequency: null,
                paymentMonth: otherMonth, // NOT current month
                month: null,
                year: null,
                deletedAt: null,
            };

            mockPrismaService.expense.findMany.mockResolvedValue([yearlyExpense]);

            const result = await service.getSettlement(mockUserId);

            // Not in payment month → amount is 0 → no settlement
            expect(result.amount).toBe(0);
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

    describe('getMonthlyAmount logic (via getOverview)', () => {
        it('should return full amount for YEARLY+FULL in payment month', async () => {
            const expense = {
                id: 'exp-yearly-full',
                householdId: mockHouseholdId,
                createdById: mockUserId,
                name: 'Annual Fee',
                amount: { valueOf: () => 1200 },
                type: 'PERSONAL',
                category: 'RECURRING',
                frequency: 'YEARLY',
                paidByUserId: null,
                yearlyPaymentStrategy: 'FULL',
                installmentFrequency: null,
                paymentMonth: currentMonth,
                month: null,
                year: null,
                deletedAt: null,
            };

            mockPrismaService.expense.findMany.mockResolvedValue([expense]);
            const result = await service.getOverview(mockUserId);

            const alexExpense = result.expenses.personalExpenses.find((pe) => pe.userId === mockUserId);
            expect(alexExpense!.personalExpensesTotal).toBe(1200);
        });

        it('should return 0 for YEARLY+FULL NOT in payment month', async () => {
            const otherMonth = currentMonth === 6 ? 7 : 6;
            const expense = {
                id: 'exp-yearly-full-other',
                householdId: mockHouseholdId,
                createdById: mockUserId,
                name: 'Annual Fee',
                amount: { valueOf: () => 1200 },
                type: 'PERSONAL',
                category: 'RECURRING',
                frequency: 'YEARLY',
                paidByUserId: null,
                yearlyPaymentStrategy: 'FULL',
                installmentFrequency: null,
                paymentMonth: otherMonth,
                month: null,
                year: null,
                deletedAt: null,
            };

            mockPrismaService.expense.findMany.mockResolvedValue([expense]);
            const result = await service.getOverview(mockUserId);

            const alexExpense = result.expenses.personalExpenses.find((pe) => pe.userId === mockUserId);
            expect(alexExpense!.personalExpensesTotal).toBe(0);
        });

        it('should return amount/12 for YEARLY+INSTALLMENTS+MONTHLY', async () => {
            const expense = {
                id: 'exp-yearly-monthly',
                householdId: mockHouseholdId,
                createdById: mockUserId,
                name: 'Insurance Monthly',
                amount: { valueOf: () => 1200 },
                type: 'PERSONAL',
                category: 'RECURRING',
                frequency: 'YEARLY',
                paidByUserId: null,
                yearlyPaymentStrategy: 'INSTALLMENTS',
                installmentFrequency: 'MONTHLY',
                paymentMonth: null,
                month: null,
                year: null,
                deletedAt: null,
            };

            mockPrismaService.expense.findMany.mockResolvedValue([expense]);
            const result = await service.getOverview(mockUserId);

            const alexExpense = result.expenses.personalExpenses.find((pe) => pe.userId === mockUserId);
            expect(alexExpense!.personalExpensesTotal).toBe(100);
        });

        it('should return amount/4 for YEARLY+INSTALLMENTS+QUARTERLY in quarter month', async () => {
            // Use month 1 which is always a quarter month (1 % 3 === 1)
            const expense = {
                id: 'exp-yearly-quarterly',
                householdId: mockHouseholdId,
                createdById: mockUserId,
                name: 'Insurance Quarterly',
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

            mockPrismaService.expense.findMany.mockResolvedValue([expense]);

            // We need to test with a specific month. Since getOverview uses current month,
            // we verify based on whether current month is a quarter month.
            const result = await service.getOverview(mockUserId);
            const alexExpense = result.expenses.personalExpenses.find((pe) => pe.userId === mockUserId);

            if (currentMonth % 3 === 1) {
                expect(alexExpense!.personalExpensesTotal).toBe(300);
            } else {
                expect(alexExpense!.personalExpensesTotal).toBe(0);
            }
        });

        it('should return amount/2 for YEARLY+INSTALLMENTS+SEMI_ANNUAL in Jan or Jul', async () => {
            const expense = {
                id: 'exp-yearly-semi',
                householdId: mockHouseholdId,
                createdById: mockUserId,
                name: 'Insurance Semi-Annual',
                amount: { valueOf: () => 1200 },
                type: 'PERSONAL',
                category: 'RECURRING',
                frequency: 'YEARLY',
                paidByUserId: null,
                yearlyPaymentStrategy: 'INSTALLMENTS',
                installmentFrequency: 'SEMI_ANNUAL',
                paymentMonth: null,
                month: null,
                year: null,
                deletedAt: null,
            };

            mockPrismaService.expense.findMany.mockResolvedValue([expense]);

            const result = await service.getOverview(mockUserId);
            const alexExpense = result.expenses.personalExpenses.find((pe) => pe.userId === mockUserId);

            if (currentMonth === 1 || currentMonth === 7) {
                expect(alexExpense!.personalExpensesTotal).toBe(600);
            } else {
                expect(alexExpense!.personalExpensesTotal).toBe(0);
            }
        });

        it('should return full amount for ONE_TIME in matching month/year', async () => {
            const expense = {
                id: 'exp-onetime',
                householdId: mockHouseholdId,
                createdById: mockUserId,
                name: 'New Laptop',
                amount: { valueOf: () => 1500 },
                type: 'PERSONAL',
                category: 'ONE_TIME',
                frequency: 'MONTHLY',
                paidByUserId: null,
                yearlyPaymentStrategy: null,
                installmentFrequency: null,
                paymentMonth: null,
                month: currentMonth,
                year: currentYear,
                deletedAt: null,
            };

            mockPrismaService.expense.findMany.mockResolvedValue([expense]);
            const result = await service.getOverview(mockUserId);

            const alexExpense = result.expenses.personalExpenses.find((pe) => pe.userId === mockUserId);
            expect(alexExpense!.personalExpensesTotal).toBe(1500);
        });

        it('should return 0 for ONE_TIME in different month', async () => {
            const differentMonth = currentMonth === 12 ? 1 : currentMonth + 1;
            const expense = {
                id: 'exp-onetime-diff',
                householdId: mockHouseholdId,
                createdById: mockUserId,
                name: 'Old Laptop',
                amount: { valueOf: () => 1500 },
                type: 'PERSONAL',
                category: 'ONE_TIME',
                frequency: 'MONTHLY',
                paidByUserId: null,
                yearlyPaymentStrategy: null,
                installmentFrequency: null,
                paymentMonth: null,
                month: differentMonth,
                year: currentYear,
                deletedAt: null,
            };

            mockPrismaService.expense.findMany.mockResolvedValue([expense]);
            const result = await service.getOverview(mockUserId);

            const alexExpense = result.expenses.personalExpenses.find((pe) => pe.userId === mockUserId);
            expect(alexExpense!.personalExpensesTotal).toBe(0);
        });

        it('should return amount for MONTHLY recurring expense', async () => {
            const expense = {
                id: 'exp-monthly',
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
            };

            mockPrismaService.expense.findMany.mockResolvedValue([expense]);
            const result = await service.getOverview(mockUserId);

            const alexExpense = result.expenses.personalExpenses.find((pe) => pe.userId === mockUserId);
            expect(alexExpense!.personalExpensesTotal).toBe(50);
        });
    });

    describe('remaining expenses', () => {
        it('should calculate per-member remaining expenses (unpaid)', async () => {
            // Mark exp-1 (Gym, €50 by Alex) as paid
            mockPrismaService.expensePaymentStatus.findMany.mockResolvedValue([
                { expenseId: 'exp-1', month: currentMonth, year: currentYear, status: 'PAID' },
            ]);

            const result = await service.getOverview(mockUserId);

            const alexExpense = result.expenses.personalExpenses.find(pe => pe.userId === mockUserId);
            // Alex has Gym €50 (paid) → remaining = 0
            expect(alexExpense!.remainingExpenses).toBe(0);

            const samExpense = result.expenses.personalExpenses.find(pe => pe.userId === mockPartnerId);
            // Sam has Hairdresser €30 (unpaid) → remaining = 30
            expect(samExpense!.remainingExpenses).toBe(30);
        });

        it('should return all expenses as remaining when nothing is paid', async () => {
            const result = await service.getOverview(mockUserId);

            const alexExpense = result.expenses.personalExpenses.find(pe => pe.userId === mockUserId);
            expect(alexExpense!.remainingExpenses).toBe(50);

            const samExpense = result.expenses.personalExpenses.find(pe => pe.userId === mockPartnerId);
            expect(samExpense!.remainingExpenses).toBe(30);

            // All household expenses unpaid
            expect(result.expenses.remainingHouseholdExpenses).toBe(1000);
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

        it('should correctly handle yearly INSTALLMENTS QUARTERLY expense in quarter month', async () => {
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

            const alexExpense = result.expenses.personalExpenses.find((pe) => pe.userId === mockUserId);
            // Quarter months: 1, 4, 7, 10 → returns 1200/4 = 300
            // Non-quarter months → returns 0
            if (currentMonth % 3 === 1) {
                expect(alexExpense!.personalExpensesTotal).toBe(300);
            } else {
                expect(alexExpense!.personalExpensesTotal).toBe(0);
            }
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
