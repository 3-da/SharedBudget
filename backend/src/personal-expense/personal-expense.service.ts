import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ListPersonalExpensesQueryDto } from './dto/list-personal-expenses-query.dto';
import { PersonalExpenseResponseDto } from './dto/personal-expense-response.dto';
import { CreatePersonalExpenseDto } from './dto/create-personal-expense.dto';
import { UpdatePersonalExpenseDto } from './dto/update-personal-expense.dto';
import { MessageResponseDto } from '../common/dto/message-response.dto';
import { ExpenseType } from '../generated/prisma/enums';
import { Prisma } from '../generated/prisma/client';
import { ExpenseHelperService } from '../common/expense/expense-helper.service';
import { mapToPersonalExpenseResponse, buildExpenseNullableFields, EXPENSE_FIELDS } from '../common/expense/expense.mappers';
import { pickDefined } from '../common/utils/pick-defined';
import { CacheService } from '../common/cache/cache.service';

@Injectable()
export class PersonalExpenseService {
    private readonly logger = new Logger(PersonalExpenseService.name);

    constructor(
        private readonly prismaService: PrismaService,
        private readonly expenseHelper: ExpenseHelperService,
        private readonly cacheService: CacheService,
    ) {}

    /**
     * Lists all personal expenses belonging to the authenticated user.
     * Supports optional filtering by category and frequency.
     *
     * Use case: User reviews their personal spending on the expenses page.
     *
     * Scenario: Sam opens "My Expenses" and filters by RECURRING to see
     * only ongoing costs like gym, subscriptions, etc.
     *
     * @param userId - The authenticated user's ID
     * @param query - Optional filters (category, frequency)
     * @returns Array of personal expenses matching the filters
     * @throws {NotFoundException} If the user is not a member of any household
     */
    async listPersonalExpenses(userId: string, query: ListPersonalExpensesQueryDto): Promise<PersonalExpenseResponseDto[]> {
        this.logger.debug(`List personal expenses for user: ${userId}`);

        await this.expenseHelper.requireMembership(userId);

        const filterHash = this.cacheService.hashParams({ category: query.category, frequency: query.frequency });
        const cacheKey = this.cacheService.personalExpensesKey(userId, filterHash);

        return this.cacheService.getOrSet(cacheKey, this.cacheService.expensesTTL, async () => {
            const where: Prisma.ExpenseWhereInput = {
                createdById: userId,
                type: ExpenseType.PERSONAL,
            };

            if (query.category) where.category = query.category;
            if (query.frequency) where.frequency = query.frequency;

            const expenses = await this.prismaService.expense.findMany({
                where,
                orderBy: { createdAt: 'desc' },
            });

            return expenses.map((expense) => mapToPersonalExpenseResponse(expense));
        });
    }

    /**
     * Creates a new personal expense for the authenticated user.
     * The expense is automatically assigned to the user's household.
     *
     * Use case: User adds a new recurring or one-time personal cost.
     *
     * Scenario: Sam adds a "Gym membership" expense — €49.99/month, RECURRING,
     * MONTHLY frequency. The system sets type=PERSONAL and links it to
     * Sam's household so Alex can see it in the budget overview.
     *
     * @param userId - The authenticated user's ID
     * @param dto - Expense details (name, amount, category, frequency, etc.)
     * @returns The created expense
     * @throws {NotFoundException} If the user is not a member of any household
     */
    async createPersonalExpense(userId: string, dto: CreatePersonalExpenseDto): Promise<PersonalExpenseResponseDto> {
        this.logger.log(`Create personal expense for user: ${userId}`);

        const membership = await this.expenseHelper.requireMembership(userId);

        const expense = await this.prismaService.expense.create({
            data: {
                householdId: membership.householdId,
                createdById: userId,
                name: dto.name,
                amount: dto.amount,
                type: ExpenseType.PERSONAL,
                category: dto.category,
                frequency: dto.frequency,
                ...buildExpenseNullableFields(dto),
            },
        });

        this.logger.log(`Personal expense created: ${expense.id} for user: ${userId}`);

        await this.invalidatePersonalCaches(userId, membership.householdId);

        return mapToPersonalExpenseResponse(expense);
    }

