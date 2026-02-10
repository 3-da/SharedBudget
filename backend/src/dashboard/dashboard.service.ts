import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExpenseHelperService } from '../common/expense/expense-helper.service';
import {
    ApprovalStatus,
    ExpenseCategory,
    ExpenseFrequency,
    ExpenseType,
    InstallmentFrequency,
    PaymentStatus,
    YearlyPaymentStrategy,
} from '../generated/prisma/enums';
import { Expense } from '../generated/dto/expense/expense.entity';
import { DashboardResponseDto } from './dto/dashboard-response.dto';
import { SavingsResponseDto, MemberSavingsDto } from './dto/member-savings.dto';
import { SettlementResponseDto } from './dto/settlement-response.dto';
import { MarkSettlementPaidResponseDto } from './dto/mark-settlement-paid-response.dto';
import { MemberIncomeDto } from './dto/member-income.dto';
import { ExpenseSummaryDto, MemberExpenseSummaryDto } from './dto/expense-summary.dto';
import { CacheService } from '../common/cache/cache.service';

@Injectable()
export class DashboardService {
    private readonly logger = new Logger(DashboardService.name);

    constructor(
        private readonly prismaService: PrismaService,
        private readonly expenseHelper: ExpenseHelperService,
        private readonly cacheService: CacheService,
    ) {}

    /**
     * Returns a comprehensive financial dashboard for the authenticated user's household.
     * Aggregates income, expenses, savings, settlement, and pending approvals into a single response.
     *
     * Use case: User opens the main dashboard to see the full household financial picture at a glance.
     *
     * Scenario: Alex opens the dashboard and sees both Alex's and Sam's salaries, personal expenses,
     * shared expenses, individual savings, the combined household balance, who owes whom,
     * and how many pending approvals need attention.
     *
     * @param userId - The authenticated user's ID
     * @returns Complete household financial overview for the current month
     * @throws {NotFoundException} If the user is not a member of any household
     */
    async getOverview(userId: string, mode: 'monthly' | 'yearly' = 'monthly'): Promise<DashboardResponseDto> {
        this.logger.debug(`Get dashboard overview for user: ${userId}, mode: ${mode}`);

        const membership = await this.expenseHelper.requireMembership(userId);
        const { householdId } = membership;
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();

        const cacheKey = this.cacheService.dashboardKey(householdId, year, month) + `:${mode}`;

        return this.cacheService.getOrSet(cacheKey, this.cacheService.summaryTTL, async () => {
            if (mode === 'yearly') {
                return this.computeYearlyAverage(householdId, userId, month, year);
            }

            const [income, expenses, savings, settlement, pendingApprovalsCount] = await Promise.all([
                this.getIncomeData(householdId, month, year),
                this.getExpenseData(householdId, month, year),
                this.calculateSavings(householdId, month, year),
                this.calculateSettlement(householdId, userId, month, year),
                this.getPendingApprovalsCount(householdId, userId),
            ]);

            const totalDefaultIncome = income.reduce((sum, m) => sum + m.defaultSalary, 0);
            const totalCurrentIncome = income.reduce((sum, m) => sum + m.currentSalary, 0);

            return {
                income,
                totalDefaultIncome,
                totalCurrentIncome,
                expenses,
                savings,
                settlement,
                pendingApprovalsCount,
                month,
                year,
            };
        });
    }

    /**
     * Returns savings breakdown per member and combined household totals.
     *
     * Use case: User wants a focused view of how much each member is saving.
     *
     * Scenario: Sam checks the savings breakdown and sees that Alex saves €200
     * personal and €100 shared, with a combined household savings of €500.
     *
     * @param userId - The authenticated user's ID
     * @returns Savings per member with household totals
     * @throws {NotFoundException} If the user is not a member of any household
     */

