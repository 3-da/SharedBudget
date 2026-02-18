import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SharedExpenseResponseDto } from './dto/shared-expense-response.dto';
import { ListSharedExpensesQueryDto } from './dto/list-shared-expenses-query.dto';
import { ApprovalAction, ApprovalStatus, ExpenseType } from '../generated/prisma/enums';
import { ApprovalResponseDto } from '../approval/dto/approval-response.dto';
import { CreateSharedExpenseDto } from './dto/create-shared-expense.dto';
import { UpdateSharedExpenseDto } from './dto/update-shared-expense.dto';
import { Prisma } from '../generated/prisma/client';
import { ExpenseHelperService } from '../common/expense/expense-helper.service';
import { buildExpenseNullableFields, EXPENSE_FIELDS, mapToApprovalResponse, mapToSharedExpenseResponse } from '../common/expense/expense.mappers';
import { pickDefined } from '../common/utils/pick-defined';
import { CacheService } from '../common/cache/cache.service';

@Injectable()
export class SharedExpenseService {
    private readonly logger = new Logger(SharedExpenseService.name);

    constructor(
        private readonly prismaService: PrismaService,
        private readonly expenseHelper: ExpenseHelperService,
        private readonly cacheService: CacheService,
    ) {}

    /**
     * Lists all shared expenses belonging to the authenticated user's household.
     * Supports optional filtering by category and frequency.
     *
     * Use case: User views the household's shared expenses page.
     *
     * Scenario: Sam opens "Shared Expenses" and sees the rent, utilities,
     * and groceries that the household shares with Alex.
     *
     * @param userId - The authenticated user's ID
     * @param query - Optional filters (category, frequency)
     * @returns Array of shared expenses matching the filters
     * @throws {NotFoundException} If the user is not a member of any household
     */
    async listSharedExpenses(userId: string, query: ListSharedExpensesQueryDto): Promise<SharedExpenseResponseDto[]> {
        this.logger.debug(`List shared expenses for user: ${userId}`);

        const membership = await this.expenseHelper.requireMembership(userId);

        const filterHash = this.cacheService.hashParams({ category: query.category, frequency: query.frequency });
        const cacheKey = this.cacheService.sharedExpensesKey(membership.householdId, filterHash);

        return this.cacheService.getOrSet(cacheKey, this.cacheService.expensesTTL, async () => {
            const where: Prisma.ExpenseWhereInput = {
                householdId: membership.householdId,
                type: ExpenseType.SHARED,
            };

            if (query.category) where.category = query.category;
            if (query.frequency) where.frequency = query.frequency;

            const expenses = await this.prismaService.expense.findMany({ where, orderBy: { createdAt: 'desc' } });

            return expenses.map((expense) => mapToSharedExpenseResponse(expense));
        });
    }

    /**
     * Retrieves a single shared expense by ID.
     * Accessible by any member of the same household.
     *
     * Use case: Viewing expense details or reviewing a shared cost.
     *
     * Scenario: Alex clicks on "Monthly Rent" to see the full details
     * including who pays and the payment strategy.
     *
     * @param userId - The authenticated user's ID
     * @param expenseId - The expense ID to retrieve
     * @returns The expense details
     * @throws {NotFoundException} If the user is not a member of any household
     * @throws {NotFoundException} If the expense does not exist or belongs to a different household
     */
    async getSharedExpense(userId: string, expenseId: string): Promise<SharedExpenseResponseDto> {
        this.logger.debug(`Get shared expense: ${expenseId} for user: ${userId}`);

        const membership = await this.expenseHelper.requireMembership(userId);
        const expense = await this.expenseHelper.findExpenseOrFail(expenseId, membership.householdId, ExpenseType.SHARED);

        return mapToSharedExpenseResponse(expense);
    }

