import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertSalaryDto } from './dto/upsert-salary.dto';
import { SalaryResponseDto } from './dto/salary-response.dto';
import { CacheService } from '../common/cache/cache.service';

@Injectable()
export class SalaryService {
    private readonly logger = new Logger(SalaryService.name);

    constructor(
        private readonly prismaService: PrismaService,
        private readonly cacheService: CacheService,
    ) {}

    async getMySalary(userId: string): Promise<SalaryResponseDto> {
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();

        this.logger.debug(`Get salary for user: ${userId}, month: ${month}, year: ${year}`);

        const salary = await this.prismaService.salary.findUnique({
            where: { userId_month_year: { userId, month, year } },
            include: { user: { select: { firstName: true, lastName: true } } },
        });

        if (!salary) {
            this.logger.warn(`No salary found for user: ${userId}, month: ${month}, year: ${year}`);
            throw new NotFoundException('No salary record found for current month');
        }

        return this.mapToResponseDto(salary);
    }

    /**
     * Returns the householdId for a user, used for cache invalidation.
     */
    private async getHouseholdId(userId: string): Promise<string | null> {
        const membership = await this.prismaService.householdMember.findUnique({ where: { userId } });
        return membership?.householdId ?? null;
    }

    /**
     * Creates or updates the authenticated user's salary for the current month.
     * The month and year are auto-determined from the server clock. Only the
     * user themselves can set their own salary; household membership is required.
     *
     * Use case: User sets or adjusts their monthly salary expectation.
     * The system auto-fills month/year so users never pick the wrong period.
     *
     * Scenario: Alex sets a default salary of €3,500 and current month salary
     * of €3,200 (due to unpaid leave). If Alex already has a record for this
     * month, it's updated; otherwise a new record is created.
     *
     * @param userId - The ID of the authenticated user
     * @param dto - Contains defaultAmount and currentAmount (non-negative)
     * @returns The created or updated salary record
     * @throws {NotFoundException} If the user is not a member of any household
     */
    async upsertMySalary(userId: string, dto: UpsertSalaryDto): Promise<SalaryResponseDto> {
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();

        this.logger.log(`Upsert salary for user: ${userId}, month: ${month}, year: ${year}`);

        const membership = await this.prismaService.householdMember.findUnique({ where: { userId } });

        if (!membership) {
            this.logger.warn(`User not in a household: ${userId}`);
            throw new NotFoundException('You must be in a household to set a salary');
        }

        const salary = await this.prismaService.salary.upsert({
            where: { userId_month_year: { userId, month, year } },
            create: {
                userId,
                householdId: membership.householdId,
                defaultAmount: dto.defaultAmount,
                currentAmount: dto.currentAmount,
                month,
                year,
            },
            update: {
                defaultAmount: dto.defaultAmount,
                currentAmount: dto.currentAmount,
            },
            include: { user: { select: { firstName: true, lastName: true } } },
        });

        this.logger.log(`Salary upserted: ${salary.id} for user: ${userId}`);

        // Invalidate salary and dashboard caches
        await Promise.all([
            this.cacheService.invalidateSalaries(membership.householdId),
            this.cacheService.invalidateDashboard(membership.householdId),
            this.cacheService.invalidateSavings(membership.householdId),
        ]);

        return this.mapToResponseDto(salary);
    }

    async getHouseholdSalaries(userId: string): Promise<SalaryResponseDto[]> {
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();

        return this.fetchHouseholdSalaries(userId, year, month);
    }

    async getHouseholdSalariesByMonth(userId: string, year: number, month: number): Promise<SalaryResponseDto[]> {
        return this.fetchHouseholdSalaries(userId, year, month);
    }

    /**
     * Shared logic for fetching all household salaries filtered by period.
     * Validates household membership before querying. Results are cached.
     *
     * @param userId - The requesting user's ID (used to find their household)
     * @param year - The year to filter by
     * @param month - The month to filter by (1-12)
     * @returns Mapped salary response DTOs for matching records
     * @throws {NotFoundException} If the user is not a member of any household
     */
    private async fetchHouseholdSalaries(userId: string, year: number, month: number): Promise<SalaryResponseDto[]> {
        this.logger.debug(`Fetch household salaries for user: ${userId}, month: ${month}, year: ${year}`);

        const membership = await this.prismaService.householdMember.findUnique({ where: { userId } });

        if (!membership) {
            this.logger.warn(`User not in a household for user: ${userId}, month: ${month}, year: ${year}`);
            throw new NotFoundException('You are not a member of any household');
        }

        const cacheKey = this.cacheService.salaryKey(membership.householdId, year, month);

        return this.cacheService.getOrSet(cacheKey, this.cacheService.salariesTTL, async () => {
            const salaries = await this.prismaService.salary.findMany({
                where: { householdId: membership.householdId, month, year },
                include: { user: { select: { firstName: true, lastName: true } } },
            });

            return salaries.map((salary) => this.mapToResponseDto(salary));
        });
    }

    private mapToResponseDto(salary: any): SalaryResponseDto {
        return {
            id: salary.id,
            userId: salary.userId,
            firstName: salary.user.firstName,
            lastName: salary.user.lastName,
            defaultAmount: Number(salary.defaultAmount),
            currentAmount: Number(salary.currentAmount),
            month: salary.month,
            year: salary.year,
            createdAt: salary.createdAt,
            updatedAt: salary.updatedAt,
        };
    }
}