    private async computeYearlyAverage(householdId: string, userId: string, currentMonth: number, currentYear: number): Promise<DashboardResponseDto> {
        const months: { month: number; year: number }[] = [];
        for (let i = 0; i < 12; i++) {
            let m = currentMonth - i;
            let y = currentYear;
            if (m <= 0) { m += 12; y -= 1; }
            months.push({ month: m, year: y });
        }

        const monthlyResults = await Promise.all(
            months.map(async ({ month, year }) => ({
                month,
                year,
                income: await this.getIncomeData(householdId, month, year),
                expenses: await this.getExpenseData(householdId, month, year),
                savings: await this.calculateSavings(householdId, month, year),
            })),
        );

        const firstIncome = monthlyResults[0].income;

        // Average incomes — only count months that have at least one salary entry
        const incomeMonths = monthlyResults.filter(r => r.income.some(i => i.currentSalary > 0 || i.defaultSalary > 0));
        const incomeCount = incomeMonths.length || 1;

        const avgIncome: MemberIncomeDto[] = firstIncome.map((member) => {
            const memberMonths = incomeMonths.filter(r => r.income.find(i => i.userId === member.userId && (i.currentSalary > 0 || i.defaultSalary > 0)));
            const memberCount = memberMonths.length || 1;
            const avgDefault = Math.round(memberMonths.reduce((sum, r) => {
                const m = r.income.find((i) => i.userId === member.userId);
                return sum + (m?.defaultSalary ?? 0);
            }, 0) / memberCount * 100) / 100;
            const avgCurrent = Math.round(memberMonths.reduce((sum, r) => {
                const m = r.income.find((i) => i.userId === member.userId);
                return sum + (m?.currentSalary ?? 0);
            }, 0) / memberCount * 100) / 100;

            return { ...member, defaultSalary: avgDefault, currentSalary: avgCurrent };
        });

        // Average expenses — only count months that have at least one expense
        const expenseMonths = monthlyResults.filter(r => r.expenses.totalHouseholdExpenses > 0);
        const expenseCount = expenseMonths.length || 1;

        const avgPersonalExpenses: MemberExpenseSummaryDto[] = monthlyResults[0].expenses.personalExpenses.map((pe) => {
            const peMonths = expenseMonths.filter(r => {
                const found = r.expenses.personalExpenses.find(p => p.userId === pe.userId);
                return found && found.personalExpensesTotal > 0;
            });
            const peCount = peMonths.length || 1;
            const avgTotal = Math.round(peMonths.reduce((sum, r) => {
                const found = r.expenses.personalExpenses.find((p) => p.userId === pe.userId);
                return sum + (found?.personalExpensesTotal ?? 0);
            }, 0) / peCount * 100) / 100;
            const avgRemaining = Math.round(peMonths.reduce((sum, r) => {
                const found = r.expenses.personalExpenses.find((p) => p.userId === pe.userId);
                return sum + (found?.remainingExpenses ?? 0);
            }, 0) / peCount * 100) / 100;
            return { ...pe, personalExpensesTotal: avgTotal, remainingExpenses: avgRemaining };
        });
        const avgSharedTotal = Math.round(expenseMonths.reduce((sum, r) => sum + r.expenses.sharedExpensesTotal, 0) / expenseCount * 100) / 100;
        const avgTotalHousehold = Math.round(expenseMonths.reduce((sum, r) => sum + r.expenses.totalHouseholdExpenses, 0) / expenseCount * 100) / 100;
        const avgRemainingHousehold = Math.round(expenseMonths.reduce((sum, r) => sum + r.expenses.remainingHouseholdExpenses, 0) / expenseCount * 100) / 100;

        // Average savings — only count months that have at least one saving record
        const savingsMonths = monthlyResults.filter(r => r.savings.totalSavings > 0);
        const savingsCount = savingsMonths.length || 1;

        const avgSavingsMembers: MemberSavingsDto[] = monthlyResults[0].savings.members.map((sm) => {
            const smMonths = savingsMonths.filter(r => {
                const found = r.savings.members.find(s => s.userId === sm.userId);
                return found && (found.personalSavings > 0 || found.sharedSavings > 0);
            });
            const smCount = smMonths.length || 1;
            const avgPersonal = Math.round(smMonths.reduce((sum, r) => {
                const found = r.savings.members.find((s) => s.userId === sm.userId);
                return sum + (found?.personalSavings ?? 0);
            }, 0) / smCount * 100) / 100;
            const avgShared = Math.round(smMonths.reduce((sum, r) => {
                const found = r.savings.members.find((s) => s.userId === sm.userId);
                return sum + (found?.sharedSavings ?? 0);
            }, 0) / smCount * 100) / 100;
            const avgBudget = Math.round(smMonths.reduce((sum, r) => {
                const found = r.savings.members.find((s) => s.userId === sm.userId);
                return sum + (found?.remainingBudget ?? 0);
            }, 0) / smCount * 100) / 100;
            return { ...sm, personalSavings: avgPersonal, sharedSavings: avgShared, remainingBudget: avgBudget };
        });

        const [settlement, pendingApprovalsCount] = await Promise.all([
            this.calculateSettlement(householdId, userId, currentMonth, currentYear),
            this.getPendingApprovalsCount(householdId, userId),
        ]);

        const totalDefaultIncome = avgIncome.reduce((sum, m) => sum + m.defaultSalary, 0);
        const totalCurrentIncome = avgIncome.reduce((sum, m) => sum + m.currentSalary, 0);

        return {
            income: avgIncome,
            totalDefaultIncome,
            totalCurrentIncome,
            expenses: {
                personalExpenses: avgPersonalExpenses,
                sharedExpensesTotal: avgSharedTotal,
                totalHouseholdExpenses: avgTotalHousehold,
                remainingHouseholdExpenses: avgRemainingHousehold,
            },
            savings: {
                members: avgSavingsMembers,
                totalPersonalSavings: Math.round(avgSavingsMembers.reduce((sum, m) => sum + m.personalSavings, 0) * 100) / 100,
                totalSharedSavings: Math.round(avgSavingsMembers.reduce((sum, m) => sum + m.sharedSavings, 0) * 100) / 100,
                totalSavings: Math.round(avgSavingsMembers.reduce((sum, m) => sum + m.personalSavings + m.sharedSavings, 0) * 100) / 100,
                totalRemainingBudget: Math.round(avgSavingsMembers.reduce((sum, m) => sum + m.remainingBudget, 0) * 100) / 100,
            },
            settlement,
            pendingApprovalsCount,
            month: currentMonth,
            year: currentYear,
        };
    }

