import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExpenseHelperService } from '../common/expense/expense-helper.service';
import { DashboardResponseDto } from './dto/dashboard-response.dto';
import { MemberSavingsDto, SavingsResponseDto } from './dto/member-savings.dto';
import { SavingsHistoryItemDto } from './dto/savings-history.dto';
import { SettlementResponseDto } from './dto/settlement-response.dto';
import { MarkSettlementPaidResponseDto } from './dto/mark-settlement-paid-response.dto';
import { MemberIncomeDto } from './dto/member-income.dto';
import { ExpenseSummaryDto, MemberExpenseSummaryDto } from './dto/expense-summary.dto';
import { CacheService } from '../common/cache/cache.service';
import { DashboardCalculatorService } from './dashboard-calculator.service';
import { resolveMonthYear } from '../common/utils/resolve-month-year';
import { roundCurrency } from '../common/utils/round-currency';
import { ExpenseType } from '../generated/prisma/enums';

type MonthlyResult = {
    month: number;
    year: number;
    income: MemberIncomeDto[];
    expenses: ExpenseSummaryDto;
    savings: SavingsResponseDto;
};

@Injectable()
export class DashboardService {
    private readonly logger = new Logger(DashboardService.name);

    constructor(
        private readonly prismaService: PrismaService,
        private readonly expenseHelper: ExpenseHelperService,
        private readonly cacheService: CacheService,
        private readonly calculator: DashboardCalculatorService,
    ) {}

