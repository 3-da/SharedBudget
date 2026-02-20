import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExpenseHelperService } from '../common/expense/expense-helper.service';
import { CacheService } from '../common/cache/cache.service';
import { UpsertOverrideDto } from './dto/upsert-override.dto';
import { UpdateDefaultAmountDto } from './dto/update-default-amount.dto';
import { BatchOverrideItemDto } from './dto/batch-upsert-override.dto';
import { RecurringOverrideResponseDto } from './dto/recurring-override-response.dto';
import { ExpenseCategory, ExpenseType } from '../generated/prisma/enums';

@Injectable()
export class RecurringOverrideService {
    private readonly logger = new Logger(RecurringOverrideService.name);

    constructor(
        private readonly prismaService: PrismaService,
        private readonly expenseHelper: ExpenseHelperService,
        private readonly cacheService: CacheService,
    ) {}

    /**
     * Creates or updates an override for a recurring expense in a specific month.
     * Only household members can override expenses belonging to their household.
     *
     * Use case: A recurring expense has a different amount in a particular month
     * (e.g., a price increase or promotional discount).
     *
     * Scenario: Sam's gym raises the price for July, so Sam sets an override
     * of 55 EUR for July 2026. The default amount stays at 49.99 for other months.
     *
     * @param userId - The authenticated user's ID
     * @param expenseId - The recurring expense ID
     * @param year - Year of the override
     * @param month - Month of the override (1-12)
     * @param dto - Override amount and optional skip flag
     * @returns The created or updated override
     * @throws {NotFoundException} If user is not in a household
     * @throws {NotFoundException} If expense not found in the user's household
     * @throws {BadRequestException} If expense is not recurring
     */
    async upsertOverride(userId: string, expenseId: string, year: number, month: number, dto: UpsertOverrideDto): Promise<RecurringOverrideResponseDto> {
        this.logger.debug(`Upsert override for expense ${expenseId}: ${month}/${year}`);

        const membership = await this.expenseHelper.requireMembership(userId);
        const expense = await this.prismaService.expense.findFirst({
            where: { id: expenseId, householdId: membership.householdId },
        });

        if (!expense) {
            this.logger.warn(`Expense not found: ${expenseId} for user: ${userId}`);
            throw new NotFoundException('Expense not found');
        }

        if (expense.category !== ExpenseCategory.RECURRING) {
            this.logger.warn(`Non-recurring expense override attempt: ${expenseId}`);
            throw new BadRequestException('Only recurring expenses can have overrides');
        }

        const result = await this.prismaService.recurringOverride.upsert({
            where: {
                expenseId_month_year: { expenseId, month, year },
            },
            create: {
                expenseId,
                month,
                year,
                amount: dto.amount,
                skipped: dto.skipped ?? false,
            },
            update: {
                amount: dto.amount,
                skipped: dto.skipped ?? false,
            },
        });

        await this.invalidateCache(userId, expense.type, membership.householdId);
        this.logger.log(`Override saved for expense ${expenseId}: ${month}/${year}`);
        return this.mapToResponse(result);
    }

    /**
     * Updates the default (base) amount of a recurring expense.
     * This affects all future months that do not have a specific override.
     *
     * Use case: The recurring cost changes permanently (e.g., rent increase).
     *
     * Scenario: Sam's rent goes up from 500 to 520 EUR starting next month.
     * Sam updates the default amount so all future months reflect the new price
     * without needing individual overrides.
     *
     * @param userId - The authenticated user's ID
     * @param expenseId - The expense to update
     * @param dto - New default amount
     * @returns Success message
     * @throws {NotFoundException} If user is not in a household
     * @throws {NotFoundException} If expense not found in the user's household
     * @throws {BadRequestException} If expense is not recurring
     */
    async updateDefaultAmount(userId: string, expenseId: string, dto: UpdateDefaultAmountDto): Promise<{ message: string }> {
        this.logger.debug(`Update default amount for expense ${expenseId} to ${dto.amount}`);

        const membership = await this.expenseHelper.requireMembership(userId);
        const expense = await this.prismaService.expense.findFirst({
            where: { id: expenseId, householdId: membership.householdId },
        });

        if (!expense) {
            this.logger.warn(`Expense not found: ${expenseId} for user: ${userId}`);
            throw new NotFoundException('Expense not found');
        }

        if (expense.category !== ExpenseCategory.RECURRING) {
            this.logger.warn(`Non-recurring expense default amount update attempt: ${expenseId}`);
            throw new BadRequestException('Only recurring expenses can have their default amount updated');
        }

        await this.prismaService.expense.update({
            where: { id: expenseId },
            data: { amount: dto.amount },
        });

        await this.invalidateCache(userId, expense.type, membership.householdId);
        this.logger.log(`Default amount updated for expense ${expenseId}: ${dto.amount}`);
        return { message: 'Default amount updated successfully' };
    }