    async getSavings(userId: string): Promise<SavingsResponseDto> {
        this.logger.debug(`Get savings for user: ${userId}`);

        const membership = await this.expenseHelper.requireMembership(userId);
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();

        const cacheKey = this.cacheService.savingsKey(membership.householdId, year, month);

        return this.cacheService.getOrSet(cacheKey, this.cacheService.summaryTTL, async () => {
            return this.calculateSavings(membership.householdId, month, year);
        });
    }

    /**
     * Calculates the current settlement between household members for the current month.
     * Determines who owes whom based on shared expense contributions.
     *
     * Use case: User checks the settlement section to see if they owe their partner
     * or if their partner owes them.
     *
     * Scenario: Alex and Sam share rent (€800 split equally) and electricity
     * (€120 paid by Alex alone). The settlement calculates that Sam owes Alex
     * €60 (half of the electricity that Alex paid in full).
     *
     * @param userId - The authenticated user's ID
     * @returns Settlement calculation with amount, direction, and message
     * @throws {NotFoundException} If the user is not a member of any household
     */
    async getSettlement(userId: string): Promise<SettlementResponseDto> {
        this.logger.debug(`Get settlement for user: ${userId}`);

        const membership = await this.expenseHelper.requireMembership(userId);
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();

        const cacheKey = this.cacheService.settlementKey(membership.householdId, year, month);

        return this.cacheService.getOrSet(cacheKey, this.cacheService.settlementTTL, async () => {
            return this.calculateSettlement(membership.householdId, userId, month, year);
        });
    }

    /**
     * Marks the current month's settlement as paid, creating an audit trail.
     * Only valid when there is an outstanding settlement amount and it hasn't
     * been marked as paid yet.
     *
     * Use case: After the person who owes money has paid their partner,
     * either member can mark the settlement as paid.
     *
     * Scenario: Sam owes Alex €125.50 this month. After Sam transfers the money,
     * Sam marks the settlement as paid. The system records the payment for audit purposes.
     *
     * @param userId - The authenticated user's ID
     * @returns The created settlement record
     * @throws {NotFoundException} If the user is not a member of any household
     * @throws {BadRequestException} If there is no settlement needed (amount is zero)
     * @throws {ConflictException} If the settlement has already been marked as paid this month
     */
    async markSettlementPaid(userId: string): Promise<MarkSettlementPaidResponseDto> {
        this.logger.log(`Mark settlement paid for user: ${userId}`);

        const membership = await this.expenseHelper.requireMembership(userId);
        const { householdId } = membership;
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();

        // Check if already settled this month
        const existing = await this.prismaService.settlement.findUnique({
            where: { householdId_month_year: { householdId, month, year } },
        });

        if (existing) {
            this.logger.warn(`Settlement already marked as paid for household: ${householdId}, month: ${month}/${year}`);
            throw new ConflictException('Settlement has already been marked as paid for this month');
        }

        // Calculate current settlement to determine who owes whom
        const settlement = await this.calculateSettlement(householdId, userId, month, year);

        if (settlement.amount === 0) {
            this.logger.warn(`No settlement needed for household: ${householdId}, month: ${month}/${year}`);
            throw new BadRequestException('No settlement needed — shared expenses are balanced');
        }

        const record = await this.prismaService.settlement.create({
            data: {
                householdId,
                month,
                year,
                amount: settlement.amount,
                paidByUserId: settlement.owedByUserId!,
                paidToUserId: settlement.owedToUserId!,
            },
        });

        this.logger.log(`Settlement marked as paid: ${record.id} for household: ${householdId}`);

        await this.cacheService.invalidateDashboard(householdId);

        return {
            id: record.id,
            householdId: record.householdId,
            month: record.month,
            year: record.year,
            amount: Number(record.amount),
            paidByUserId: record.paidByUserId,
            paidToUserId: record.paidToUserId,
            paidAt: record.paidAt,
        };
    }

