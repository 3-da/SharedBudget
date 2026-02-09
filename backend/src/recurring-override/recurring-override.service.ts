import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExpenseHelperService } from '../common/expense/expense-helper.service';
import { CacheService } from '../common/cache/cache.service';
import { UpsertOverrideDto } from './dto/upsert-override.dto';
import { UpdateDefaultAmountDto } from './dto/update-default-amount.dto';
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
    async upsertOverride(
        userId: string,
        expenseId: string,
        year: number,
        month: number,
        dto: UpsertOverrideDto,
    ): Promise<RecurringOverrideResponseDto> {
        this.logger.debug(`Upsert override for expense ${expenseId}: ${month}/${year}`);

        const membership = await this.expenseHelper.requireMembership(userId);
        const expense = await this.prismaService.expense.findFirst({
            where: { id: expenseId, householdId: membership.householdId, deletedAt: null },
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
    async updateDefaultAmount(
        userId: string,
        expenseId: string,
        dto: UpdateDefaultAmountDto,
    ): Promise<{ message: string }> {
        this.logger.debug(`Update default amount for expense ${expenseId} to ${dto.amount}`);

        const membership = await this.expenseHelper.requireMembership(userId);
        const expense = await this.prismaService.expense.findFirst({
            where: { id: expenseId, householdId: membership.householdId, deletedAt: null },
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
            where: { id: expenseId, householdId: membership.householdId, deletedAt: null },
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

    private async invalidateCache(userId: string, expenseType: ExpenseType, householdId: string): Promise<void> {
        if (expenseType === ExpenseType.PERSONAL) {
            await this.cacheService.invalidatePersonalExpenses(userId);
        } else {
            await this.cacheService.invalidateSharedExpenses(householdId);
        }
        await this.cacheService.invalidateDashboard(householdId);
    }

    private mapToResponse(record: any): RecurringOverrideResponseDto {
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
