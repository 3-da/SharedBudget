import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExpenseHelperService } from '../common/expense/expense-helper.service';
import { CacheService } from '../common/cache/cache.service';
import { UpsertSavingDto } from './dto/upsert-saving.dto';
import { SavingResponseDto } from './dto/saving-response.dto';

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
     * Creates or updates the personal savings for a given month.
     * The month and year default to the current period if not specified.
     *
     * Use case: User records how much they saved personally this month.
     *
     * Scenario: Sam sets aside 200 EUR of personal savings for June 2026.
     * If Sam already has a personal saving for that month, it is updated;
     * otherwise a new record is created.
     *
     * @param userId - The authenticated user's ID
     * @param dto - Savings amount and optional month/year
     * @returns The created or updated saving record
     * @throws {NotFoundException} If user is not a member of any household
     */
    async upsertPersonalSaving(userId: string, dto: UpsertSavingDto): Promise<SavingResponseDto> {
        this.logger.debug(`Upsert personal saving for user: ${userId}`);

        const membership = await this.expenseHelper.requireMembership(userId);

        const now = new Date();
        const month = dto.month ?? now.getMonth() + 1;
        const year = dto.year ?? now.getFullYear();

        const result = await this.prismaService.saving.upsert({
            where: {
                userId_month_year_isShared: {
                    userId,
                    month,
                    year,
                    isShared: false,
                },
            },
            create: {
                userId,
                householdId: membership.householdId,
                amount: dto.amount,
                month,
                year,
                isShared: false,
            },
            update: {
                amount: dto.amount,
            },
        });

        await Promise.all([this.cacheService.invalidateSavings(membership.householdId), this.cacheService.invalidateDashboard(membership.householdId)]);
        this.logger.log(`Personal saving upserted for user ${userId}: ${month}/${year} = ${dto.amount}`);
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
     * Creates or updates the shared savings for a given month.
     * The month and year default to the current period if not specified.
     *
     * Use case: User records how much they contributed to shared household savings.
     *
     * Scenario: Sam sets aside 100 EUR of shared savings for household goals.
     * If Sam already has a shared saving for that month, it is updated;
     * otherwise a new record is created.
     *
     * @param userId - The authenticated user's ID
     * @param dto - Savings amount and optional month/year
     * @returns The created or updated saving record
     * @throws {NotFoundException} If user is not a member of any household
     */
    async upsertSharedSaving(userId: string, dto: UpsertSavingDto): Promise<SavingResponseDto> {
        this.logger.debug(`Upsert shared saving for user: ${userId}`);

        const membership = await this.expenseHelper.requireMembership(userId);

        const now = new Date();
        const month = dto.month ?? now.getMonth() + 1;
        const year = dto.year ?? now.getFullYear();

        const result = await this.prismaService.saving.upsert({
            where: {
                userId_month_year_isShared: {
                    userId,
                    month,
                    year,
                    isShared: true,
                },
            },
            create: {
                userId,
                householdId: membership.householdId,
                amount: dto.amount,
                month,
                year,
                isShared: true,
            },
            update: {
                amount: dto.amount,
            },
        });

        await Promise.all([this.cacheService.invalidateSavings(membership.householdId), this.cacheService.invalidateDashboard(membership.householdId)]);
        this.logger.log(`Shared saving upserted for user ${userId}: ${month}/${year} = ${dto.amount}`);
        return this.mapToResponse(result);
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
