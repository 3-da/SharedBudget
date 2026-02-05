import { Controller, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { DashboardService } from './dashboard.service';
import { DashboardResponseDto } from './dto/dashboard-response.dto';
import { SavingsResponseDto } from './dto/member-savings.dto';
import { SettlementResponseDto } from './dto/settlement-response.dto';
import { MarkSettlementPaidResponseDto } from './dto/mark-settlement-paid-response.dto';
import { GetDashboardEndpoint, GetSavingsEndpoint, GetSettlementEndpoint, MarkSettlementPaidEndpoint } from './decorators/api-dashboard.decorators';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
    constructor(private readonly dashboardService: DashboardService) {}

    @GetDashboardEndpoint()
    async getOverview(@CurrentUser('id') userId: string): Promise<DashboardResponseDto> {
        return this.dashboardService.getOverview(userId);
    }

    @GetSavingsEndpoint()
    async getSavings(@CurrentUser('id') userId: string): Promise<SavingsResponseDto> {
        return this.dashboardService.getSavings(userId);
    }

    @GetSettlementEndpoint()
    async getSettlement(@CurrentUser('id') userId: string): Promise<SettlementResponseDto> {
        return this.dashboardService.getSettlement(userId);
    }

    @MarkSettlementPaidEndpoint()
    async markSettlementPaid(@CurrentUser('id') userId: string): Promise<MarkSettlementPaidResponseDto> {
        return this.dashboardService.markSettlementPaid(userId);
    }
}
