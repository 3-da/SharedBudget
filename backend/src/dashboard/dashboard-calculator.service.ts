import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Expense, Prisma } from '../generated/prisma/client';
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

@Injectable()
export class DashboardCalculatorService {
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
     * Skipped recurring expenses (via RecurringOverride) are excluded from all totals.
     *
     * @param members - Pre-fetched household members with user info
     * @param expenses - Pre-fetched household expenses (all types)
     * @param month - Target month (1-12)
     * @param year - Target year
     * @returns Expense summary with personal breakdowns, shared totals, and remaining amounts
     */
    async getExpenseData(members: MemberWithUser[], expenses: Expense[], month: number, year: number): Promise<ExpenseSummaryDto> {
        const householdId = members[0]?.householdId;

        const [paymentStatuses, skippedExpenseIds] = await Promise.all([
            householdId
                ? this.prismaService.expensePaymentStatus.findMany({
                      where: {
                          expense: { householdId, deletedAt: null },
                          month,
                          year,
                          status: PaymentStatus.PAID,
                      },
                  })
                : Promise.resolve([]),
            householdId ? this.loadSkippedExpenseIds(householdId, month, year) : Promise.resolve(new Set<string>()),
        ]);
        const paidExpenseIds = new Set(paymentStatuses.map((p) => p.expenseId));

        // Calculate personal expenses per member (skip skipped expenses)
        const personalExpenses: MemberExpenseSummaryDto[] = members.map((member) => {
            const memberExpenses = expenses.filter((e) => e.type === ExpenseType.PERSONAL && e.createdById === member.userId && !skippedExpenseIds.has(e.id));
            const total = memberExpenses.reduce((sum, e) => sum + this.getMonthlyAmount(e, month, year), 0);
            const remaining = memberExpenses.filter((e) => !paidExpenseIds.has(e.id)).reduce((sum, e) => sum + this.getMonthlyAmount(e, month, year), 0);

            return {
                userId: member.userId,
                firstName: member.user.firstName,
                lastName: member.user.lastName,
                personalExpensesTotal: Math.round(total * 100) / 100,
                remainingExpenses: Math.round(remaining * 100) / 100,
            };
        });

        // Calculate shared expenses total (skip skipped expenses)
        const sharedExpenses = expenses.filter((e) => e.type === ExpenseType.SHARED && !skippedExpenseIds.has(e.id));
        const sharedExpensesTotal = Math.round(sharedExpenses.reduce((sum, e) => sum + this.getMonthlyAmount(e, month, year), 0) * 100) / 100;

        const totalPersonal = personalExpenses.reduce((sum, pe) => sum + pe.personalExpensesTotal, 0);
        const totalHouseholdExpenses = Math.round((totalPersonal + sharedExpensesTotal) * 100) / 100;

        // Calculate remaining household expenses (total - paid)
        const totalPaidPersonal = personalExpenses.reduce((sum, pe) => sum + pe.personalExpensesTotal - pe.remainingExpenses, 0);
        const paidShared = sharedExpenses.filter((e) => paidExpenseIds.has(e.id)).reduce((sum, e) => sum + this.getMonthlyAmount(e, month, year), 0);
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
            const remainingBudget = Math.round((memberIncome.currentSalary - personalTotal - sharedShare - personalSavingsDeduction - sharedSavingsDeduction) * 100) / 100;

            return {
                userId: memberIncome.userId,
                firstName: memberIncome.firstName,
                lastName: memberIncome.lastName,
                personalSavings,
                sharedSavings,
                remainingBudget,
            };
        });

        const totalPersonalSavings = Math.round(memberSavings.reduce((sum, m) => sum + m.personalSavings, 0) * 100) / 100;
        const totalSharedSavings = Math.round(memberSavings.reduce((sum, m) => sum + m.sharedSavings, 0) * 100) / 100;
        const totalSavings = Math.round((totalPersonalSavings + totalSharedSavings) * 100) / 100;
        const totalRemainingBudget = Math.round(memberSavings.reduce((sum, m) => sum + m.remainingBudget, 0) * 100) / 100;

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

        const [existingSettlement, skippedExpenseIds] = await Promise.all([
            householdId
                ? this.prismaService.settlement.findUnique({
                      where: { householdId_month_year: { householdId, month, year } },
                  })
                : Promise.resolve(null),
            householdId ? this.loadSkippedExpenseIds(householdId, month, year) : Promise.resolve(new Set<string>()),
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
            // Skip expenses marked as skipped for this month
            if (skippedExpenseIds.has(expense.id)) continue;

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
     * Returns the set of expense IDs that are marked as skipped for a given household/month/year.
     * Used to exclude skipped recurring expenses from totals and settlement calculations.
     *
     * @param householdId - The household to query
     * @param month - Target month (1-12)
     * @param year - Target year
     * @returns Set of skipped expense IDs
     */
    private async loadSkippedExpenseIds(householdId: string, month: number, year: number): Promise<Set<string>> {
        const records = await this.prismaService.recurringOverride.findMany({
            where: { expense: { householdId }, month, year, skipped: true },
            select: { expenseId: true },
        });
        return new Set(records.map((r) => r.expenseId));
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
     * @returns The effective amount for the given month
     */
    getMonthlyAmount(expense: Expense, month: number, year: number): number {
        const amount = Number(expense.amount);

        if (expense.category === ExpenseCategory.ONE_TIME) {
            // ONE_TIME with INSTALLMENTS: spread across multiple months starting from expense month/year
            if (expense.yearlyPaymentStrategy === YearlyPaymentStrategy.INSTALLMENTS && expense.installmentCount && expense.installmentFrequency) {
                return this.getOneTimeInstallmentAmount(expense, amount, month, year);
            }
            // ONE_TIME FULL payment or no strategy: only in specific month/year
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

            // Installment strategy — anchor to creation month instead of fixed calendar months
            if (expense.yearlyPaymentStrategy === YearlyPaymentStrategy.INSTALLMENTS) {
                const anchorMonth = expense.createdAt.getMonth() + 1; // 1-based month from creation date

                switch (expense.installmentFrequency) {
                    case InstallmentFrequency.MONTHLY:
                        return amount / 12;
                    case InstallmentFrequency.QUARTERLY:
                        return this.isInstallmentMonth(month, anchorMonth, 3) ? amount / 4 : 0;
                    case InstallmentFrequency.SEMI_ANNUAL:
                        return this.isInstallmentMonth(month, anchorMonth, 6) ? amount / 2 : 0;
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
     * Calculates the installment amount for a ONE_TIME expense with installments.
     * Returns the per-installment amount if (month, year) falls on an installment date
     * within the total installment count range; otherwise returns 0.
     *
     * @param expense - The one-time expense entity
     * @param amount - The total expense amount
     * @param month - Target month (1-12)
     * @param year - Target year
     * @returns The installment amount for the given month, or 0 if not an installment month
     */
    getOneTimeInstallmentAmount(expense: Expense, amount: number, month: number, year: number): number {
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

        return Math.round((amount / count) * 100) / 100;
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