    /**
     * Fetches income data (salaries) for all household members in a given period.
     */
    private async getIncomeData(householdId: string, month: number, year: number): Promise<MemberIncomeDto[]> {
        const members = await this.prismaService.householdMember.findMany({
            where: { householdId },
            include: { user: { select: { id: true, firstName: true, lastName: true } } },
        });

        const salaries = await this.prismaService.salary.findMany({
            where: { householdId, month, year },
        });

        const salaryMap = new Map(salaries.map((s) => [s.userId, s]));

        return members.map((member) => {
            const salary = salaryMap.get(member.userId);
            return {
                userId: member.userId,
                firstName: member.user.firstName,
                lastName: member.user.lastName,
                defaultSalary: salary ? Number(salary.defaultAmount) : 0,
                currentSalary: salary ? Number(salary.currentAmount) : 0,
            };
        });
    }

    /**
     * Aggregates expense data for the household in the current month.
     * Includes remaining (unpaid) expenses calculation.
     */
    private async getExpenseData(householdId: string, month: number, year: number): Promise<ExpenseSummaryDto> {
        const members = await this.prismaService.householdMember.findMany({
            where: { householdId },
            include: { user: { select: { id: true, firstName: true, lastName: true } } },
        });

        const expenses = await this.prismaService.expense.findMany({
            where: { householdId, deletedAt: null },
        });

        // Load payment statuses for this month to calculate remaining expenses
        const paymentStatuses = await this.prismaService.expensePaymentStatus.findMany({
            where: {
                expense: { householdId, deletedAt: null },
                month,
                year,
                status: PaymentStatus.PAID,
            },
        });
        const paidExpenseIds = new Set(paymentStatuses.map(p => p.expenseId));

        // Calculate personal expenses per member
        const personalExpenses: MemberExpenseSummaryDto[] = members.map((member) => {
            const memberExpenses = expenses.filter((e) => e.type === ExpenseType.PERSONAL && e.createdById === member.userId);
            const total = memberExpenses.reduce((sum, e) => sum + this.getMonthlyAmount(e, month, year), 0);
            const remaining = memberExpenses
                .filter(e => !paidExpenseIds.has(e.id))
                .reduce((sum, e) => sum + this.getMonthlyAmount(e, month, year), 0);

            return {
                userId: member.userId,
                firstName: member.user.firstName,
                lastName: member.user.lastName,
                personalExpensesTotal: Math.round(total * 100) / 100,
                remainingExpenses: Math.round(remaining * 100) / 100,
            };
        });

        // Calculate shared expenses total
        const sharedExpenses = expenses.filter((e) => e.type === ExpenseType.SHARED);
        const sharedExpensesTotal = Math.round(sharedExpenses.reduce((sum, e) => sum + this.getMonthlyAmount(e, month, year), 0) * 100) / 100;

        const totalPersonal = personalExpenses.reduce((sum, pe) => sum + pe.personalExpensesTotal, 0);
        const totalHouseholdExpenses = Math.round((totalPersonal + sharedExpensesTotal) * 100) / 100;

        // Calculate remaining household expenses (total - paid)
        const totalPaidPersonal = personalExpenses.reduce((sum, pe) => sum + pe.personalExpensesTotal - pe.remainingExpenses, 0);
        const paidShared = sharedExpenses
            .filter(e => paidExpenseIds.has(e.id))
            .reduce((sum, e) => sum + this.getMonthlyAmount(e, month, year), 0);
        const remainingHouseholdExpenses = Math.round((totalHouseholdExpenses - totalPaidPersonal - paidShared) * 100) / 100;

        return {
            personalExpenses,
            sharedExpensesTotal,
            totalHouseholdExpenses,
            remainingHouseholdExpenses,
        };
    }

