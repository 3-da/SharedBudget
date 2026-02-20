import { Body, Controller, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SavingService } from './saving.service';
import { AddSavingDto } from './dto/add-saving.dto';
import { WithdrawSavingDto } from './dto/withdraw-saving.dto';
import { SavingResponseDto } from './dto/saving-response.dto';
import { DashboardQueryDto } from '../dashboard/dto/dashboard-query.dto';
import {
    GetMySavingsEndpoint,
    AddPersonalSavingEndpoint,
    WithdrawPersonalSavingEndpoint,
    GetHouseholdSavingsEndpoint,
    AddSharedSavingEndpoint,
    RequestSharedWithdrawalEndpoint,
} from './decorators/api-saving.decorators';

@ApiTags('Savings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('savings')
export class SavingController {
    constructor(private readonly savingService: SavingService) {}

    @GetMySavingsEndpoint()
    async getMySavings(@CurrentUser('id') userId: string, @Query() query?: DashboardQueryDto): Promise<SavingResponseDto[]> {
        return this.savingService.getMySavings(userId, query?.month, query?.year);
    }

    @AddPersonalSavingEndpoint()
    async addPersonalSaving(@CurrentUser('id') userId: string, @Body() dto: AddSavingDto): Promise<SavingResponseDto> {
        return this.savingService.addPersonalSaving(userId, dto);
    }

    @WithdrawPersonalSavingEndpoint()
    async withdrawPersonalSaving(@CurrentUser('id') userId: string, @Body() dto: WithdrawSavingDto): Promise<SavingResponseDto> {
        return this.savingService.withdrawPersonalSaving(userId, dto);
    }

    @GetHouseholdSavingsEndpoint()
    async getHouseholdSavings(@CurrentUser('id') userId: string, @Query() query?: DashboardQueryDto): Promise<SavingResponseDto[]> {
        return this.savingService.getHouseholdSavings(userId, query?.month, query?.year);
    }

    @AddSharedSavingEndpoint()
    async addSharedSaving(@CurrentUser('id') userId: string, @Body() dto: AddSavingDto): Promise<SavingResponseDto> {
        return this.savingService.addSharedSaving(userId, dto);
    }

    @RequestSharedWithdrawalEndpoint()
    async requestSharedWithdrawal(@CurrentUser('id') userId: string, @Body() dto: WithdrawSavingDto) {
        return this.savingService.requestSharedWithdrawal(userId, dto);
    }
}
