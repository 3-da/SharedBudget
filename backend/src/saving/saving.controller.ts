import { Body, Controller, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SavingService } from './saving.service';
import { UpsertSavingDto } from './dto/upsert-saving.dto';
import { SavingResponseDto } from './dto/saving-response.dto';
import {
    GetMySavingsEndpoint,
    UpsertPersonalSavingEndpoint,
    GetHouseholdSavingsEndpoint,
    UpsertSharedSavingEndpoint,
} from './decorators/api-saving.decorators';

@ApiTags('Savings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('savings')
export class SavingController {
    constructor(private readonly savingService: SavingService) {}

    @GetMySavingsEndpoint()
    async getMySavings(@CurrentUser('id') userId: string): Promise<SavingResponseDto[]> {
        return this.savingService.getMySavings(userId);
    }

    @UpsertPersonalSavingEndpoint()
    async upsertPersonalSaving(
        @CurrentUser('id') userId: string,
        @Body() dto: UpsertSavingDto,
    ): Promise<SavingResponseDto> {
        return this.savingService.upsertPersonalSaving(userId, dto);
    }

    @GetHouseholdSavingsEndpoint()
    async getHouseholdSavings(@CurrentUser('id') userId: string): Promise<SavingResponseDto[]> {
        return this.savingService.getHouseholdSavings(userId);
    }

    @UpsertSharedSavingEndpoint()
    async upsertSharedSaving(
        @CurrentUser('id') userId: string,
        @Body() dto: UpsertSavingDto,
    ): Promise<SavingResponseDto> {
        return this.savingService.upsertSharedSaving(userId, dto);
    }
}
