import { Body, Controller, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SalaryService } from './salary.service';
import { UpsertSalaryDto } from './dto/upsert-salary.dto';
import { SalaryResponseDto } from './dto/salary-response.dto';
import {
    GetHouseholdSalariesByMonthEndpoint,
    GetHouseholdSalariesEndpoint,
    GetMySalaryEndpoint,
    GetMyYearlySalaryEndpoint,
    UpsertMySalaryEndpoint,
} from './decorators/api-salary.decorators';

@ApiTags('Salary')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('salary')
export class SalaryController {
    constructor(private readonly salaryService: SalaryService) {}

    @GetMySalaryEndpoint()
    async getMySalary(@CurrentUser('id') userId: string): Promise<SalaryResponseDto | null> {
        return this.salaryService.getMySalary(userId);
    }

    @UpsertMySalaryEndpoint()
    async upsertMySalary(@CurrentUser('id') userId: string, @Body() dto: UpsertSalaryDto): Promise<SalaryResponseDto> {
        return this.salaryService.upsertMySalary(userId, dto);
    }

    @GetMyYearlySalaryEndpoint()
    async getMyYearlySalary(
        @CurrentUser('id') userId: string,
        @Param('year', ParseIntPipe) year: number,
    ): Promise<SalaryResponseDto[]> {
        return this.salaryService.getMyYearlySalary(userId, year);
    }

    @GetHouseholdSalariesEndpoint()
    async getHouseholdSalaries(@CurrentUser('id') userId: string): Promise<SalaryResponseDto[]> {
        return this.salaryService.getHouseholdSalaries(userId);
    }

    @GetHouseholdSalariesByMonthEndpoint()
    async getHouseholdSalariesByMonth(
        @CurrentUser('id') userId: string,
        @Param('year', ParseIntPipe) year: number,
        @Param('month', ParseIntPipe) month: number,
    ): Promise<SalaryResponseDto[]> {
        return this.salaryService.getHouseholdSalariesByMonth(userId, year, month);
    }
}
