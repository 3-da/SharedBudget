import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExpenseHelperService } from '../common/expense/expense-helper.service';
import { CacheService } from '../common/cache/cache.service';
import { AddSavingDto } from './dto/add-saving.dto';
import { WithdrawSavingDto } from './dto/withdraw-saving.dto';
import { SavingResponseDto } from './dto/saving-response.dto';
import { ApprovalAction, ApprovalStatus } from '../generated/prisma/enums';

@Injectable()
export class SavingService {
    private readonly logger = new Logger(SavingService.name);

    constructor(
        private readonly prismaService: PrismaService,
        private readonly expenseHelper: ExpenseHelperService,
        private readonly cacheService: CacheService,
    ) {}

    /**
     * Returns the authenticated user's savings (personal + shared) for the current month.
     *
     * Scenario: Sam opens the savings page and sees both personal and shared savings
     * for the current month.
     *
     * @param userId - The authenticated user's ID
     * @returns List of savings (personal and shared) for current month
     * @throws {NotFoundException} If user is not a member of any household
     */
    async getMySavings(userId: string, reqMonth?: number, reqYear?: number): Promise<SavingResponseDto[]> {
        this.logger.debug(`Get savings for user: ${userId}`);

        await this.expenseHelper.requireMembership(userId);

        const now = new Date();
        const month = reqMonth ?? now.getMonth() + 1;
        const year = reqYear ?? now.getFullYear();

        const savings = await this.prismaService.saving.findMany({
            where: { userId, month, year },
            orderBy: { isShared: 'asc' },
        });

        return savings.map((s) => this.mapToResponse(s));
    }

    /**
     * Adds an amount to the user's personal savings for a given month.
     * If no saving exists for the month, creates one with the given amount.
     * If one exists, increments the current amount.
     *
     * Scenario: Sam has 100 EUR personal savings for June. Sam adds 50 EUR,
     * resulting in 150 EUR total.
     *
     * @param userId - The authenticated user's ID
     * @param dto - Amount to add and optional month/year
     * @returns The updated saving record
     * @throws {NotFoundException} If user is not a member of any household
     */
    async addPersonalSaving(userId: string, dto: AddSavingDto): Promise<SavingResponseDto> {
        this.logger.debug(`Add personal saving for user: ${userId}`);

        const membership = await this.expenseHelper.requireMembership(userId);

        const now = new Date();
        const month = dto.month ?? now.getMonth() + 1;
        const year = dto.year ?? now.getFullYear();

        const existing = await this.prismaService.saving.findUnique({
            where: { userId_month_year_isShared: { userId, month, year, isShared: false } },
        });

        let result;
        if (existing) {
            result = await this.prismaService.saving.update({
                where: { id: existing.id },
                data: { amount: Number(existing.amount) + dto.amount },
            });
        } else {
            result = await this.prismaService.saving.create({
                data: {
                    userId,
                    householdId: membership.householdId,
                    amount: dto.amount,
                    month,
                    year,
                    isShared: false,
                },
            });
        }

        await Promise.all([this.cacheService.invalidateSavings(membership.householdId), this.cacheService.invalidateDashboard(membership.householdId)]);
        this.logger.log(`Personal saving added for user ${userId}: ${month}/${year} +${dto.amount}`);
        return this.mapToResponse(result);
    }

