import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { DashboardCalculatorService } from './dashboard-calculator.service';
import { PrismaService } from '../prisma/prisma.service';
import { ExpenseHelperService } from '../common/expense/expense-helper.service';

describe('DashboardCalculatorService', () => {
    let service: DashboardCalculatorService;

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

    // Pre-filtered shared expenses for use in calculateSettlement tests
    const mockSharedExpenses = mockExpenses.filter((e) => e.type === 'SHARED');

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

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                DashboardCalculatorService,
                { provide: PrismaService, useValue: mockPrismaService },
                { provide: ExpenseHelperService, useValue: mockExpenseHelper },
            ],
        }).compile();

        service = module.get<DashboardCalculatorService>(DashboardCalculatorService);

        vi.clearAllMocks();

        // Default mocks — only for queries still made inside calculator methods
        mockPrismaService.salary.findMany.mockResolvedValue(mockSalaries);
        mockPrismaService.expenseApproval.count.mockResolvedValue(2);
        mockPrismaService.expensePaymentStatus.findMany.mockResolvedValue([]);
        mockPrismaService.settlement.findUnique.mockResolvedValue(null);
        mockPrismaService.saving.findMany.mockResolvedValue([]);
    });

    describe('getIncomeData', () => {
        it('should return income data for all household members', async () => {
            const result = await service.getIncomeData(mockMembers as any, currentMonth, currentYear);

            expect(result).toHaveLength(2);
            expect(result[0].userId).toBe(mockUserId);
            expect(result[0].defaultSalary).toBe(3500);
            expect(result[0].currentSalary).toBe(3200);
            expect(result[1].userId).toBe(mockPartnerId);
            expect(result[1].defaultSalary).toBe(2500);
            expect(result[1].currentSalary).toBe(2500);
        });

        it('should return zero salary for members without salary records', async () => {
            mockPrismaService.salary.findMany.mockResolvedValue([]);

            const result = await service.getIncomeData(mockMembers as any, currentMonth, currentYear);

            expect(result[0].defaultSalary).toBe(0);
            expect(result[0].currentSalary).toBe(0);
        });

        it('should return empty array when household has no members', async () => {
            const result = await service.getIncomeData([], currentMonth, currentYear);

            expect(result).toHaveLength(0);
        });
    });

    describe('getExpenseData', () => {
        it('should aggregate personal and shared expenses correctly', async () => {
            const result = await service.getExpenseData(mockMembers as any, mockExpenses as any, currentMonth, currentYear);

            expect(result.personalExpenses).toHaveLength(2);
            const alexExpense = result.personalExpenses.find((pe) => pe.userId === mockUserId);
            expect(alexExpense!.personalExpensesTotal).toBe(50);
            const samExpense = result.personalExpenses.find((pe) => pe.userId === mockPartnerId);
            expect(samExpense!.personalExpensesTotal).toBe(30);

            expect(result.sharedExpensesTotal).toBe(920);
            expect(result.totalHouseholdExpenses).toBe(1000);
        });

        it('should calculate remaining expenses excluding paid ones', async () => {
            mockPrismaService.expensePaymentStatus.findMany.mockResolvedValue([{ expenseId: 'exp-1', month: currentMonth, year: currentYear, status: 'PAID' }]);

            const result = await service.getExpenseData(mockMembers as any, mockExpenses as any, currentMonth, currentYear);

            const alexExpense = result.personalExpenses.find((pe) => pe.userId === mockUserId);
            expect(alexExpense!.remainingExpenses).toBe(0); // Gym is paid
            expect(result.remainingHouseholdExpenses).toBe(950); // 1000 - 50
        });

        it('should return all expenses as remaining when nothing is paid', async () => {
            const result = await service.getExpenseData(mockMembers as any, mockExpenses as any, currentMonth, currentYear);

            expect(result.remainingHouseholdExpenses).toBe(1000);
        });

        it('should return zero totals when no expenses exist', async () => {
            const result = await service.getExpenseData(mockMembers as any, [], currentMonth, currentYear);

            expect(result.sharedExpensesTotal).toBe(0);
            expect(result.totalHouseholdExpenses).toBe(0);
            expect(result.remainingHouseholdExpenses).toBe(0);
        });
    });

    describe('calculateSavings', () => {
        it('should return zero savings when no saving records exist', async () => {
            const result = await service.calculateSavings(mockMembers as any, mockExpenses as any, currentMonth, currentYear);

            expect(result.totalPersonalSavings).toBe(0);
            expect(result.totalSharedSavings).toBe(0);
            expect(result.totalSavings).toBe(0);
        });

        it('should calculate savings from actual saving records', async () => {
            mockPrismaService.saving.findMany.mockResolvedValue([
                { userId: mockUserId, amount: { valueOf: () => 500 }, isShared: false },
                { userId: mockUserId, amount: { valueOf: () => 200 }, isShared: true },
                { userId: mockPartnerId, amount: { valueOf: () => 300 }, isShared: false },
            ]);

            const result = await service.calculateSavings(mockMembers as any, mockExpenses as any, currentMonth, currentYear);

            expect(result.totalPersonalSavings).toBe(800);
            expect(result.totalSharedSavings).toBe(200);
            expect(result.totalSavings).toBe(1000);
        });

        it('should calculate remaining budget correctly', async () => {
            const result = await service.calculateSavings(mockMembers as any, mockExpenses as any, currentMonth, currentYear);

            // Alex: 3200 - 50 - 460 - 0 - 0 = 2690
            // Sam: 2500 - 30 - 460 - 0 - 0 = 2010
            expect(result.totalRemainingBudget).toBe(4700);
        });

        it('should subtract savings from remaining budget', async () => {
            mockPrismaService.saving.findMany.mockResolvedValue([{ userId: mockUserId, amount: { valueOf: () => 1000 }, isShared: false }]);

            const result = await service.calculateSavings(mockMembers as any, mockExpenses as any, currentMonth, currentYear);

            const alexSavings = result.members.find((m) => m.userId === mockUserId);
            // 3200 - 50 - 460 - 1000 - 0 = 1690
            expect(alexSavings!.remainingBudget).toBe(1690);
        });

        it('should handle negative remaining budget', async () => {
            mockPrismaService.salary.findMany.mockResolvedValue([
                { ...mockSalaries[0], defaultAmount: { valueOf: () => 100 }, currentAmount: { valueOf: () => 100 } },
                { ...mockSalaries[1], defaultAmount: { valueOf: () => 100 }, currentAmount: { valueOf: () => 100 } },
            ]);

            const result = await service.calculateSavings(mockMembers as any, mockExpenses as any, currentMonth, currentYear);

            const alexSavings = result.members.find((m) => m.userId === mockUserId);
            // 100 - 50 - 460 - 0 - 0 = -410
            expect(alexSavings!.remainingBudget).toBe(-410);
        });
    });

    describe('calculateSettlement', () => {
        it('should calculate settlement when one member pays full for shared expense', async () => {
            const result = await service.calculateSettlement(mockMembers as any, mockSharedExpenses as any, mockUserId, currentMonth, currentYear);

            expect(result.amount).toBe(60);
            expect(result.owedByUserId).toBe(mockPartnerId);
            expect(result.owedToUserId).toBe(mockUserId);
            expect(result.message).toBe('Sam owes you €60.00');
        });

        it('should return zero settlement when all expenses are split equally', async () => {
            const splitOnlySharedExpenses = mockSharedExpenses.filter((e) => e.paidByUserId === null);

            const result = await service.calculateSettlement(mockMembers as any, splitOnlySharedExpenses as any, mockUserId, currentMonth, currentYear);

            expect(result.amount).toBe(0);
            expect(result.message).toBe('All shared expenses are balanced — no settlement needed.');
        });

        it('should show relative message when requesting user owes money', async () => {
            const result = await service.calculateSettlement(mockMembers as any, mockSharedExpenses as any, mockPartnerId, currentMonth, currentYear);

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

            const result = await service.calculateSettlement(mockMembers as any, mockSharedExpenses as any, mockUserId, currentMonth, currentYear);

            expect(result.isSettled).toBe(true);
        });

        it('should show third-party message when neither party is requesting', async () => {
            const result = await service.calculateSettlement(mockMembers as any, mockSharedExpenses as any, 'user-jordan', currentMonth, currentYear);

            expect(result.message).toBe('Sam owes Alex €60.00');
        });
    });

    describe('getPendingApprovalsCount', () => {
        it('should return count of pending approvals excluding own', async () => {
            mockPrismaService.expenseApproval.count.mockResolvedValue(5);

            const result = await service.getPendingApprovalsCount(mockHouseholdId, mockUserId);

            expect(result).toBe(5);
            expect(mockPrismaService.expenseApproval.count).toHaveBeenCalledWith({
                where: {
                    householdId: mockHouseholdId,
                    status: 'PENDING',
                    requestedById: { not: mockUserId },
                },
            });
        });

        it('should return count without exclusion when userId is not provided', async () => {
            mockPrismaService.expenseApproval.count.mockResolvedValue(3);

            const result = await service.getPendingApprovalsCount(mockHouseholdId);

            expect(result).toBe(3);
            expect(mockPrismaService.expenseApproval.count).toHaveBeenCalledWith({
                where: {
                    householdId: mockHouseholdId,
                    status: 'PENDING',
                },
            });
        });

        it('should return zero when no pending approvals exist', async () => {
            mockPrismaService.expenseApproval.count.mockResolvedValue(0);

            const result = await service.getPendingApprovalsCount(mockHouseholdId, mockUserId);

            expect(result).toBe(0);
        });
    });

    describe('getMonthlyAmount', () => {
        it('should return full amount for MONTHLY recurring expense', () => {
            const expense = {
                amount: { valueOf: () => 50 },
                category: 'RECURRING',
                frequency: 'MONTHLY',
                yearlyPaymentStrategy: null,
                installmentFrequency: null,
                paymentMonth: null,
                month: null,
                year: null,
            } as any;

            expect(service.getMonthlyAmount(expense, currentMonth, currentYear)).toBe(50);
        });

        it('should return full amount for YEARLY+FULL in payment month', () => {
            const expense = {
                amount: { valueOf: () => 1200 },
                category: 'RECURRING',
                frequency: 'YEARLY',
                yearlyPaymentStrategy: 'FULL',
                paymentMonth: 3,
                installmentFrequency: null,
                month: null,
                year: null,
            } as any;

            expect(service.getMonthlyAmount(expense, 3, 2026)).toBe(1200);
        });

        it('should return 0 for YEARLY+FULL NOT in payment month', () => {
            const expense = {
                amount: { valueOf: () => 1200 },
                category: 'RECURRING',
                frequency: 'YEARLY',
                yearlyPaymentStrategy: 'FULL',
                paymentMonth: 3,
                installmentFrequency: null,
                month: null,
                year: null,
            } as any;

            expect(service.getMonthlyAmount(expense, 5, 2026)).toBe(0);
        });

        it('should return amount/12 for YEARLY+INSTALLMENTS+MONTHLY', () => {
            const expense = {
                amount: { valueOf: () => 1200 },
                category: 'RECURRING',
                frequency: 'YEARLY',
                yearlyPaymentStrategy: 'INSTALLMENTS',
                installmentFrequency: 'MONTHLY',
                paymentMonth: null,
                month: null,
                year: null,
                createdAt: new Date('2025-01-15'),
            } as any;

            expect(service.getMonthlyAmount(expense, currentMonth, currentYear)).toBe(100);
        });

        it('should return amount/4 for YEARLY+INSTALLMENTS+QUARTERLY in installment month', () => {
            const expense = {
                amount: { valueOf: () => 1200 },
                category: 'RECURRING',
                frequency: 'YEARLY',
                yearlyPaymentStrategy: 'INSTALLMENTS',
                installmentFrequency: 'QUARTERLY',
                paymentMonth: null,
                month: null,
                year: null,
                createdAt: now, // anchor to current month
            } as any;

            // Current month is an installment month since anchor = current month
            expect(service.getMonthlyAmount(expense, currentMonth, currentYear)).toBe(300);
        });

        it('should return 0 for YEARLY+INSTALLMENTS+QUARTERLY in non-installment month', () => {
            // Anchor to month 1, so installment months are 1, 4, 7, 10
            const expense = {
                amount: { valueOf: () => 1200 },
                category: 'RECURRING',
                frequency: 'YEARLY',
                yearlyPaymentStrategy: 'INSTALLMENTS',
                installmentFrequency: 'QUARTERLY',
                paymentMonth: null,
                month: null,
                year: null,
                createdAt: new Date('2025-01-15'), // anchor month = 1
            } as any;

            // Month 2 is not an installment month (1, 4, 7, 10 are)
            expect(service.getMonthlyAmount(expense, 2, 2026)).toBe(0);
        });

        it('should return amount/2 for YEARLY+INSTALLMENTS+SEMI_ANNUAL in installment month', () => {
            const expense = {
                amount: { valueOf: () => 1200 },
                category: 'RECURRING',
                frequency: 'YEARLY',
                yearlyPaymentStrategy: 'INSTALLMENTS',
                installmentFrequency: 'SEMI_ANNUAL',
                paymentMonth: null,
                month: null,
                year: null,
                createdAt: now, // anchor to current month
            } as any;

            expect(service.getMonthlyAmount(expense, currentMonth, currentYear)).toBe(600);
        });

        it('should return amount/12 as fallback for YEARLY without strategy', () => {
            const expense = {
                amount: { valueOf: () => 1200 },
                category: 'RECURRING',
                frequency: 'YEARLY',
                yearlyPaymentStrategy: null,
                installmentFrequency: null,
                paymentMonth: null,
                month: null,
                year: null,
            } as any;

            expect(service.getMonthlyAmount(expense, currentMonth, currentYear)).toBe(100);
        });

        it('should return full amount for ONE_TIME in matching month/year', () => {
            const expense = {
                amount: { valueOf: () => 1500 },
                category: 'ONE_TIME',
                frequency: 'MONTHLY',
                yearlyPaymentStrategy: null,
                installmentFrequency: null,
                paymentMonth: null,
                month: 3,
                year: 2026,
            } as any;

            expect(service.getMonthlyAmount(expense, 3, 2026)).toBe(1500);
        });

        it('should return 0 for ONE_TIME in different month', () => {
            const expense = {
                amount: { valueOf: () => 1500 },
                category: 'ONE_TIME',
                frequency: 'MONTHLY',
                yearlyPaymentStrategy: null,
                installmentFrequency: null,
                paymentMonth: null,
                month: 3,
                year: 2026,
            } as any;

            expect(service.getMonthlyAmount(expense, 5, 2026)).toBe(0);
        });

        it('should return 0 for ONE_TIME in different year', () => {
            const expense = {
                amount: { valueOf: () => 1500 },
                category: 'ONE_TIME',
                frequency: 'MONTHLY',
                yearlyPaymentStrategy: null,
                installmentFrequency: null,
                paymentMonth: null,
                month: 3,
                year: 2025,
            } as any;

            expect(service.getMonthlyAmount(expense, 3, 2026)).toBe(0);
        });

        it('should return amount/installmentCount for ONE_TIME+INSTALLMENTS+MONTHLY in start month', () => {
            const expense = {
                amount: { valueOf: () => 1200 },
                category: 'ONE_TIME',
                frequency: 'MONTHLY',
                yearlyPaymentStrategy: 'INSTALLMENTS',
                installmentFrequency: 'MONTHLY',
                installmentCount: 24,
                paymentMonth: null,
                month: 1,
                year: 2026,
            } as any;

            expect(service.getMonthlyAmount(expense, 1, 2026)).toBe(50); // 1200/24
        });

        it('should return 0 for ONE_TIME+INSTALLMENTS before start month', () => {
            const expense = {
                amount: { valueOf: () => 600 },
                category: 'ONE_TIME',
                frequency: 'MONTHLY',
                yearlyPaymentStrategy: 'INSTALLMENTS',
                installmentFrequency: 'MONTHLY',
                installmentCount: 12,
                paymentMonth: null,
                month: 6,
                year: 2026,
            } as any;

            expect(service.getMonthlyAmount(expense, 5, 2026)).toBe(0);
        });

        it('should return 0 for ONE_TIME+INSTALLMENTS after all installments are done', () => {
            const expense = {
                amount: { valueOf: () => 300 },
                category: 'ONE_TIME',
                frequency: 'MONTHLY',
                yearlyPaymentStrategy: 'INSTALLMENTS',
                installmentFrequency: 'MONTHLY',
                installmentCount: 3,
                paymentMonth: null,
                month: 1,
                year: 2026,
            } as any;

            // 3 monthly installments: Jan, Feb, Mar 2026. April should be 0.
            expect(service.getMonthlyAmount(expense, 4, 2026)).toBe(0);
        });

        it('should return amount/installmentCount for ONE_TIME+INSTALLMENTS+QUARTERLY in quarter month', () => {
            const expense = {
                amount: { valueOf: () => 800 },
                category: 'ONE_TIME',
                frequency: 'MONTHLY',
                yearlyPaymentStrategy: 'INSTALLMENTS',
                installmentFrequency: 'QUARTERLY',
                installmentCount: 8,
                paymentMonth: null,
                month: 1,
                year: 2026,
            } as any;

            // First installment: month 1
            expect(service.getMonthlyAmount(expense, 1, 2026)).toBe(100); // 800/8
            // Second installment: month 4
            expect(service.getMonthlyAmount(expense, 4, 2026)).toBe(100);
            // Non-installment month
            expect(service.getMonthlyAmount(expense, 2, 2026)).toBe(0);
        });
    });

    describe('isInstallmentMonth', () => {
        it('should return true for anchor month itself', () => {
            expect(service.isInstallmentMonth(2, 2, 3)).toBe(true);
        });

        it('should return true for anchor + step months', () => {
            // Anchor Feb (2), step 3 -> Feb, May, Aug, Nov
            expect(service.isInstallmentMonth(5, 2, 3)).toBe(true);
            expect(service.isInstallmentMonth(8, 2, 3)).toBe(true);
            expect(service.isInstallmentMonth(11, 2, 3)).toBe(true);
        });

        it('should return false for non-installment months', () => {
            expect(service.isInstallmentMonth(3, 2, 3)).toBe(false);
            expect(service.isInstallmentMonth(4, 2, 3)).toBe(false);
        });

        it('should handle wrap-around correctly (anchor > month)', () => {
            // Anchor Nov (11), step 6 -> Nov, May
            expect(service.isInstallmentMonth(5, 11, 6)).toBe(true);
            expect(service.isInstallmentMonth(11, 11, 6)).toBe(true);
            expect(service.isInstallmentMonth(3, 11, 6)).toBe(false);
        });
    });

    describe('getStepMonths', () => {
        it('should return 1 for MONTHLY', () => {
            expect(service.getStepMonths('MONTHLY' as any)).toBe(1);
        });

        it('should return 3 for QUARTERLY', () => {
            expect(service.getStepMonths('QUARTERLY' as any)).toBe(3);
        });

        it('should return 6 for SEMI_ANNUAL', () => {
            expect(service.getStepMonths('SEMI_ANNUAL' as any)).toBe(6);
        });

        it('should return 1 as default for unknown frequency', () => {
            expect(service.getStepMonths('UNKNOWN' as any)).toBe(1);
        });
    });

    describe('getOneTimeInstallmentAmount', () => {
        it('should return per-installment amount at start month', () => {
            const expense = {
                month: 1,
                year: 2026,
                installmentCount: 12,
                installmentFrequency: 'MONTHLY',
            } as any;

            expect(service.getOneTimeInstallmentAmount(expense, 1200, 1, 2026)).toBe(100);
        });

        it('should return 0 before start month', () => {
            const expense = {
                month: 6,
                year: 2026,
                installmentCount: 12,
                installmentFrequency: 'MONTHLY',
            } as any;

            expect(service.getOneTimeInstallmentAmount(expense, 1200, 5, 2026)).toBe(0);
        });

        it('should return 0 after all installments are done', () => {
            const expense = {
                month: 1,
                year: 2026,
                installmentCount: 3,
                installmentFrequency: 'MONTHLY',
            } as any;

            expect(service.getOneTimeInstallmentAmount(expense, 300, 4, 2026)).toBe(0);
        });

        it('should return 0 for non-step months in quarterly installments', () => {
            const expense = {
                month: 1,
                year: 2026,
                installmentCount: 4,
                installmentFrequency: 'QUARTERLY',
            } as any;

            expect(service.getOneTimeInstallmentAmount(expense, 400, 2, 2026)).toBe(0);
        });

        it('should handle installments crossing year boundary', () => {
            const expense = {
                month: 11,
                year: 2025,
                installmentCount: 6,
                installmentFrequency: 'MONTHLY',
            } as any;

            // Nov 2025 through Apr 2026
            expect(service.getOneTimeInstallmentAmount(expense, 600, 1, 2026)).toBe(100);
            expect(service.getOneTimeInstallmentAmount(expense, 600, 4, 2026)).toBe(100);
            expect(service.getOneTimeInstallmentAmount(expense, 600, 5, 2026)).toBe(0); // past count
        });

        it('should round to 2 decimal places', () => {
            const expense = {
                month: 1,
                year: 2026,
                installmentCount: 3,
                installmentFrequency: 'MONTHLY',
            } as any;

            // 100 / 3 = 33.333... -> 33.33
            expect(service.getOneTimeInstallmentAmount(expense, 100, 1, 2026)).toBe(33.33);
        });
    });
});