    /**
     * Lists all overrides for a recurring expense, ordered by most recent first.
     *
     * @param userId - The authenticated user's ID
     * @param expenseId - The expense to list overrides for
     * @returns List of overrides sorted by year and month descending
     * @throws {NotFoundException} If user is not in a household
     * @throws {NotFoundException} If expense not found in the user's household
     */
    async listOverrides(userId: string, expenseId: string): Promise<RecurringOverrideResponseDto[]> {
        this.logger.debug(`List overrides for expense: ${expenseId}`);

        const membership = await this.expenseHelper.requireMembership(userId);
        const expense = await this.prismaService.expense.findFirst({
            where: { id: expenseId, householdId: membership.householdId },
        });

        if (!expense) {
            this.logger.warn(`Expense not found: ${expenseId} for user: ${userId}`);
            throw new NotFoundException('Expense not found');
        }

        const overrides = await this.prismaService.recurringOverride.findMany({
            where: { expenseId },
            orderBy: [{ year: 'desc' }, { month: 'desc' }],
        });

        return overrides.map((o) => this.mapToResponse(o));
    }

    /**
     * Deletes a single override for a specific month, resetting to the default amount.
     *
     * Use case: Sam previously set a custom amount for July but now wants it
     * back to the default. Sam clicks "Undo" to remove that month's override.
     *
     * @param userId - The authenticated user's ID
     * @param expenseId - The recurring expense ID
     * @param year - Year of the override to delete
     * @param month - Month of the override to delete
     * @returns Success message
     * @throws {NotFoundException} If user is not in a household
     * @throws {NotFoundException} If expense not found in the user's household
     */
    async deleteOverride(userId: string, expenseId: string, year: number, month: number): Promise<{ message: string }> {
        this.logger.debug(`Delete override for expense ${expenseId}: ${month}/${year}`);

        const membership = await this.expenseHelper.requireMembership(userId);
        const expense = await this.prismaService.expense.findFirst({
            where: { id: expenseId, householdId: membership.householdId },
        });

        if (!expense) {
            this.logger.warn(`Expense not found: ${expenseId} for user: ${userId}`);
            throw new NotFoundException('Expense not found');
        }

        await this.prismaService.recurringOverride.deleteMany({
            where: { expenseId, month, year },
        });

        await this.invalidateCache(userId, expense.type, membership.householdId);
        this.logger.log(`Override deleted for expense ${expenseId}: ${month}/${year}`);
        return { message: 'Override removed' };
    }

    /**
     * Deletes all overrides for a recurring expense.
     *
     * Use case: When a user edits the base expense amount and wants to reset
     * all per-month customizations back to the new default.
     *
     * Scenario: Sam updates the gym membership base price from 49.99 to 55 EUR.
     * Sam then clears all existing overrides so every month uses the new price.
     *
     * @param userId - The authenticated user's ID
     * @param expenseId - The recurring expense ID
     * @returns Count of deleted overrides
     * @throws {NotFoundException} If user is not in a household
     * @throws {NotFoundException} If expense not found in the user's household
     */
    async deleteAllOverrides(userId: string, expenseId: string): Promise<{ message: string }> {
        this.logger.debug(`Delete all overrides for expense ${expenseId}`);

        const membership = await this.expenseHelper.requireMembership(userId);
        const expense = await this.prismaService.expense.findFirst({
            where: { id: expenseId, householdId: membership.householdId },
        });

        if (!expense) {
            this.logger.warn(`Expense not found: ${expenseId} for user: ${userId}`);
            throw new NotFoundException('Expense not found');
        }

        const { count } = await this.prismaService.recurringOverride.deleteMany({
            where: { expenseId },
        });

        await this.invalidateCache(userId, expense.type, membership.householdId);
        this.logger.log(`Deleted ${count} overrides for expense ${expenseId}`);
        return { message: `Deleted ${count} override(s)` };
    }

