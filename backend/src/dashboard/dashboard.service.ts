import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExpenseHelperService } from '../common/expense/expense-helper.service';
import { DashboardResponseDto } from './dto/dashboard-response.dto';
import { SavingsResponseDto, MemberSavingsDto } from './dto/member-savings.dto';
import { SavingsHistoryItemDto } from './dto/savings-history.dto';
import { SettlementResponseDto } from './dto/settlement-response.dto';
import { MarkSettlementPaidResponseDto } from './dto/mark-settlement-paid-response.dto';
import { MemberIncomeDto } from './dto/member-income.dto';
import { MemberExpenseSummaryDto } from './dto/expense-summary.dto';
import { CacheService } from '../common/cache/cache.service';
import { DashboardCalculatorService } from './dashboard-calculator.service';

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
    async getOverview(userId: string, mode: 'monthly' | 'yearly' = 'monthly', reqMonth?: number, reqYear?: number): Promise<DashboardResponseDto> {
        this.logger.debug(`Get dashboard overview for user: ${userId}, mode: ${mode}`);

        const membership = await this.expenseHelper.requireMembership(userId);
        const { householdId } = membership;
        const now = new Date();
        const month = reqMonth ?? now.getMonth() + 1;
        const year = reqYear ?? now.getFullYear();

        const cacheKey = this.cacheService.dashboardKey(householdId, year, month) + `:${mode}`;

        return this.cacheService.getOrSet(cacheKey, this.cacheService.summaryTTL, async () => {
            if (mode === 'yearly') {
                return this.computeYearlyAverage(householdId, userId, month, year);
            }

            const [income, expenses, savings, settlement, pendingApprovalsCount] = await Promise.all([
                this.calculator.getIncomeData(householdId, month, year),
                this.calculator.getExpenseData(householdId, month, year),
                this.calculator.calculateSavings(householdId, month, year),
                this.calculator.calculateSettlement(householdId, userId, month, year),
                this.calculator.getPendingApprovalsCount(householdId, userId),
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
            if (m <= 0) {
                m += 12;
                y -= 1;
            }
            months.push({ month: m, year: y });
        }

        const monthlyResults = await Promise.all(
            months.map(async ({ month, year }) => ({
                month,
                year,
                income: await this.calculator.getIncomeData(householdId, month, year),
                expenses: await this.calculator.getExpenseData(householdId, month, year),
                savings: await this.calculator.calculateSavings(householdId, month, year),
            })),
        );

        const firstIncome = monthlyResults[0].income;

        // Average incomes — only count months that have at least one salary entry
        const incomeMonths = monthlyResults.filter((r) => r.income.some((i) => i.currentSalary > 0 || i.defaultSalary > 0));
        const incomeCount = incomeMonths.length || 1;

        const avgIncome: MemberIncomeDto[] = firstIncome.map((member) => {
            const memberMonths = incomeMonths.filter((r) => r.income.find((i) => i.userId === member.userId && (i.currentSalary > 0 || i.defaultSalary > 0)));
            const memberCount = memberMonths.length || 1;
            const avgDefault =
                Math.round(
                    (memberMonths.reduce((sum, r) => {
                        const m = r.income.find((i) => i.userId === member.userId);
                        return sum + (m?.defaultSalary ?? 0);
                    }, 0) /
                        memberCount) *
                        100,
                ) / 100;
            const avgCurrent =
                Math.round(
                    (memberMonths.reduce((sum, r) => {
                        const m = r.income.find((i) => i.userId === member.userId);
                        return sum + (m?.currentSalary ?? 0);
                    }, 0) /
                        memberCount) *
                        100,
                ) / 100;

            return { ...member, defaultSalary: avgDefault, currentSalary: avgCurrent };
        });

        // Average expenses — only count months that have at least one expense
        const expenseMonths = monthlyResults.filter((r) => r.expenses.totalHouseholdExpenses > 0);
        const expenseCount = expenseMonths.length || 1;

        const avgPersonalExpenses: MemberExpenseSummaryDto[] = monthlyResults[0].expenses.personalExpenses.map((pe) => {
            const peMonths = expenseMonths.filter((r) => {
                const found = r.expenses.personalExpenses.find((p) => p.userId === pe.userId);
                return found && found.personalExpensesTotal > 0;
            });
            const peCount = peMonths.length || 1;
            const avgTotal =
                Math.round(
                    (peMonths.reduce((sum, r) => {
                        const found = r.expenses.personalExpenses.find((p) => p.userId === pe.userId);
                        return sum + (found?.personalExpensesTotal ?? 0);
                    }, 0) /
                        peCount) *
                        100,
                ) / 100;
            const avgRemaining =
                Math.round(
                    (peMonths.reduce((sum, r) => {
                        const found = r.expenses.personalExpenses.find((p) => p.userId === pe.userId);
                        return sum + (found?.remainingExpenses ?? 0);
                    }, 0) /
                        peCount) *
                        100,
                ) / 100;
            return { ...pe, personalExpensesTotal: avgTotal, remainingExpenses: avgRemaining };
        });
        const avgSharedTotal = Math.round((expenseMonths.reduce((sum, r) => sum + r.expenses.sharedExpensesTotal, 0) / expenseCount) * 100) / 100;
        const avgTotalHousehold = Math.round((expenseMonths.reduce((sum, r) => sum + r.expenses.totalHouseholdExpenses, 0) / expenseCount) * 100) / 100;
        const avgRemainingHousehold = Math.round((expenseMonths.reduce((sum, r) => sum + r.expenses.remainingHouseholdExpenses, 0) / expenseCount) * 100) / 100;

        // Average savings — only count months that have at least one saving record
        const savingsMonths = monthlyResults.filter((r) => r.savings.totalSavings > 0);
        const savingsCount = savingsMonths.length || 1;

        const avgSavingsMembers: MemberSavingsDto[] = monthlyResults[0].savings.members.map((sm) => {
            const smMonths = savingsMonths.filter((r) => {
                const found = r.savings.members.find((s) => s.userId === sm.userId);
                return found && (found.personalSavings > 0 || found.sharedSavings > 0);
            });
            const smCount = smMonths.length || 1;
            const avgPersonal =
                Math.round(
                    (smMonths.reduce((sum, r) => {
                        const found = r.savings.members.find((s) => s.userId === sm.userId);
                        return sum + (found?.personalSavings ?? 0);
                    }, 0) /
                        smCount) *
                        100,
                ) / 100;
            const avgShared =
                Math.round(
                    (smMonths.reduce((sum, r) => {
                        const found = r.savings.members.find((s) => s.userId === sm.userId);
                        return sum + (found?.sharedSavings ?? 0);
                    }, 0) /
                        smCount) *
                        100,
                ) / 100;
            const avgBudget =
                Math.round(
                    (smMonths.reduce((sum, r) => {
                        const found = r.savings.members.find((s) => s.userId === sm.userId);
                        return sum + (found?.remainingBudget ?? 0);
                    }, 0) /
                        smCount) *
                        100,
                ) / 100;
            return { ...sm, personalSavings: avgPersonal, sharedSavings: avgShared, remainingBudget: avgBudget };
        });

        const [settlement, pendingApprovalsCount] = await Promise.all([
            this.calculator.calculateSettlement(householdId, userId, currentMonth, currentYear),
            this.calculator.getPendingApprovalsCount(householdId, userId),
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

    async getSavings(userId: string, reqMonth?: number, reqYear?: number): Promise<SavingsResponseDto> {
        this.logger.debug(`Get savings for user: ${userId}`);

        const membership = await this.expenseHelper.requireMembership(userId);
        const now = new Date();
        const month = reqMonth ?? now.getMonth() + 1;
        const year = reqYear ?? now.getFullYear();

        const cacheKey = this.cacheService.savingsKey(membership.householdId, year, month);

        return this.cacheService.getOrSet(cacheKey, this.cacheService.summaryTTL, async () => {
            return this.calculator.calculateSavings(membership.householdId, month, year);
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
     * @throws {NotFoundException} If the user is not a member of any household
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
     * @returns Settlement calculation with amount, direction, and message
     * @throws {NotFoundException} If the user is not a member of any household
     */
    async getSettlement(userId: string, reqMonth?: number, reqYear?: number): Promise<SettlementResponseDto> {
        this.logger.debug(`Get settlement for user: ${userId}`);

        const membership = await this.expenseHelper.requireMembership(userId);
        const now = new Date();
        const month = reqMonth ?? now.getMonth() + 1;
        const year = reqYear ?? now.getFullYear();

        const cacheKey = this.cacheService.settlementKey(membership.householdId, year, month);

        return this.cacheService.getOrSet(cacheKey, this.cacheService.settlementTTL, async () => {
            return this.calculator.calculateSettlement(membership.householdId, userId, month, year);
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
        const settlement = await this.calculator.calculateSettlement(householdId, userId, month, year);

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
}