    /**
     * Pre-fetches members and expenses for a household in a single parallel query.
     * Provides the base data required by all calculator methods, eliminating redundant
     * per-method DB queries.
     *
     * @param householdId - The household to pre-fetch data for
     * @returns Members (with user info), all expenses, and shared-only expenses
     */
    private async fetchBaseData(householdId: string) {
        const [members, expenses] = await Promise.all([
            this.prismaService.householdMember.findMany({
                where: { householdId },
                include: { user: { select: { id: true, firstName: true, lastName: true } } },
            }),
            this.prismaService.expense.findMany({ where: { householdId } }),
        ]);
        return { members, expenses, sharedExpenses: expenses.filter((e) => e.type === ExpenseType.SHARED) };
    }

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
     * @param mode - View mode: 'monthly' for single month, 'yearly' for 12-month average
     * @param {number} [reqMonth] - Optional month override (1-12)
     * @param {number} [reqYear] - Optional year override
     * @returns Complete household financial overview for the current month
     * @throws NotFoundException If the user is not a member of any household
     */
    async getOverview(userId: string, mode: 'monthly' | 'yearly' = 'monthly', reqMonth?: number, reqYear?: number): Promise<DashboardResponseDto> {
        this.logger.debug(`Get dashboard overview for user: ${userId}, mode: ${mode}`);

        const membership = await this.expenseHelper.requireMembership(userId);
        const { householdId } = membership;
        const { month, year } = resolveMonthYear(reqMonth, reqYear);

        const cacheKey = this.cacheService.dashboardKey(householdId, year, month) + `:${mode}`;

        return this.cacheService.getOrSet(cacheKey, this.cacheService.summaryTTL, async () => {
            if (mode === 'yearly') {
                return this.computeYearlyAverageInternal(householdId, userId, month, year);
            }

            const { members, expenses, sharedExpenses } = await this.fetchBaseData(householdId);

            const [income, expenseData, savings, settlement, pendingApprovalsCount] = await Promise.all([
                this.calculator.getIncomeData(members, month, year),
                this.calculator.getExpenseData(members, expenses, month, year),
                this.calculator.calculateSavings(members, expenses, month, year),
                this.calculator.calculateSettlement(members, sharedExpenses, userId, month, year),
                this.calculator.getPendingApprovalsCount(householdId, userId),
            ]);

            const totalDefaultIncome = income.reduce((sum, m) => sum + m.defaultSalary, 0);
            const totalCurrentIncome = income.reduce((sum, m) => sum + m.currentSalary, 0);

            return {
                income,
                totalDefaultIncome,
                totalCurrentIncome,
                expenses: expenseData,
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
     * @param reqMonth - Optional month override (1-12)
     * @param reqYear - Optional year override
     * @returns Savings per member with household totals
     * @throws NotFoundException If the user is not a member of any household
     */

    async getSavings(userId: string, reqMonth?: number, reqYear?: number): Promise<SavingsResponseDto> {
        this.logger.debug(`Get savings for user: ${userId}`);

        const membership = await this.expenseHelper.requireMembership(userId);
        const { month, year } = resolveMonthYear(reqMonth, reqYear);

        const cacheKey = this.cacheService.savingsKey(membership.householdId, year, month);

        return this.cacheService.getOrSet(cacheKey, this.cacheService.summaryTTL, async () => {
            const { members, expenses } = await this.fetchBaseData(membership.householdId);
            return this.calculator.calculateSavings(members, expenses, month, year);
        });
    }

    /**
     * Returns monthly savings totals (personal and shared) for the past 12 months.
     * Data is aggregated at the household level, not per member.
     *
     * Use case: User views a line chart on the dashboard showing how household
     * savings have trended over the past year.
     *
     * Scenario: Alex opens the savings history chart and sees that personal savings
     * peaked in March at EUR 800 and shared savings have been steadily growing
     * since September.
     *
     * @param userId - The authenticated user's ID
     * @returns Array of 12 monthly savings items ordered chronologically (oldest first)
     * @throws NotFoundException If the user is not a member of any household
     */
    async getSavingsHistory(userId: string): Promise<SavingsHistoryItemDto[]> {
        this.logger.debug(`Get savings history for user: ${userId}`);

        const membership = await this.expenseHelper.requireMembership(userId);
        const { householdId } = membership;

        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();

        // Generate list of 12 months to query (oldest first)
        const months: { month: number; year: number }[] = [];
        for (let i = 11; i >= 0; i--) {
            const d = new Date(currentYear, currentMonth - 1 - i);
            months.push({ month: d.getMonth() + 1, year: d.getFullYear() });
        }

        const savings = await this.prismaService.saving.findMany({
            where: {
                householdId,
                OR: months.map((m) => ({ month: m.month, year: m.year })),
            },
        });

        return months.map((m) => {
            const monthSavings = savings.filter((s) => s.month === m.month && s.year === m.year);
            return {
                month: m.month,
                year: m.year,
                personalSavings: monthSavings.filter((s) => !s.isShared).reduce((sum, s) => sum + Number(s.amount), 0),
                sharedSavings: monthSavings.filter((s) => s.isShared).reduce((sum, s) => sum + Number(s.amount), 0),
            };
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
     * @param reqMonth - Optional month override (1-12)
     * @param reqYear - Optional year override
     * @returns Settlement calculation with amount, direction, and message
     * @throws NotFoundException If the user is not a member of any household
     */
    async getSettlement(userId: string, reqMonth?: number, reqYear?: number): Promise<SettlementResponseDto> {
        this.logger.debug(`Get settlement for user: ${userId}`);

        const membership = await this.expenseHelper.requireMembership(userId);
        const { month, year } = resolveMonthYear(reqMonth, reqYear);

        const cacheKey = this.cacheService.settlementKey(membership.householdId, year, month);

        return this.cacheService.getOrSet(cacheKey, this.cacheService.settlementTTL, async () => {
            const { members, sharedExpenses } = await this.fetchBaseData(membership.householdId);
            return this.calculator.calculateSettlement(members, sharedExpenses, userId, month, year);
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
     * @throws NotFoundException If the user is not a member of any household
     * @throws BadRequestException If there is no settlement needed (amount is zero)
     * @throws ConflictException If the settlement has already been marked as paid this month
     */
    async markSettlementPaid(userId: string): Promise<MarkSettlementPaidResponseDto> {
        this.logger.log(`Mark settlement paid for user: ${userId}`);

        const membership = await this.expenseHelper.requireMembership(userId);
        const { householdId } = membership;
        const { month, year } = resolveMonthYear();

        // Check if already settled this month
        const existing = await this.prismaService.settlement.findUnique({
            where: { householdId_month_year: { householdId, month, year } },
        });

        if (existing) {
            this.logger.warn(`Settlement already marked as paid for household: ${householdId}, month: ${month}/${year}`);
            throw new ConflictException('Settlement has already been marked as paid for this month');
        }

        // Pre-fetch data for settlement calculation
        const { members, sharedExpenses } = await this.fetchBaseData(householdId);

        // Calculate current settlement to determine who owes whom
        const settlement = await this.calculator.calculateSettlement(members, sharedExpenses, userId, month, year);

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
     * Computes 12-month rolling averages for income, expenses, and savings.
     *
     * @param householdId - The household to query
     * @param userId - The authenticated user's ID (for settlement calculation)
     * @param currentMonth - The current month (1-12)
     * @param currentYear - The current year
     * @returns Dashboard response with averaged values
     */
    private async computeYearlyAverageInternal(householdId: string, userId: string, currentMonth: number, currentYear: number): Promise<DashboardResponseDto> {
        const months = this.buildTrailingMonths(currentMonth, currentYear);
        const baseData = await this.fetchBaseData(householdId);
        const monthlyResults = await this.loadMonthlyResults(baseData, months);

        const avgIncome = this.averageIncome(monthlyResults);
        const avgExpenses = this.averageExpenses(monthlyResults);
        const avgSavings = this.averageSavings(monthlyResults);

        const [settlement, pendingApprovalsCount] = await Promise.all([
            this.calculator.calculateSettlement(baseData.members, baseData.sharedExpenses, userId, currentMonth, currentYear),
            this.calculator.getPendingApprovalsCount(householdId, userId),
        ]);

        return {
            income: avgIncome,
            totalDefaultIncome: avgIncome.reduce((sum, m) => sum + m.defaultSalary, 0),
            totalCurrentIncome: avgIncome.reduce((sum, m) => sum + m.currentSalary, 0),
            expenses: avgExpenses,
            savings: avgSavings,
            settlement,
            pendingApprovalsCount,
            month: currentMonth,
            year: currentYear,
        };
    }

    /**
     * Builds the list of 12 calendar months ending at (and including) currentMonth/currentYear,
     * oldest first — the window computeYearlyAverageInternal averages over.
     */
    private buildTrailingMonths(currentMonth: number, currentYear: number): { month: number; year: number }[] {
        const months: { month: number; year: number }[] = [];
        for (let i = 11; i >= 0; i--) {
            let m = currentMonth - i;
            let y = currentYear;
            if (m <= 0) {
                m += 12;
                y -= 1;
            }
            months.push({ month: m, year: y });
        }
        return months;
    }

    private async loadMonthlyResults(baseData: Awaited<ReturnType<DashboardService['fetchBaseData']>>, months: { month: number; year: number }[]): Promise<MonthlyResult[]> {
        const { members, expenses } = baseData;
        return Promise.all(
            months.map(async ({ month, year }) => ({
                month,
                year,
                income: await this.calculator.getIncomeData(members, month, year),
                expenses: await this.calculator.getExpenseData(members, expenses, month, year),
                savings: await this.calculator.calculateSavings(members, expenses, month, year),
            })),
        );
    }

    private averageIncome(monthlyResults: MonthlyResult[]): MemberIncomeDto[] {
        const incomeByMonth = monthlyResults.map((r) => r.income);
        const hasIncome = (i: MemberIncomeDto): boolean => i.currentSalary > 0 || i.defaultSalary > 0;

        return monthlyResults[0].income.map((member) => ({
            ...member,
            defaultSalary: this.averageMemberField(incomeByMonth, member.userId, hasIncome, (i) => i.defaultSalary),
            currentSalary: this.averageMemberField(incomeByMonth, member.userId, hasIncome, (i) => i.currentSalary),
        }));
    }

    private averageExpenses(monthlyResults: MonthlyResult[]): ExpenseSummaryDto {
        const personalExpensesByMonth = monthlyResults.map((r) => r.expenses.personalExpenses);
        const hasExpense = (pe: MemberExpenseSummaryDto): boolean => pe.personalExpensesTotal > 0;

        const personalExpenses: MemberExpenseSummaryDto[] = monthlyResults[0].expenses.personalExpenses.map((pe) => ({
            ...pe,
            personalExpensesTotal: this.averageMemberField(personalExpensesByMonth, pe.userId, hasExpense, (p) => p.personalExpensesTotal),
            remainingExpenses: this.averageMemberField(personalExpensesByMonth, pe.userId, hasExpense, (p) => p.remainingExpenses),
        }));

        const activeMonths = monthlyResults.filter((r) => r.expenses.totalHouseholdExpenses > 0);
        return {
            personalExpenses,
            sharedExpensesTotal: this.average(activeMonths.map((r) => r.expenses.sharedExpensesTotal)),
            totalHouseholdExpenses: this.average(activeMonths.map((r) => r.expenses.totalHouseholdExpenses)),
            remainingHouseholdExpenses: this.average(activeMonths.map((r) => r.expenses.remainingHouseholdExpenses)),
        };
    }

    private averageSavings(monthlyResults: MonthlyResult[]): SavingsResponseDto {
        const savingsByMonth = monthlyResults.map((r) => r.savings.members);
        const hasSavings = (sm: MemberSavingsDto): boolean => sm.personalSavings > 0 || sm.sharedSavings > 0;

        const members: MemberSavingsDto[] = monthlyResults[0].savings.members.map((sm) => ({
            ...sm,
            personalSavings: this.averageMemberField(savingsByMonth, sm.userId, hasSavings, (s) => s.personalSavings),
            sharedSavings: this.averageMemberField(savingsByMonth, sm.userId, hasSavings, (s) => s.sharedSavings),
            remainingBudget: this.averageMemberField(savingsByMonth, sm.userId, hasSavings, (s) => s.remainingBudget),
        }));

        return {
            members,
            totalPersonalSavings: this.sum(members.map((m) => m.personalSavings)),
            totalSharedSavings: this.sum(members.map((m) => m.sharedSavings)),
            totalSavings: this.sum(members.map((m) => m.personalSavings + m.sharedSavings)),
            totalRemainingBudget: this.sum(members.map((m) => m.remainingBudget)),
        };
    }

    /**
     * Averages one field of one member's record across whichever months that
     * member had data in (months where hasData is false are excluded, not
     * treated as zero) — used by averageIncome/averageExpenses/averageSavings
     * so the "only count active months" rule is stated once instead of once
     * per field.
     */
    private averageMemberField<M extends { userId: string }>(recordsByMonth: M[][], userId: string, hasData: (record: M) => boolean, selector: (record: M) => number): number {
        const activeValues = recordsByMonth
            .map((records) => records.find((r) => r.userId === userId))
            .filter((record): record is M => record != null && hasData(record))
            .map(selector);
        return this.average(activeValues);
    }

    private average(values: number[]): number {
        const count = values.length || 1;
        return roundCurrency(values.reduce((total, v) => total + v, 0) / count);
    }

    private sum(values: number[]): number {
        return roundCurrency(values.reduce((total, v) => total + v, 0));
    }
}
