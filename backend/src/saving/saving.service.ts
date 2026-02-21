import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExpenseHelperService } from '../common/expense/expense-helper.service';
import { CacheService } from '../common/cache/cache.service';
import { AddSavingDto } from './dto/add-saving.dto';
import { WithdrawSavingDto } from './dto/withdraw-saving.dto';
import { SavingResponseDto } from './dto/saving-response.dto';
import { Saving } from '../generated/prisma/client';
import { ApprovalAction, ApprovalStatus } from '../generated/prisma/enums';
import { resolveMonthYear } from '../common/utils/resolve-month-year';

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
     * @param reqMonth - Optional month override (1-12)
     * @param reqYear - Optional year override
     * @returns List of savings (personal and shared) for current month
     * @throws {NotFoundException} If user is not a member of any household
     */
    async getMySavings(userId: string, reqMonth?: number, reqYear?: number): Promise<SavingResponseDto[]> {
        this.logger.debug(`Get savings for user: ${userId}`);

        await this.expenseHelper.requireMembership(userId);

        const { month, year } = resolveMonthYear(reqMonth, reqYear);

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
        return this.upsertSaving(userId, dto, false);
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
        return this.upsertSaving(userId, dto, true);
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
        const { month, year } = resolveMonthYear(dto.month, dto.year);

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

        await this.invalidateSavingsAndDashboard(membership.householdId);
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
     * @param reqMonth - Optional month override (1-12)
     * @param reqYear - Optional year override
     * @returns All savings in the household for current month
     * @throws {NotFoundException} If user is not a member of any household
     */
    async getHouseholdSavings(userId: string, reqMonth?: number, reqYear?: number): Promise<SavingResponseDto[]> {
        this.logger.debug(`Get household savings for user: ${userId}`);

        const membership = await this.expenseHelper.requireMembership(userId);
        const { month, year } = resolveMonthYear(reqMonth, reqYear);

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
        const { month, year } = resolveMonthYear(dto.month, dto.year);

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

    /**
     * Upserts a saving record (personal or shared). If a record exists for the given
     * user/month/year/isShared combination, increments the amount; otherwise creates a new one.
     *
     * @param userId - The authenticated user's ID
     * @param dto - Amount to add and optional month/year
     * @param isShared - Whether this is a shared or personal saving
     * @returns The created or updated saving record
     * @throws {NotFoundException} If user is not a member of any household
     */
    private async upsertSaving(userId: string, dto: AddSavingDto, isShared: boolean): Promise<SavingResponseDto> {
        const label = isShared ? 'Shared' : 'Personal';
        this.logger.debug(`Add ${label.toLowerCase()} saving for user: ${userId}`);

        const membership = await this.expenseHelper.requireMembership(userId);
        const { month, year } = resolveMonthYear(dto.month, dto.year);

        const existing = await this.prismaService.saving.findUnique({
            where: { userId_month_year_isShared: { userId, month, year, isShared } },
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
                    isShared,
                },
            });
        }

        await this.invalidateSavingsAndDashboard(membership.householdId);
        this.logger.log(`${label} saving added for user ${userId}: ${month}/${year} +${dto.amount}`);
        return this.mapToResponse(result);
    }

    /**
     * Invalidates both savings and dashboard caches for a household.
     */
    private async invalidateSavingsAndDashboard(householdId: string): Promise<void> {
        await Promise.all([this.cacheService.invalidateSavings(householdId), this.cacheService.invalidateDashboard(householdId)]);
    }

    private mapToResponse(record: Saving): SavingResponseDto {
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