    /**
     * Withdraws an amount from the user's personal savings for a given month.
     * The withdrawal is applied immediately (no approval needed for personal savings).
     *
     * Scenario: Sam has 150 EUR personal savings for June. Sam withdraws 50 EUR,
     * resulting in 100 EUR. If Sam tries to withdraw more than 150, a BadRequestException is thrown.
     *
     * @param userId - The authenticated user's ID
     * @param dto - Amount to withdraw and optional month/year
     * @returns The updated saving record
     * @throws {NotFoundException} If user is not a member of any household
     * @throws {NotFoundException} If no personal saving exists for the specified month
     * @throws {BadRequestException} If withdrawal amount exceeds current savings
     */
    async withdrawPersonalSaving(userId: string, dto: WithdrawSavingDto): Promise<SavingResponseDto> {
        this.logger.debug(`Withdraw personal saving for user: ${userId}`);

        const membership = await this.expenseHelper.requireMembership(userId);

        const now = new Date();
        const month = dto.month ?? now.getMonth() + 1;
        const year = dto.year ?? now.getFullYear();

        const existing = await this.prismaService.saving.findUnique({
            where: { userId_month_year_isShared: { userId, month, year, isShared: false } },
        });

        if (!existing) {
            throw new NotFoundException('No personal savings found for this month');
        }

        const currentAmount = Number(existing.amount);
        if (dto.amount > currentAmount) {
            throw new BadRequestException(`Withdrawal amount (${dto.amount}) exceeds current savings (${currentAmount})`);
        }

        const newAmount = currentAmount - dto.amount;

        const result = await this.prismaService.saving.update({
            where: { id: existing.id },
            data: { amount: newAmount },
        });

        await Promise.all([this.cacheService.invalidateSavings(membership.householdId), this.cacheService.invalidateDashboard(membership.householdId)]);
        this.logger.log(`Personal saving withdrawn for user ${userId}: ${month}/${year} -${dto.amount}`);
        return this.mapToResponse(result);
    }

    /**
     * Returns all household savings for the current month.
     * Results are cached to reduce database load.
     *
     * Scenario: Alex views the household page and sees everyone's personal
     * and shared savings for the current month.
     *
     * @param userId - The authenticated user's ID
     * @returns All savings in the household for current month
     * @throws {NotFoundException} If user is not a member of any household
     */
    async getHouseholdSavings(userId: string, reqMonth?: number, reqYear?: number): Promise<SavingResponseDto[]> {
        this.logger.debug(`Get household savings for user: ${userId}`);

        const membership = await this.expenseHelper.requireMembership(userId);

        const now = new Date();
        const month = reqMonth ?? now.getMonth() + 1;
        const year = reqYear ?? now.getFullYear();

        const cacheKey = this.cacheService.savingsKey(membership.householdId, year, month);

        return this.cacheService.getOrSet(cacheKey, this.cacheService.summaryTTL, async () => {
            const savings = await this.prismaService.saving.findMany({
                where: { householdId: membership.householdId, month, year },
                orderBy: [{ userId: 'asc' }, { isShared: 'asc' }],
            });
            return savings.map((s) => this.mapToResponse(s));
        });
    }

    /**
     * Adds an amount to the user's shared savings for a given month.
     * If no shared saving exists for the month, creates one with the given amount.
     * If one exists, increments the current amount.
     *
     * Scenario: Sam has 100 EUR shared savings for June. Sam adds 50 EUR,
     * resulting in 150 EUR total.
     *
     * @param userId - The authenticated user's ID
     * @param dto - Amount to add and optional month/year
     * @returns The updated saving record
     * @throws {NotFoundException} If user is not a member of any household
     */
    async addSharedSaving(userId: string, dto: AddSavingDto): Promise<SavingResponseDto> {
        this.logger.debug(`Add shared saving for user: ${userId}`);

        const membership = await this.expenseHelper.requireMembership(userId);

        const now = new Date();
        const month = dto.month ?? now.getMonth() + 1;
        const year = dto.year ?? now.getFullYear();

        const existing = await this.prismaService.saving.findUnique({
            where: { userId_month_year_isShared: { userId, month, year, isShared: true } },
        });

        let result;
        if (existing) {
            result = await this.prismaService.saving.update({
                where: { id: existing.id },
                data: { amount: Number(existing.amount) + dto.amount },
            });
        } else {
            result = await this.prismaService.saving.create({
                data: {
                    userId,
                    householdId: membership.householdId,
                    amount: dto.amount,
                    month,
                    year,
                    isShared: true,
                },
            });
        }

        await Promise.all([this.cacheService.invalidateSavings(membership.householdId), this.cacheService.invalidateDashboard(membership.householdId)]);
        this.logger.log(`Shared saving added for user ${userId}: ${month}/${year} +${dto.amount}`);
        return this.mapToResponse(result);
    }