    /**
     * Calculates savings from actual Saving records (personal + shared) and remaining budget per member.
     * Remaining budget = salary - personal expenses - shared expense share - personal savings - shared savings.
     */
    private async calculateSavings(householdId: string, month: number, year: number): Promise<SavingsResponseDto> {
        const [income, expenses, savingRecords] = await Promise.all([
            this.getIncomeData(householdId, month, year),
            this.getExpenseData(householdId, month, year),
            this.prismaService.saving.findMany({
                where: { householdId, month, year },
            }),
        ]);

        const memberCount = income.length || 1;

        const members: MemberSavingsDto[] = income.map((memberIncome) => {
            const personalTotal = expenses.personalExpenses.find((pe) => pe.userId === memberIncome.userId)?.personalExpensesTotal ?? 0;
            const sharedShare = expenses.sharedExpensesTotal / memberCount;

            // Actual savings from Saving records
            const personalSavingRecord = savingRecords.find((s) => s.userId === memberIncome.userId && !s.isShared);
            const sharedSavingRecord = savingRecords.find((s) => s.userId === memberIncome.userId && s.isShared);

            const personalSavings = personalSavingRecord ? Number(personalSavingRecord.amount) : 0;
            const sharedSavings = sharedSavingRecord ? Number(sharedSavingRecord.amount) : 0;

            // Remaining budget = salary - expenses - savings
            const remainingBudget = Math.round(
                (memberIncome.currentSalary - personalTotal - sharedShare - personalSavings - sharedSavings) * 100,
            ) / 100;

            return {
                userId: memberIncome.userId,
                firstName: memberIncome.firstName,
                lastName: memberIncome.lastName,
                personalSavings,
                sharedSavings,
                remainingBudget,
            };
        });

        const totalPersonalSavings = Math.round(members.reduce((sum, m) => sum + m.personalSavings, 0) * 100) / 100;
        const totalSharedSavings = Math.round(members.reduce((sum, m) => sum + m.sharedSavings, 0) * 100) / 100;
        const totalSavings = Math.round((totalPersonalSavings + totalSharedSavings) * 100) / 100;
        const totalRemainingBudget = Math.round(members.reduce((sum, m) => sum + m.remainingBudget, 0) * 100) / 100;

        return {
            members,
            totalPersonalSavings,
            totalSharedSavings,
            totalSavings,
            totalRemainingBudget,
        };
    }

