import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ApprovalStatus, ExpenseType } from '../../generated/prisma/enums';

@Injectable()
export class ExpenseHelperService {
    private readonly logger = new Logger(ExpenseHelperService.name);

    constructor(private readonly prismaService: PrismaService) {}

    /**
     * Resolves the authenticated user's household membership.
     *
     * @param userId - The authenticated user's ID
     * @returns The household membership record
     * @throws {NotFoundException} If the user is not a member of any household
     */
    async requireMembership(userId: string) {
        const membership = await this.prismaService.householdMember.findUnique({ where: { userId } });

        if (!membership) {
            this.logger.warn(`User not in a household: ${userId}`);
            throw new NotFoundException('You must be in a household to manage expenses');
        }

        return membership;
    }

    /**
     * Finds an expense by ID within the given household and type, or throws.
     *
     * @param expenseId - The expense ID to look up
     * @param householdId - The household to scope the search to
     * @param type - The expense type (PERSONAL or SHARED)
     * @returns The expense record
     * @throws {NotFoundException} If the expense does not exist, is deleted, or belongs to another household
     */
    async findExpenseOrFail(expenseId: string, householdId: string, type: ExpenseType) {
        const label = type === ExpenseType.PERSONAL ? 'Personal' : 'Shared';

        const expense = await this.prismaService.expense.findFirst({
            where: { id: expenseId, type, householdId },
        });

        if (!expense) {
            this.logger.warn(`${label} expense not found: ${expenseId}`);
            throw new NotFoundException(`${label} expense not found`);
        }

        return expense;
    }

    /**
     * Validates that the given paidByUserId belongs to a member of the specified household.
     *
     * @param paidByUserId - The user ID to validate
     * @param householdId - The household they must belong to
     * @throws {NotFoundException} If the user is not a member of the household
     */
    async validatePaidByUserId(paidByUserId: string, householdId: string) {
        const member = await this.prismaService.householdMember.findUnique({ where: { userId: paidByUserId } });

        if (!member || member.householdId !== householdId) {
            this.logger.warn(`paidByUserId: ${paidByUserId} is not a member of household: ${householdId}`);
            throw new NotFoundException('The specified payer is not a member of this household');
        }
    }

    /**
     * Ensures there is no pending approval for the given expense.
     *
     * @param expenseId - The expense to check
     * @throws {ConflictException} If a pending approval already exists
     */
    async checkNoPendingApproval(expenseId: string) {
        const existing = await this.prismaService.expenseApproval.findFirst({
            where: { expenseId, status: ApprovalStatus.PENDING },
        });

        if (existing) {
            this.logger.warn(`Pending approval already exists for expense: ${expenseId}`);
            throw new ConflictException('There is already a pending approval for this expense');
        }
    }
}
