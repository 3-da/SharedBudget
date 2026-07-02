import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExpenseHelperService } from '../common/expense/expense-helper.service';
import { CacheService } from '../common/cache/cache.service';
import { DashboardCalculatorService } from '../dashboard/dashboard-calculator.service';
import { MarkPaidDto } from './dto/mark-paid.dto';
import { ExpensePaymentResponseDto } from './dto/expense-payment-response.dto';
import { Expense } from '../generated/prisma/client';
import { PaymentStatus } from '../generated/prisma/enums';

type PaymentRecord = { status: PaymentStatus; paidAmount: unknown };

@Injectable()
export class ExpensePaymentService {
    private readonly logger = new Logger(ExpensePaymentService.name);

    constructor(
        private readonly prismaService: PrismaService,
        private readonly expenseHelper: ExpenseHelperService,
        private readonly cacheService: CacheService,
        private readonly calculator: DashboardCalculatorService,
    ) {}

    /**
     * Marks an expense as paid for a specific month and year.
     * Creates the payment status record if it doesn't exist, or updates it to PAID.
     *
     * Scenario: Sam marks their "Gym Membership" as paid for June 2026.
     * If a record already exists for that month (e.g. previously cancelled),
     * it gets updated to PAID with the current timestamp.
     *
     * @param userId - The authenticated user's ID
     * @param expenseId - The expense to mark as paid
     * @param dto - Month, year and optional paidAmount to mark as paid
     * @returns The created or updated payment status record
     * @throws {NotFoundException} If the user is not a member of any household
     * @throws {NotFoundException} If the expense is not found in the user's household
     * @throws {BadRequestException} If the expense is flexible and no paidAmount is provided
     */
    async markPaid(userId: string, expenseId: string, dto: MarkPaidDto): Promise<ExpensePaymentResponseDto> {
        this.logger.debug(`Mark expense paid: ${expenseId} for ${dto.month}/${dto.year} by user ${userId}`);

        const membership = await this.expenseHelper.requireMembership(userId);
        const expense = await this.expenseHelper.findVisibleExpense(expenseId, membership.householdId, userId);

        if (!expense.isFixed && dto.paidAmount == null) {
            this.logger.warn(`Flexible expense ${expenseId} requires paidAmount but none was provided`);
            throw new BadRequestException('paidAmount is required for flexible expenses');
        }

        const paidAmount = expense.isFixed ? null : dto.paidAmount;

        const result = await this.prismaService.expensePaymentStatus.upsert({
            where: {
                expenseId_month_year: {
                    expenseId,
                    month: dto.month,
                    year: dto.year,
                },
            },
            create: {
                expenseId,
                month: dto.month,
                year: dto.year,
                status: PaymentStatus.PAID,
                paidAt: new Date(),
                paidById: userId,
                paidAmount,
            },
            update: {
                status: PaymentStatus.PAID,
                paidAt: new Date(),
                paidById: userId,
                paidAmount,
            },
        });

        await this.cacheService.invalidateExpenseCache(userId, expense.type, membership.householdId);
        this.logger.log(`Expense ${expenseId} marked as paid for ${dto.month}/${dto.year}`);
        return this.mapToResponse(result, await this.computeRemainingAmount(expense, dto.month, dto.year, result));
    }

