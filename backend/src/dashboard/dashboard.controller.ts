import { Controller, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { DashboardService } from './dashboard.service';
import { DashboardResponseDto } from './dto/dashboard-response.dto';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { SavingsResponseDto } from './dto/member-savings.dto';
import { SavingsHistoryItemDto } from './dto/savings-history.dto';
import { SettlementResponseDto } from './dto/settlement-response.dto';
import { MarkSettlementPaidResponseDto } from './dto/mark-settlement-paid-response.dto';
import { GetDashboardEndpoint, GetSavingsEndpoint, GetSavingsHistoryEndpoint, GetSettlementEndpoint, MarkSettlementPaidEndpoint } from './decorators/api-dashboard.decorators';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
    constructor(private readonly dashboardService: DashboardService) {}

    @GetDashboardEndpoint()
    async getOverview(@CurrentUser('id') userId: string, @Query('mode') mode?: string, @Query() query?: DashboardQueryDto): Promise<DashboardResponseDto> {
        return this.dashboardService.getOverview(userId, mode === 'yearly' ? 'yearly' : 'monthly', query?.month, query?.year);
    }

    @GetSavingsEndpoint()
    async getSavings(@CurrentUser('id') userId: string, @Query() query?: DashboardQueryDto): Promise<SavingsResponseDto> {
        return this.dashboardService.getSavings(userId, query?.month, query?.year);
    }

    @GetSavingsHistoryEndpoint()
    async getSavingsHistory(@CurrentUser('id') userId: string): Promise<SavingsHistoryItemDto[]> {
        return this.dashboardService.getSavingsHistory(userId);
    }

    @GetSettlementEndpoint()
    async getSettlement(@CurrentUser('id') userId: string, @Query() query?: DashboardQueryDto): Promise<SettlementResponseDto> {
        return this.dashboardService.getSettlement(userId, query?.month, query?.year);
    }

    @MarkSettlementPaidEndpoint()
    async markSettlementPaid(@CurrentUser('id') userId: string): Promise<MarkSettlementPaidResponseDto> {
        return this.dashboardService.markSettlementPaid(userId);
    }
}
