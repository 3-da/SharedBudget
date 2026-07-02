import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { roundCurrency } from '../common/utils/round-currency';
import { Expense, ExpensePaymentStatus, Prisma } from '../generated/prisma/client';
import {
    ApprovalStatus,
    ExpenseCategory,
    ExpenseFrequency,
    ExpenseType,
    InstallmentFrequency,
    PaymentStatus,
    YearlyPaymentStrategy,
} from '../generated/prisma/enums';
import { MemberIncomeDto } from './dto/member-income.dto';
import { ExpenseSummaryDto, MemberExpenseSummaryDto } from './dto/expense-summary.dto';
import { MemberSavingsDto, SavingsResponseDto } from './dto/member-savings.dto';
import { SettlementResponseDto } from './dto/settlement-response.dto';

type MemberWithUser = Prisma.HouseholdMemberGetPayload<{
    include: { user: { select: { id: true; firstName: true; lastName: true } } };
}>;

type MonthlyOverride = { amount: number | null; skipped: boolean };

type ExpenseContext = {
    amountOf: (expense: Expense) => number;
    isExcluded: (expense: Expense) => boolean;
    paidContributionOf: (expense: Expense) => number;
};

@Injectable()
export class DashboardCalculatorService {
    private readonly logger = new Logger(DashboardCalculatorService.name);

    constructor(private readonly prismaService: PrismaService) {}

