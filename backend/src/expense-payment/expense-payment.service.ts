import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExpenseHelperService } from '../common/expense/expense-helper.service';
import { CacheService } from '../common/cache/cache.service';
import { MarkPaidDto } from './dto/mark-paid.dto';
import { ExpensePaymentResponseDto } from './dto/expense-payment-response.dto';
import { PaymentStatus, ExpenseType } from '../generated/prisma/enums';

@Injectable()
export class ExpensePaymentService {
    private readonly logger = new Logger(ExpensePaymentService.name);

    constructor(
        private readonly prismaService: PrismaService,
        private readonly expenseHelper: ExpenseHelperService,
        private readonly cacheService: CacheService,
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
     * @param dto - Month and year to mark as paid
     * @returns The created or updated payment status record
     * @throws {NotFoundException} If the user is not a member of any household
     * @throws {NotFoundException} If the expense is not found in the user's household
     */
    async markPaid(userId: string, expenseId: string, dto: MarkPaidDto): Promise<ExpensePaymentResponseDto> {
        this.logger.debug(`Mark expense paid: ${expenseId} for ${dto.month}/${dto.year} by user ${userId}`);

        const membership = await this.expenseHelper.requireMembership(userId);
        const expense = await this.findExpenseInHousehold(expenseId, membership.householdId);

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
            },
            update: {
                status: PaymentStatus.PAID,
                paidAt: new Date(),
                paidById: userId,
            },
        });

        await this.invalidateCache(userId, expense.type, membership.householdId);
        this.logger.log(`Expense ${expenseId} marked as paid for ${dto.month}/${dto.year}`);
        return this.mapToResponse(result);
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
        const expense = await this.findExpenseInHousehold(expenseId, membership.householdId);

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
            },
        });

        await this.invalidateCache(userId, expense.type, membership.householdId);
        this.logger.log(`Expense ${expenseId} payment undone for ${dto.month}/${dto.year}`);
        return this.mapToResponse(result);
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
        const expense = await this.findExpenseInHousehold(expenseId, membership.householdId);

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

        await this.invalidateCache(userId, expense.type, membership.householdId);
        this.logger.log(`Expense ${expenseId} cancelled for ${dto.month}/${dto.year}`);
        return this.mapToResponse(result);
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
        await this.findExpenseInHousehold(expenseId, membership.householdId);

        const statuses = await this.prismaService.expensePaymentStatus.findMany({
            where: { expenseId },
            orderBy: [{ year: 'desc' }, { month: 'desc' }],
        });

        return statuses.map((s) => this.mapToResponse(s));
    }

    /**
     * Finds an expense within the user's household, or throws NotFoundException.
     * Only returns non-deleted expenses.
     */
    private async findExpenseInHousehold(expenseId: string, householdId: string) {
        const expense = await this.prismaService.expense.findFirst({
            where: { id: expenseId, householdId, deletedAt: null },
        });

        if (!expense) {
            this.logger.warn(`Expense not found: ${expenseId} in household ${householdId}`);
            throw new NotFoundException('Expense not found');
        }

        return expense;
    }

    private async invalidateCache(userId: string, expenseType: ExpenseType, householdId: string): Promise<void> {
        if (expenseType === ExpenseType.PERSONAL) {
            await this.cacheService.invalidatePersonalExpenses(userId);
        } else {
            await this.cacheService.invalidateSharedExpenses(householdId);
        }
        await this.cacheService.invalidateDashboard(householdId);
    }

    private mapToResponse(record: any): ExpensePaymentResponseDto {
        return {
            id: record.id,
            expenseId: record.expenseId,
            month: record.month,
            year: record.year,
            status: record.status,
            paidAt: record.paidAt,
            paidById: record.paidById,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
        };
    }
}