    /**
     * Resets the payment status of an expense back to PENDING for a specific month and year.
     * The payment status record must already exist (i.e. the expense must have been
     * previously marked as paid or cancelled for that period).
     *
     * Scenario: Sam accidentally marked their gym payment as paid for July 2026
     * and wants to undo it. The status goes back to PENDING and paidAt is cleared.
     *
     * @param userId - The authenticated user's ID
     * @param expenseId - The expense to reset
     * @param dto - Month and year to undo
     * @returns The updated payment status record with PENDING status
     * @throws {NotFoundException} If the user is not a member of any household
     * @throws {NotFoundException} If the expense is not found in the user's household
     * @throws {NotFoundException} If no payment status record exists for this expense/month/year
     */
    async undoPaid(userId: string, expenseId: string, dto: MarkPaidDto): Promise<ExpensePaymentResponseDto> {
        this.logger.debug(`Undo paid for expense: ${expenseId} for ${dto.month}/${dto.year}`);

        const membership = await this.expenseHelper.requireMembership(userId);
        const expense = await this.expenseHelper.findVisibleExpense(expenseId, membership.householdId, userId);

        const existing = await this.prismaService.expensePaymentStatus.findUnique({
            where: {
                expenseId_month_year: {
                    expenseId,
                    month: dto.month,
                    year: dto.year,
                },
            },
        });

        if (!existing) {
            this.logger.warn(`No payment status found for expense ${expenseId} at ${dto.month}/${dto.year}`);
            throw new NotFoundException('No payment status found for this expense and period');
        }

        const result = await this.prismaService.expensePaymentStatus.update({
            where: { id: existing.id },
            data: {
                status: PaymentStatus.PENDING,
                paidAt: null,
                paidById: userId,
                paidAmount: null,
            },
        });

        await this.cacheService.invalidateExpenseCache(userId, expense.type, membership.householdId);
        this.logger.log(`Expense ${expenseId} payment undone for ${dto.month}/${dto.year}`);
        return this.mapToResponse(result, null);
    }

    /**
     * Cancels an expense for a specific month, removing it from budget calculations.
     * Creates the payment status record if it doesn't exist, or updates it to CANCELLED.
     *
     * Scenario: Sam's gym is closed in August for renovation, so Sam cancels
     * that month's payment. The expense remains active for other months.
     *
     * @param userId - The authenticated user's ID
     * @param expenseId - The expense to cancel for the given month
     * @param dto - Month and year to cancel
     * @returns The created or updated payment status record with CANCELLED status
     * @throws {NotFoundException} If the user is not a member of any household
     * @throws {NotFoundException} If the expense is not found in the user's household
     */
    async cancel(userId: string, expenseId: string, dto: MarkPaidDto): Promise<ExpensePaymentResponseDto> {
        this.logger.debug(`Cancel expense: ${expenseId} for ${dto.month}/${dto.year}`);

        const membership = await this.expenseHelper.requireMembership(userId);
        const expense = await this.expenseHelper.findVisibleExpense(expenseId, membership.householdId, userId);

        const result = await this.prismaService.expensePaymentStatus.upsert({
            where: {
                expenseId_month_year: {
                    expenseId,
                    month: dto.month,
                    year: dto.year,
                },
            },
            create: {
                expenseId,
                month: dto.month,
                year: dto.year,
                status: PaymentStatus.CANCELLED,
                paidAt: null,
                paidById: userId,
            },
            update: {
                status: PaymentStatus.CANCELLED,
                paidAt: null,
                paidById: userId,
            },
        });

        await this.cacheService.invalidateExpenseCache(userId, expense.type, membership.householdId);
        this.logger.log(`Expense ${expenseId} cancelled for ${dto.month}/${dto.year}`);
        return this.mapToResponse(result, null);
    }