    /**
     * Calculates who owes whom based on shared expenses.
     * For Phase 1 (2 people): determines net settlement between the two members.
     *
     * For each shared expense:
     * - If paidByUserId is null (split equally): each member's share = amount / memberCount
     * - If paidByUserId is set: that user pays the full amount, their share is 0 from others
     *
     * The payer "credits" are tracked: if a user pays more than their fair share, the other owes them.
     */
    private async calculateSettlement(householdId: string, requestingUserId: string, month: number, year: number): Promise<SettlementResponseDto> {
        const members = await this.prismaService.householdMember.findMany({
            where: { householdId },
            include: { user: { select: { id: true, firstName: true, lastName: true } } },
        });

        const sharedExpenses = await this.prismaService.expense.findMany({
            where: { householdId, type: ExpenseType.SHARED, deletedAt: null },
        });

        // Check if already settled
        const existingSettlement = await this.prismaService.settlement.findUnique({
            where: { householdId_month_year: { householdId, month, year } },
        });

        const memberCount = members.length || 1;

        // Track how much each member has paid and what their fair share is
        const paid: Record<string, number> = {};
        const fairShare: Record<string, number> = {};

        for (const member of members) {
            paid[member.userId] = 0;
            fairShare[member.userId] = 0;
        }

        for (const expense of sharedExpenses) {
            const monthlyAmount = this.getMonthlyAmount(expense, month, year);

            if (expense.paidByUserId) {
                // One person pays the full amount
                if (paid[expense.paidByUserId] !== undefined) {
                    paid[expense.paidByUserId] += monthlyAmount;
                }
            } else {
                // Split equally — each pays their share
                for (const member of members) {
                    paid[member.userId] += monthlyAmount / memberCount;
                }
            }

            // Everyone's fair share is equal regardless of who pays
            for (const member of members) {
                fairShare[member.userId] += monthlyAmount / memberCount;
            }
        }

        // Calculate net balance: paid - fairShare
        // Positive = overpaid (is owed money), Negative = underpaid (owes money)
        const balances: Array<{ userId: string; firstName: string; lastName: string; balance: number }> = members.map((m) => ({
            userId: m.userId,
            firstName: m.user.firstName,
            lastName: m.user.lastName,
            balance: Math.round((paid[m.userId] - fairShare[m.userId]) * 100) / 100,
        }));

        // For Phase 1 (2 people): find who owes whom
        const creditor = balances.find((b) => b.balance > 0);
        const debtor = balances.find((b) => b.balance < 0);

        if (!creditor || !debtor || creditor.balance === 0) {
            // No settlement needed — expenses are balanced
            return {
                amount: 0,
                owedByUserId: null,
                owedByFirstName: null,
                owedToUserId: null,
                owedToFirstName: null,
                message: 'All shared expenses are balanced — no settlement needed.',
                isSettled: !!existingSettlement,
                month,
                year,
            };
        }

        const amount = Math.round(creditor.balance * 100) / 100;

        // Build message relative to the requesting user
        let message: string;
        if (debtor.userId === requestingUserId) {
            message = `You owe ${creditor.firstName} €${amount.toFixed(2)}`;
        } else if (creditor.userId === requestingUserId) {
            message = `${debtor.firstName} owes you €${amount.toFixed(2)}`;
        } else {
            message = `${debtor.firstName} owes ${creditor.firstName} €${amount.toFixed(2)}`;
        }

        return {
            amount,
            owedByUserId: debtor.userId,
            owedByFirstName: debtor.firstName,
            owedToUserId: creditor.userId,
            owedToFirstName: creditor.firstName,
            message,
            isSettled: !!existingSettlement,
            month,
            year,
        };
    }

    /**
     * Returns the monthly-equivalent amount for an expense.
     * - MONTHLY expenses: return amount directly
     * - YEARLY expenses with FULL payment: return amount only in the designated payment month
     * - YEARLY expenses with INSTALLMENTS: return amount/installmentCount only in installment months
     * - ONE_TIME expenses: return amount only if it falls in the given month/year, else 0
     */
    private getMonthlyAmount(expense: Expense, month: number, year: number): number {
        const amount = Number(expense.amount);

        if (expense.category === ExpenseCategory.ONE_TIME) {
            // One-time expenses only count in their specific month/year
            if (expense.month === month && expense.year === year) {
                return amount;
            }
            return 0;
        }

        // Recurring expenses
        if (expense.frequency === ExpenseFrequency.YEARLY) {
            if (expense.yearlyPaymentStrategy === YearlyPaymentStrategy.FULL) {
                // Full yearly payment: only in the designated payment month
                return expense.paymentMonth === month ? amount : 0;
            }

            // Installment strategy
            if (expense.yearlyPaymentStrategy === YearlyPaymentStrategy.INSTALLMENTS) {
                switch (expense.installmentFrequency) {
                    case InstallmentFrequency.MONTHLY:
                        return amount / 12;
                    case InstallmentFrequency.QUARTERLY:
                        // Every 3 months: Jan(1), Apr(4), Jul(7), Oct(10)
                        return month % 3 === 1 ? amount / 4 : 0;
                    case InstallmentFrequency.SEMI_ANNUAL:
                        // Every 6 months: Jan(1) and Jul(7)
                        return month === 1 || month === 7 ? amount / 2 : 0;
                    default:
                        return amount / 12;
                }
            }

            // Fallback for yearly without strategy set
            return amount / 12;
        }

        // Monthly recurring
        return amount;
    }

    /**
     * Counts pending approvals for the household, excluding those created by the requesting user.
     * The creator should not see a notification for their own proposals.
     */
    private async getPendingApprovalsCount(householdId: string, userId?: string): Promise<number> {
        const where: any = {
            householdId,
            status: ApprovalStatus.PENDING,
        };

        if (userId) {
            where.requestedById = { not: userId };
        }

        return this.prismaService.expenseApproval.count({ where });
    }
}