    /**
     * Proposes creating a new shared expense. Does NOT create the expense directly —
     * instead creates a pending approval that must be accepted by the other household member(s).
     *
     * Use case: A household member wants to add a new shared cost (e.g., rent, utilities).
     *
     * Scenario: Sam proposes adding "Monthly Rent — €800" as a shared expense split
     * equally. Alex receives a pending approval and must accept before the expense
     * becomes active in the household budget.
     *
     * @param userId - The authenticated user's ID (the proposer)
     * @param dto - Proposed expense details (name, amount, category, frequency, paidByUserId, etc.)
     * @returns The created approval record
     * @throws {NotFoundException} If the user is not a member of any household
     * @throws {NotFoundException} If paidByUserId is provided but that user is not in the same
     * household
     */
    async proposeCreateSharedExpense(userId: string, dto: CreateSharedExpenseDto): Promise<ApprovalResponseDto> {
        this.logger.log(`Propose create shared expense for user: ${userId}`);

        const membership = await this.expenseHelper.requireMembership(userId);

        if (dto.paidByUserId) {
            await this.expenseHelper.validatePaidByUserId(dto.paidByUserId, membership.householdId);
        }

        const proposedData = {
            name: dto.name,
            amount: dto.amount,
            category: dto.category,
            frequency: dto.frequency,
            paidByUserId: dto.paidByUserId ?? null,
            ...buildExpenseNullableFields(dto),
        };

        const approval = await this.prismaService.expenseApproval.create({
            data: {
                householdId: membership.householdId,
                action: ApprovalAction.CREATE,
                status: ApprovalStatus.PENDING,
                requestedById: userId,
                expenseId: null,
                proposedData,
            },
        });

        this.logger.log(`Approval created: ${approval.id} for proposed shared expense by user: ${userId}`);

        await this.cacheService.invalidateApprovals(membership.householdId);

        return mapToApprovalResponse(approval);
    }

    /**
     * Proposes updating an existing shared expense. Does NOT apply the changes directly —
     * instead creates a pending approval with the proposed changes.
     *
     * Use case: A household member wants to change the amount or payment strategy of an existing
     * shared expense.
     *
     * Scenario: Sam notices the rent increased from €800 to €850. Sam proposes the update.
     * Alex must accept the change before the expense amount is updated.
     *
     * @param userId - The authenticated user's ID (the proposer)
     * @param expenseId - The shared expense to propose changes for
     * @param dto - Proposed changes (all fields optional)
     * @returns The created approval record
     * @throws {NotFoundException} If the user is not a member of any household
     * @throws {NotFoundException} If the expense does not exist or belongs to a different household
     * @throws {ConflictException} If there is already a pending approval for this expense
     * @throws {NotFoundException} If paidByUserId is provided but that user is not in the same
     * household
     */
    async proposeUpdateSharedExpense(userId: string, expenseId: string, dto: UpdateSharedExpenseDto): Promise<ApprovalResponseDto> {
        this.logger.log(`Propose update shared expense: ${expenseId} for user: ${userId}`);

        const membership = await this.expenseHelper.requireMembership(userId);
        await this.expenseHelper.findExpenseOrFail(expenseId, membership.householdId, ExpenseType.SHARED);
        await this.expenseHelper.checkNoPendingApproval(expenseId);

        if (dto.paidByUserId) await this.expenseHelper.validatePaidByUserId(dto.paidByUserId, membership.householdId);

        const proposedData = pickDefined(dto, [...EXPENSE_FIELDS, 'paidByUserId']);

        const approval = await this.prismaService.expenseApproval.create({
            data: {
                householdId: membership.householdId,
                action: ApprovalAction.UPDATE,
                status: ApprovalStatus.PENDING,
                requestedById: userId,
                expenseId,
                proposedData,
            },
        });

        this.logger.log(`Approval created: ${approval.id} for updating expense: ${expenseId}`);

        await this.cacheService.invalidateApprovals(membership.householdId);

        return mapToApprovalResponse(approval);
    }

    /**
     * Proposes deleting an existing shared expense. Does NOT remove the expense directly —
     * instead creates a pending approval for the deletion.
     *
     * Use case: A household member wants to remove a shared expense that is no longer relevant.
     *
     * Scenario: Sam and Alex cancel their shared streaming subscription. Sam proposes
     * deleting the expense. Alex must accept before it is removed from the budget.
     *
     * @param userId - The authenticated user's ID (the proposer)
     * @param expenseId - The shared expense to propose deletion for
     * @returns The created approval record
     * @throws {NotFoundException} If the user is not a member of any household
     * @throws {NotFoundException} If the expense does not exist or belongs to a different household
     * @throws {ConflictException} If there is already a pending approval for this expense
     */
    async proposeDeleteSharedExpense(userId: string, expenseId: string): Promise<ApprovalResponseDto> {
        this.logger.log(`Propose delete shared expense: ${expenseId} for user: ${userId}`);

        const membership = await this.expenseHelper.requireMembership(userId);
        await this.expenseHelper.findExpenseOrFail(expenseId, membership.householdId, ExpenseType.SHARED);
        await this.expenseHelper.checkNoPendingApproval(expenseId);

        const approval = await this.prismaService.expenseApproval.create({
            data: {
                householdId: membership.householdId,
                action: ApprovalAction.DELETE,
                status: ApprovalStatus.PENDING,
                requestedById: userId,
                expenseId,
            },
        });

        this.logger.log(`Approval created: ${approval.id} for deleting expense: ${expenseId}`);

        await this.cacheService.invalidateApprovals(membership.householdId);

        return mapToApprovalResponse(approval);
    }
}