    /**
     * Requests a withdrawal from shared savings. Since shared savings belong to the
     * household, this creates an approval request that another member must accept.
     *
     * Scenario: Sam wants to withdraw 50 EUR from shared savings. An approval is
     * created and Alex must accept it before the withdrawal is executed.
     *
     * @param userId - The authenticated user's ID
     * @param dto - Amount to withdraw and optional month/year
     * @returns The approval response (pending approval created)
     * @throws {NotFoundException} If user is not a member of any household
     * @throws {NotFoundException} If no shared saving exists for the specified month
     * @throws {BadRequestException} If withdrawal amount exceeds current shared savings
     */
    async requestSharedWithdrawal(userId: string, dto: WithdrawSavingDto): Promise<{ approvalId: string; message: string }> {
        this.logger.debug(`Request shared withdrawal for user: ${userId}`);

        const membership = await this.expenseHelper.requireMembership(userId);

        const now = new Date();
        const month = dto.month ?? now.getMonth() + 1;
        const year = dto.year ?? now.getFullYear();

        const existing = await this.prismaService.saving.findUnique({
            where: { userId_month_year_isShared: { userId, month, year, isShared: true } },
        });

        if (!existing) {
            throw new NotFoundException('No shared savings found for this month');
        }

        const currentAmount = Number(existing.amount);
        if (dto.amount > currentAmount) {
            throw new BadRequestException(`Withdrawal amount (${dto.amount}) exceeds current shared savings (${currentAmount})`);
        }

        const approval = await this.prismaService.expenseApproval.create({
            data: {
                householdId: membership.householdId,
                action: ApprovalAction.WITHDRAW_SAVINGS,
                status: ApprovalStatus.PENDING,
                requestedById: userId,
                proposedData: {
                    amount: dto.amount,
                    month,
                    year,
                },
            },
        });

        await this.cacheService.invalidateApprovals(membership.householdId);
        this.logger.log(`Shared withdrawal request created for user ${userId}: ${month}/${year} -${dto.amount} (approval: ${approval.id})`);

        return {
            approvalId: approval.id,
            message: 'Withdrawal request submitted for approval',
        };
    }

    /**
     * Executes an approved shared savings withdrawal. Called by the ApprovalService
     * when a WITHDRAW_SAVINGS approval is accepted.
     *
     * @param requestedById - The user who originally requested the withdrawal
     * @param householdId - The household ID
     * @param amount - The withdrawal amount
     * @param month - The month
     * @param year - The year
     * @param tx - The Prisma transaction client
     */
    async executeSharedWithdrawal(
        requestedById: string,
        householdId: string,
        amount: number,
        month: number,
        year: number,
        tx: any,
    ): Promise<void> {
        const existing = await tx.saving.findUnique({
            where: { userId_month_year_isShared: { userId: requestedById, month, year, isShared: true } },
        });

        if (!existing) {
            this.logger.warn(`Shared saving not found for withdrawal execution: user ${requestedById}, ${month}/${year}`);
            throw new NotFoundException('Shared saving no longer exists for this month');
        }

        const currentAmount = Number(existing.amount);
        const newAmount = Math.max(0, currentAmount - amount);

        await tx.saving.update({
            where: { id: existing.id },
            data: { amount: newAmount },
        });

        this.logger.log(`Shared withdrawal executed: user ${requestedById}, ${month}/${year} -${amount} (was ${currentAmount}, now ${newAmount})`);
    }

    private mapToResponse(record: any): SavingResponseDto {
        return {
            id: record.id,
            userId: record.userId,
            householdId: record.householdId,
            amount: Number(record.amount),
            month: record.month,
            year: record.year,
            isShared: record.isShared,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
        };
    }
}