    /**
     * Creates or updates multiple overrides for a recurring expense in a single operation.
     * Uses a Prisma transaction to ensure all overrides are applied atomically.
     *
     * Use case: When a user changes the amount for "all upcoming months" on the
     * recurring timeline, the frontend sends all future month overrides in one batch
     * instead of making individual requests that could hit rate limits.
     *
     * Scenario: Sam's gym increases the price from 49.99 to 55 EUR starting July.
     * Sam selects "Apply to all upcoming" which sends overrides for Jul-Dec 2026
     * in a single batch request.
     *
     * @param userId - The authenticated user's ID
     * @param expenseId - The recurring expense ID
     * @param overrides - Array of {year, month, amount, skipped} objects
     * @returns Array of created/updated overrides
     * @throws {NotFoundException} If user is not in a household
     * @throws {NotFoundException} If expense not found in the user's household
     * @throws {BadRequestException} If expense is not recurring
     */
    async batchUpsertOverrides(userId: string, expenseId: string, overrides: BatchOverrideItemDto[]): Promise<RecurringOverrideResponseDto[]> {
        this.logger.debug(`Batch upsert ${overrides.length} overrides for expense ${expenseId}`);

        const membership = await this.expenseHelper.requireMembership(userId);
        const expense = await this.prismaService.expense.findFirst({
            where: { id: expenseId, householdId: membership.householdId },
        });

        if (!expense) {
            this.logger.warn(`Expense not found: ${expenseId} for user: ${userId}`);
            throw new NotFoundException('Expense not found');
        }

        if (expense.category !== ExpenseCategory.RECURRING) {
            this.logger.warn(`Non-recurring expense batch override attempt: ${expenseId}`);
            throw new BadRequestException('Only recurring expenses can have overrides');
        }

        const results = await this.prismaService.$transaction(
            overrides.map((o) =>
                this.prismaService.recurringOverride.upsert({
                    where: {
                        expenseId_month_year: { expenseId, month: o.month, year: o.year },
                    },
                    create: {
                        expenseId,
                        month: o.month,
                        year: o.year,
                        amount: o.amount,
                        skipped: o.skipped ?? false,
                    },
                    update: {
                        amount: o.amount,
                        skipped: o.skipped ?? false,
                    },
                }),
            ),
        );

        await this.invalidateCache(userId, expense.type, membership.householdId);
        this.logger.log(`Batch upserted ${results.length} overrides for expense ${expenseId}`);
        return results.map((r) => this.mapToResponse(r));
    }

    /**
     * Deletes all overrides for a recurring expense from a given month forward.
     * Useful for undoing "all upcoming" overrides.
     *
     * Use case: Sam previously applied an override to all upcoming months but now
     * wants to revert. Sam clicks "Undo all upcoming" which deletes overrides
     * from the selected month onward.
     *
     * @param userId - The authenticated user's ID
     * @param expenseId - The recurring expense ID
     * @param fromYear - Starting year (inclusive)
     * @param fromMonth - Starting month (inclusive, 1-12)
     * @returns Count of deleted overrides
     * @throws {NotFoundException} If user is not in a household
     * @throws {NotFoundException} If expense not found in the user's household
     */
    async deleteUpcomingOverrides(userId: string, expenseId: string, fromYear: number, fromMonth: number): Promise<{ message: string }> {
        this.logger.debug(`Delete upcoming overrides for expense ${expenseId} from ${fromMonth}/${fromYear}`);

        const membership = await this.expenseHelper.requireMembership(userId);
        const expense = await this.prismaService.expense.findFirst({
            where: { id: expenseId, householdId: membership.householdId },
        });

        if (!expense) {
            this.logger.warn(`Expense not found: ${expenseId} for user: ${userId}`);
            throw new NotFoundException('Expense not found');
        }

        const { count } = await this.prismaService.recurringOverride.deleteMany({
            where: {
                expenseId,
                OR: [{ year: { gt: fromYear } }, { year: fromYear, month: { gte: fromMonth } }],
            },
        });

        await this.invalidateCache(userId, expense.type, membership.householdId);
        this.logger.log(`Deleted ${count} upcoming overrides for expense ${expenseId} from ${fromMonth}/${fromYear}`);
        return { message: `Deleted ${count} upcoming override(s)` };
    }

    private async invalidateCache(userId: string, expenseType: ExpenseType, householdId: string): Promise<void> {
        if (expenseType === ExpenseType.PERSONAL) {
            await this.cacheService.invalidatePersonalExpenses(userId);
        } else {
            await this.cacheService.invalidateSharedExpenses(householdId);
        }
        await this.cacheService.invalidateDashboard(householdId);
    }

    private mapToResponse(record: {
        id: string;
        expenseId: string;
        month: number;
        year: number;
        amount: number | { toNumber(): number } | null;
        skipped: boolean;
        createdAt: Date;
        updatedAt: Date;
    }): RecurringOverrideResponseDto {
        return {
            id: record.id,
            expenseId: record.expenseId,
            month: record.month,
            year: record.year,
            amount: Number(record.amount),
            skipped: record.skipped,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
        };
    }
}