    /**
     * Fetches income data (salaries) for all household members in a given period.
     *
     * @param members - Pre-fetched household members with user info
     * @param month - Target month (1-12)
     * @param year - Target year
     * @returns Array of member income DTOs with default and current salary
     */
    async getIncomeData(members: MemberWithUser[], month: number, year: number): Promise<MemberIncomeDto[]> {
        const householdId = members[0]?.householdId;
        const salaries = householdId
            ? await this.prismaService.salary.findMany({
                  where: { householdId, month, year },
              })
            : [];

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
     * Aggregates expense data for the household in a given month.
     * Includes remaining (unpaid) expenses calculation.
     * Skipped recurring expenses (via RecurringOverride) and cancelled months
     * (via ExpensePaymentService.cancel) are excluded from all totals.
     *
     * @param members - Pre-fetched household members with user info
     * @param expenses - Pre-fetched household expenses (all types)
     * @param month - Target month (1-12)
     * @param year - Target year
     * @returns Expense summary with personal breakdowns, shared totals, and remaining amounts
     */
    async getExpenseData(members: MemberWithUser[], expenses: Expense[], month: number, year: number): Promise<ExpenseSummaryDto> {
        const householdId = members[0]?.householdId;
        this.logger.debug(`Aggregating ${expenses.length} expenses for household ${householdId} in ${month}/${year}`);

        const [paymentStatuses, overrides] = await Promise.all([
            this.loadPaymentStatusesForMonth(householdId, month, year),
            householdId ? this.loadOverridesForMonth(householdId, month, year) : Promise.resolve(new Map<string, MonthlyOverride>()),
        ]);
        const context = this.buildExpenseContext(expenses, paymentStatuses, overrides, month, year);

        const personalExpenses = members.map((member) => this.summarizePersonalExpenses(member, expenses, context));
        const sharedExpenses = expenses.filter((e) => e.type === ExpenseType.SHARED && !context.isExcluded(e));
        const sharedExpensesTotal = roundCurrency(this.sumAmounts(sharedExpenses, context.amountOf));

        const totalPersonal = personalExpenses.reduce((sum, pe) => sum + pe.personalExpensesTotal, 0);
        const totalHouseholdExpenses = roundCurrency(totalPersonal + sharedExpensesTotal);

        // Remaining household expenses = total - what has actually been paid so far
        const totalPaidPersonal = personalExpenses.reduce((sum, pe) => sum + pe.personalExpensesTotal - pe.remainingExpenses, 0);
        const paidShared = sharedExpenses.reduce((sum, e) => sum + context.paidContributionOf(e), 0);
        const remainingHouseholdExpenses = roundCurrency(totalHouseholdExpenses - totalPaidPersonal - paidShared);

        return {
            personalExpenses,
            sharedExpensesTotal,
            totalHouseholdExpenses,
            remainingHouseholdExpenses,
        };
    }

    /**
     * Loads this month's PAID and CANCELLED payment records for the household.
     * PAID records drive the paid-contribution calculation; CANCELLED records
     * exclude that expense from the month's totals entirely.
     */
    private async loadPaymentStatusesForMonth(householdId: string | undefined, month: number, year: number): Promise<ExpensePaymentStatus[]> {
        if (!householdId) return [];
        return this.prismaService.expensePaymentStatus.findMany({
            where: {
                expense: { householdId, deletedAt: null },
                month,
                year,
                status: { in: [PaymentStatus.PAID, PaymentStatus.CANCELLED] },
            },
        });
    }

    /**
     * Builds the per-call lookups getExpenseData's summaries share: each expense's
     * effective amount (computed once, not per reduce), whether it's excluded from
     * this month's totals (skipped or cancelled), and how much of it has been paid.
     */
    private buildExpenseContext(
        expenses: Expense[],
        paymentStatuses: ExpensePaymentStatus[],
        overrides: Map<string, MonthlyOverride>,
        month: number,
        year: number,
    ): ExpenseContext {
        const amountByExpenseId = this.buildAmountLookup(expenses, overrides, month, year);
        const paidPaymentMap = this.buildPaidPaymentMap(paymentStatuses);
        const cancelledExpenseIds = this.buildCancelledExpenseIds(paymentStatuses);

        const amountOf = (expense: Expense): number => amountByExpenseId.get(expense.id) ?? 0;
        const isExcluded = (expense: Expense): boolean => overrides.get(expense.id)?.skipped === true || cancelledExpenseIds.has(expense.id);
        const paidContributionOf = (expense: Expense): number => this.getPaidContribution(expense, amountOf(expense), paidPaymentMap.get(expense.id));

        return { amountOf, isExcluded, paidContributionOf };
    }

    private buildAmountLookup(expenses: Expense[], overrides: Map<string, MonthlyOverride>, month: number, year: number): Map<string, number> {
        return new Map(expenses.map((e) => [e.id, this.getMonthlyAmount(e, month, year, overrides.get(e.id)?.amount)]));
    }

    private buildPaidPaymentMap(paymentStatuses: ExpensePaymentStatus[]): Map<string, ExpensePaymentStatus> {
        return new Map(paymentStatuses.filter((p) => p.status === PaymentStatus.PAID).map((p) => [p.expenseId, p]));
    }

    private buildCancelledExpenseIds(paymentStatuses: ExpensePaymentStatus[]): Set<string> {
        return new Set(paymentStatuses.filter((p) => p.status === PaymentStatus.CANCELLED).map((p) => p.expenseId));
    }

    /**
     * How much of an expense's monthly amount counts as "paid" this month.
     * Keyed off the expense's current isFixed flag (not the presence of a
     * paidAmount value) so a stale paidAmount left over from before the
     * expense's isFixed flag changed can't skew the result.
     */
    private getPaidContribution(expense: Expense, amount: number, payment: ExpensePaymentStatus | undefined): number {
        if (!payment) return 0; // unpaid
        if (expense.isFixed) return amount; // fixed: marked paid covers the full amount
        // Flexible: actual paid amount, capped at the planned amount so an overpayment
        // can't drive remainingHouseholdExpenses negative (the total uses planned amounts).
        const paidAmount = payment.paidAmount != null ? Number(payment.paidAmount) : 0;
        return Math.min(amount, paidAmount);
    }

    private summarizePersonalExpenses(member: MemberWithUser, expenses: Expense[], context: ExpenseContext): MemberExpenseSummaryDto {
        const memberExpenses = expenses.filter((e) => e.type === ExpenseType.PERSONAL && e.createdById === member.userId && !context.isExcluded(e));
        const total = this.sumAmounts(memberExpenses, context.amountOf);
        const remaining = memberExpenses.reduce((sum, e) => sum + context.amountOf(e) - context.paidContributionOf(e), 0);

        return {
            userId: member.userId,
            firstName: member.user.firstName,
            lastName: member.user.lastName,
            personalExpensesTotal: roundCurrency(total),
            remainingExpenses: roundCurrency(remaining),
        };
    }

    private sumAmounts(expenses: Expense[], amountOf: (expense: Expense) => number): number {
        return expenses.reduce((sum, e) => sum + amountOf(e), 0);
    }

    /**
     * Calculates savings from actual Saving records (personal + shared) and remaining budget per member.
     * Remaining budget = salary - personal expenses - shared expense share - personal savings - shared savings.
     *
     * @param members - Pre-fetched household members with user info
     * @param expenses - Pre-fetched household expenses (all types)
     * @param month - Target month (1-12)
     * @param year - Target year
     * @returns Savings breakdown per member with household totals
     */
    async calculateSavings(members: MemberWithUser[], expenses: Expense[], month: number, year: number): Promise<SavingsResponseDto> {
        const householdId = members[0]?.householdId;

        const [income, expenseData, savingRecords] = await Promise.all([
            this.getIncomeData(members, month, year),
            this.getExpenseData(members, expenses, month, year),
            householdId
                ? this.prismaService.saving.findMany({
                      where: { householdId, month, year },
                  })
                : Promise.resolve([]),
        ]);

        const memberCount = income.length || 1;

        const memberSavings: MemberSavingsDto[] = income.map((memberIncome) => {
            const personalTotal = expenseData.personalExpenses.find((pe) => pe.userId === memberIncome.userId)?.personalExpensesTotal ?? 0;
            const sharedShare = expenseData.sharedExpensesTotal / memberCount;

            // Actual savings from Saving records
            const personalSavingRecord = savingRecords.find((s) => s.userId === memberIncome.userId && !s.isShared);
            const sharedSavingRecord = savingRecords.find((s) => s.userId === memberIncome.userId && s.isShared);

            const personalSavings = personalSavingRecord ? Number(personalSavingRecord.amount) : 0;
            const sharedSavings = sharedSavingRecord ? Number(sharedSavingRecord.amount) : 0;

            // Only deduct savings from remaining budget if they reduce from salary
            const personalSavingsDeduction = personalSavingRecord?.reducesFromSalary !== false ? personalSavings : 0;
            const sharedSavingsDeduction = sharedSavingRecord?.reducesFromSalary !== false ? sharedSavings : 0;

            // Remaining budget = salary - expenses - savings (only those that reduce from salary)
            const remainingBudget = roundCurrency(memberIncome.currentSalary - personalTotal - sharedShare - personalSavingsDeduction - sharedSavingsDeduction);

            return {
                userId: memberIncome.userId,
                firstName: memberIncome.firstName,
                lastName: memberIncome.lastName,
                personalSavings,
                sharedSavings,
                remainingBudget,
            };
        });

        const totalPersonalSavings = roundCurrency(memberSavings.reduce((sum, m) => sum + m.personalSavings, 0));
        const totalSharedSavings = roundCurrency(memberSavings.reduce((sum, m) => sum + m.sharedSavings, 0));
        const totalSavings = roundCurrency(totalPersonalSavings + totalSharedSavings);
        const totalRemainingBudget = roundCurrency(memberSavings.reduce((sum, m) => sum + m.remainingBudget, 0));

        return {
            members: memberSavings,
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
     *
     * @param members - Pre-fetched household members with user info
     * @param sharedExpenses - Pre-fetched shared expenses for the household
     * @param requestingUserId - The authenticated user's ID (used for relative message)
     * @param month - Target month (1-12)
     * @param year - Target year
     * @returns Settlement calculation with amount, direction, and message
     */
    async calculateSettlement(members: MemberWithUser[], sharedExpenses: Expense[], requestingUserId: string, month: number, year: number): Promise<SettlementResponseDto> {
        const householdId = members[0]?.householdId;

        const [existingSettlement, overrides] = await Promise.all([
            householdId
                ? this.prismaService.settlement.findUnique({
                      where: { householdId_month_year: { householdId, month, year } },
                  })
                : Promise.resolve(null),
            householdId ? this.loadOverridesForMonth(householdId, month, year) : Promise.resolve(new Map<string, MonthlyOverride>()),
        ]);

        const memberCount = members.length || 1;

        // Track how much each member has paid and what their fair share is
        const paid: Record<string, number> = {};
        const fairShare: Record<string, number> = {};

        for (const member of members) {
            paid[member.userId] = 0;
            fairShare[member.userId] = 0;
        }

        for (const expense of sharedExpenses) {
            const override = overrides.get(expense.id);
            // Skip expenses marked as skipped for this month
            if (override?.skipped === true) continue;

            const monthlyAmount = this.getMonthlyAmount(expense, month, year, override?.amount);

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
            balance: roundCurrency(paid[m.userId] - fairShare[m.userId]),
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

        const amount = roundCurrency(creditor.balance);
        this.logger.debug(`Settlement for ${month}/${year}: ${debtor.firstName} owes ${creditor.firstName} ${amount}`);

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
     * Computes each expense's effective amount for the given month, accounting
     * for recurring overrides — the same rule getExpenseData applies. Lets other
     * services (e.g. ExpensePaymentService, to report an override-aware
     * remaining balance) reuse the schedule math and override lookup without
     * duplicating either.
     *
     * @param expenses - The expenses to compute amounts for (must share a household)
     * @param month - Target month (1-12)
     * @param year - Target year
     * @returns Map of expenseId to its effective monthly amount
     */
    async getMonthlyAmounts(expenses: Expense[], month: number, year: number): Promise<Map<string, number>> {
        const householdId = expenses[0]?.householdId;
        const overrides = householdId ? await this.loadOverridesForMonth(householdId, month, year) : new Map<string, MonthlyOverride>();
        return this.buildAmountLookup(expenses, overrides, month, year);
    }

    /**
     * Loads all recurring overrides for a given household/month/year.
     * Each override carries a per-month amount (when the cost differs that month)
     * and a skip flag (when the expense should be excluded that month).
     * Callers use the amount to override the base expense cost and the skip flag
     * to exclude the expense from totals and settlement.
     *
     * @param householdId - The household to query
     * @param month - Target month (1-12)
     * @param year - Target year
     * @returns Map of expenseId to its override amount and skip flag
     */
    private async loadOverridesForMonth(householdId: string, month: number, year: number): Promise<Map<string, MonthlyOverride>> {
        const records = await this.prismaService.recurringOverride.findMany({
            where: { expense: { householdId }, month, year },
            select: { expenseId: true, amount: true, skipped: true },
        });
        return new Map(records.map((r) => [r.expenseId, { amount: r.amount != null ? Number(r.amount) : null, skipped: r.skipped }]));
    }

    /**
     * Counts pending approvals for the household, excluding those created by the requesting user.
     * The creator should not see a notification for their own proposals.
     *
     * @param householdId - The household to query
     * @param userId - The requesting user's ID (excluded from count)
     * @returns Number of pending approvals
     */
    async getPendingApprovalsCount(householdId: string, userId?: string): Promise<number> {
        const where: Prisma.ExpenseApprovalWhereInput = {
            householdId,
            status: ApprovalStatus.PENDING,
        };

        if (userId) {
            where.requestedById = { not: userId };
        }

        return this.prismaService.expenseApproval.count({ where });
    }

    /**
     * Returns the monthly-equivalent amount for an expense in a given month/year.
     * - MONTHLY recurring: return amount directly
     * - YEARLY FULL payment: return amount only in the designated payment month
     * - YEARLY INSTALLMENTS: return amount/installmentsPerYear in installment months (anchored to creation month)
     * - ONE_TIME FULL: return amount only in the specific month/year
     * - ONE_TIME INSTALLMENTS: return amount/installmentCount in each installment month within range
     *
     * @param expense - The expense entity
     * @param month - Target month (1-12)
     * @param year - Target year
     * @param overrideAmount - Per-month override amount that replaces the base amount when present
     * @returns The effective amount for the given month
     */
    getMonthlyAmount(expense: Expense, month: number, year: number, overrideAmount?: number | null): number {
        const base = Number(expense.amount);

        if (expense.category === ExpenseCategory.ONE_TIME) {
            return this.getOneTimeAmount(expense, base, month, year, overrideAmount);
        }
        if (expense.frequency === ExpenseFrequency.YEARLY) {
            return this.getYearlyAmount(expense, base, month, overrideAmount);
        }
        // Monthly recurring applies in full every month
        return overrideAmount ?? base;
    }

    private getOneTimeAmount(expense: Expense, base: number, month: number, year: number, overrideAmount?: number | null): number {
        // INSTALLMENTS: spread across multiple months starting from the expense month/year
        if (expense.yearlyPaymentStrategy === YearlyPaymentStrategy.INSTALLMENTS && expense.installmentCount && expense.installmentFrequency) {
            return this.getOneTimeInstallmentAmount(expense, base, month, year, overrideAmount);
        }
        // FULL payment or no strategy: only in the specific month/year
        if (expense.month === month && expense.year === year) {
            return overrideAmount ?? base;
        }
        return 0;
    }

    private getYearlyAmount(expense: Expense, base: number, month: number, overrideAmount?: number | null): number {
        if (expense.yearlyPaymentStrategy === YearlyPaymentStrategy.FULL) {
            // Full yearly payment lands only in the designated payment month
            return expense.paymentMonth === month ? (overrideAmount ?? base) : 0;
        }
        if (expense.yearlyPaymentStrategy === YearlyPaymentStrategy.INSTALLMENTS) {
            return this.getYearlyInstallmentAmount(expense, base, month, overrideAmount);
        }
        // Yearly without a strategy set: spread evenly across every month
        return overrideAmount ?? base / 12;
    }

    private getYearlyInstallmentAmount(expense: Expense, base: number, month: number, overrideAmount?: number | null): number {
        // Anchor installments to the creation month instead of fixed calendar months
        const anchorMonth = expense.createdAt.getMonth() + 1;
        const stepMonths = this.getStepMonths(expense.installmentFrequency ?? InstallmentFrequency.MONTHLY);
        if (!this.isInstallmentMonth(month, anchorMonth, stepMonths)) {
            return 0;
        }
        // The override is already the per-installment amount, so use it without re-dividing
        return overrideAmount ?? base / (12 / stepMonths);
    }

    /**
     * Calculates the installment amount for a ONE_TIME expense with installments.
     * Returns the per-installment amount if (month, year) falls on an installment date
     * within the total installment count range; otherwise returns 0.
     *
     * @param expense - The one-time expense entity
     * @param base - The total expense amount
     * @param month - Target month (1-12)
     * @param year - Target year
     * @param overrideAmount - Per-installment override that replaces the split amount when present
     * @returns The installment amount for the given month, or 0 if not an installment month
     */
    getOneTimeInstallmentAmount(expense: Expense, base: number, month: number, year: number, overrideAmount?: number | null): number {
        const startMonth = expense.month!;
        const startYear = expense.year!;
        const count = expense.installmentCount!;
        const stepMonths = this.getStepMonths(expense.installmentFrequency!);

        // Convert to absolute month index for comparison
        const startTotal = startYear * 12 + startMonth;
        const currentTotal = year * 12 + month;
        const diff = currentTotal - startTotal;

        // Must be on or after start, on an installment step, and within count
        if (diff < 0) return 0;
        if (diff % stepMonths !== 0) return 0;
        const installmentIndex = diff / stepMonths;
        if (installmentIndex >= count) return 0;

        // The override is already the per-installment amount; otherwise split the total evenly
        return overrideAmount ?? roundCurrency(base / count);
    }

    /**
     * Checks if a given month aligns with installment schedule anchored to a starting month.
     * E.g., anchorMonth=2 (Feb), stepMonths=3 -> installment months are Feb, May, Aug, Nov.
     *
     * @param month - The month to check (1-12)
     * @param anchorMonth - The starting anchor month (1-12)
     * @param stepMonths - Number of months between installments
     * @returns True if the month is an installment month
     */
    isInstallmentMonth(month: number, anchorMonth: number, stepMonths: number): boolean {
        return (((month - anchorMonth) % stepMonths) + stepMonths) % stepMonths === 0;
    }

    /**
     * Returns the number of months between installments for a given frequency.
     *
     * @param freq - The installment frequency
     * @returns Number of months between installments
     */
    getStepMonths(freq: InstallmentFrequency): number {
        switch (freq) {
            case InstallmentFrequency.MONTHLY:
                return 1;
            case InstallmentFrequency.QUARTERLY:
                return 3;
            case InstallmentFrequency.SEMI_ANNUAL:
                return 6;
            default:
                return 1;
        }
    }
}