    /**
     * Retrieves all payment status records for a given expense, ordered by
     * year and month descending (most recent first).
     *
     * @param userId - The authenticated user's ID
     * @param expenseId - The expense to query statuses for
     * @returns List of payment status records (empty array if none exist)
     * @throws {NotFoundException} If the user is not a member of any household
     * @throws {NotFoundException} If the expense is not found in the user's household
     */
    async getPaymentStatuses(userId: string, expenseId: string): Promise<ExpensePaymentResponseDto[]> {
        this.logger.debug(`Get payment statuses for expense: ${expenseId}`);

        const membership = await this.expenseHelper.requireMembership(userId);
        const expense = await this.expenseHelper.findVisibleExpense(expenseId, membership.householdId, userId);

        const [statuses, overrides] = await Promise.all([
            this.prismaService.expensePaymentStatus.findMany({
                where: { expenseId },
                orderBy: [{ year: 'desc' }, { month: 'desc' }],
            }),
            this.prismaService.recurringOverride.findMany({
                where: { expenseId },
                select: { month: true, year: true, amount: true },
            }),
        ]);

        const overrideAmountByPeriod = new Map(overrides.map((o) => [this.periodKey(o.year, o.month), o.amount != null ? Number(o.amount) : null]));

        return statuses.map((s) => {
            const overrideAmount = overrideAmountByPeriod.get(this.periodKey(s.year, s.month));
            const monthlyAmount = this.calculator.getMonthlyAmount(expense, s.month, s.year, overrideAmount);
            return this.mapToResponse(s, this.remainingFromAmount(expense, monthlyAmount, s));
        });
    }

    /**
     * Returns payment statuses for all expenses belonging to the user's household
     * for a given month/year. Single query replaces N individual getPaymentStatuses calls.
     *
     * @param userId - The authenticated user's ID
     * @param month - Month (1-12)
     * @param year - Year
     * @returns Payment statuses for all household expenses in the given period
     */
    async getBatchPaymentStatuses(userId: string, month: number, year: number): Promise<ExpensePaymentResponseDto[]> {
        this.logger.debug(`Get batch payment statuses for ${month}/${year} by user ${userId}`);

        const membership = await this.expenseHelper.requireMembership(userId);

        const statuses = await this.prismaService.expensePaymentStatus.findMany({
            where: {
                month,
                year,
                expense: {
                    householdId: membership.householdId,
                    deletedAt: null,
                    ...this.expenseHelper.visibleExpenseFilter(userId),
                },
            },
            include: { expense: true },
        });

        const monthlyAmounts = await this.calculator.getMonthlyAmounts(
            statuses.map((s) => s.expense),
            month,
            year,
        );

        return statuses.map((s) => {
            const monthlyAmount = monthlyAmounts.get(s.expenseId) ?? 0;
            return this.mapToResponse(s, this.remainingFromAmount(s.expense, monthlyAmount, s));
        });
    }

    /**
     * How much of a month's override-adjusted amount is still unpaid for a
     * single expense — loads that expense's own effective amount, then
     * delegates to remainingFromAmount. Used by markPaid, where only one
     * expense's remaining balance is needed. getBatchPaymentStatuses instead
     * batches getMonthlyAmounts once for every expense and calls
     * remainingFromAmount directly, to avoid an override lookup per expense.
     */
    private async computeRemainingAmount(expense: Expense, month: number, year: number, payment: PaymentRecord): Promise<number | null> {
        if (payment.status !== PaymentStatus.PAID) return null;
        const monthlyAmounts = await this.calculator.getMonthlyAmounts([expense], month, year);
        return this.remainingFromAmount(expense, monthlyAmounts.get(expense.id) ?? 0, payment);
    }

    private remainingFromAmount(expense: Pick<Expense, 'isFixed'>, monthlyAmount: number, payment: PaymentRecord): number | null {
        if (payment.status !== PaymentStatus.PAID) return null;
        if (expense.isFixed) return 0;
        const paidAmount = payment.paidAmount != null ? Number(payment.paidAmount) : 0;
        return Math.max(0, monthlyAmount - paidAmount);
    }

    private periodKey(year: number, month: number): string {
        return `${year}-${month}`;
    }

    private mapToResponse(record: any, remainingAmount: number | null): ExpensePaymentResponseDto {
        return {
            id: record.id,
            expenseId: record.expenseId,
            month: record.month,
            year: record.year,
            status: record.status,
            paidAt: record.paidAt,
            paidById: record.paidById,
            paidAmount: record.paidAmount != null ? Number(record.paidAmount) : null,
            remainingAmount,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
        };
    }
}