    /**
     * Retrieves a single personal expense by ID.
     * Accessible by the creator and any member of the same household.
     *
     * Use case: Viewing expense details, or a household partner reviewing
     * the other person's expense in the budget overview.
     *
     * Scenario: Alex views Sam's "Gym membership" expense to understand
     * how it affects the household budget. Alex is in the same household
     * so access is granted, but Alex cannot edit it.
     *
     * @param userId - The authenticated user's ID
     * @param expenseId - The expense ID to retrieve
     * @returns The expense details
     * @throws {NotFoundException} If the user is not a member of any household
     * @throws {NotFoundException} If the expense does not exist or belongs to a different household
     */
    async getPersonalExpense(userId: string, expenseId: string): Promise<PersonalExpenseResponseDto> {
        this.logger.log(`Get personal expense: ${expenseId} for user: ${userId}`);

        const membership = await this.expenseHelper.requireMembership(userId);
        const expense = await this.expenseHelper.findExpenseOrFail(expenseId, membership.householdId, ExpenseType.PERSONAL);

        return mapToPersonalExpenseResponse(expense);
    }

    /**
     * Updates a personal expense. Only the creator can modify their own expenses.
     *
     * Use case: User corrects the amount or changes the frequency of an existing expense.
     *
     * Scenario: Sam's gym raised prices from €49.99 to €54.99. Sam updates
     * the amount. Alex can see the updated figure but cannot edit it.
     *
     * @param userId - The authenticated user's ID (must be the creator)
     * @param expenseId - The expense ID to update
     * @param dto - Fields to update (all optional)
     * @returns The updated expense
     * @throws {NotFoundException} If the user is not a member of any household
     * @throws {NotFoundException} If the expense does not exist or belongs to a different household
     * @throws {ForbiddenException} If the user is not the expense creator
     */
    async updatePersonalExpense(userId: string, expenseId: string, dto: UpdatePersonalExpenseDto): Promise<PersonalExpenseResponseDto> {
        this.logger.log(`Update personal expense: ${expenseId} for user: ${userId}`);

        const membership = await this.expenseHelper.requireMembership(userId);
        const expense = await this.expenseHelper.findExpenseOrFail(expenseId, membership.householdId, ExpenseType.PERSONAL);

        if (expense.createdById !== userId) {
            this.logger.warn(`User ${userId} attempted to update expense owned by ${expense.createdById}`);
            throw new ForbiddenException('You can only modify your own personal expenses');
        }

        const updated = await this.prismaService.expense.update({
            where: { id: expenseId },
            data: pickDefined(dto, [...EXPENSE_FIELDS]),
        });

        this.logger.log(`Personal expense updated: ${expenseId}`);

        await this.invalidatePersonalCaches(userId, membership.householdId);

        return mapToPersonalExpenseResponse(updated);
    }

    /**
     * Soft-deletes a personal expense. Only the creator can delete their own expenses.
     *
     * Use case: User cancels a subscription or removes an expense that no longer applies.
     *
     * Scenario: Sam cancels their gym membership and deletes the expense.
     * The record is soft-deleted (deletedAt is set) so it can be recovered
     * or audited later. It no longer appears in budget calculations.
     *
     * @param userId - The authenticated user's ID (must be the creator)
     * @param expenseId - The expense ID to delete
     * @returns Success message
     * @throws {NotFoundException} If the user is not a member of any household
     * @throws {NotFoundException} If the expense does not exist or belongs to a different household
     * @throws {ForbiddenException} If the user is not the expense creator
     */
    async deletePersonalExpense(userId: string, expenseId: string): Promise<MessageResponseDto> {
        this.logger.log(`Delete personal expense: ${expenseId} for user: ${userId}`);

        const membership = await this.expenseHelper.requireMembership(userId);
        const expense = await this.expenseHelper.findExpenseOrFail(expenseId, membership.householdId, ExpenseType.PERSONAL);

        if (expense.createdById !== userId) {
            this.logger.warn(`User ${userId} attempted to delete expense owned by ${expense.createdById}`);
            throw new ForbiddenException('You can only delete your own personal expenses');
        }

        await this.prismaService.expense.update({ where: { id: expenseId }, data: { deletedAt: new Date() } });

        this.logger.log(`Personal expense deleted: ${expenseId}`);

        await this.invalidatePersonalCaches(userId, membership.householdId);

        return { message: 'Personal expense deleted successfully.' };
    }

    private async invalidatePersonalCaches(userId: string, householdId: string): Promise<void> {
        await Promise.all([
            this.cacheService.invalidatePersonalExpenses(userId),
            this.cacheService.invalidateDashboard(householdId),
            this.cacheService.invalidateSavings(householdId),
        ]);
    }
}
