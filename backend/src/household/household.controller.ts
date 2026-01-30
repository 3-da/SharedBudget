import { Body, Controller, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { HouseholdService } from './household.service';
import { CreateHouseholdEndpoint, GetMyHouseholdEndpoint, JoinHouseholdEndpoint, RegenerateCodeEndpoint } from './decorators/api-household.decorators';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { HouseholdResponseDto } from './dto/household-response.dto';
import { JoinHouseholdDto } from './dto/join-household.dto';
import { CreateHouseholdDto } from '../generated/dto';

@ApiTags('Household')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('household')
export class HouseholdController {
    constructor(private readonly householdService: HouseholdService) {}

    @CreateHouseholdEndpoint()
    async create(@CurrentUser('id') userId: string, @Body() dto: CreateHouseholdDto): Promise<HouseholdResponseDto> {
        return this.householdService.createHousehold(userId, dto.name);
    }

    @JoinHouseholdEndpoint()
    async join(@CurrentUser('id') userId: string, @Body() dto: JoinHouseholdDto): Promise<HouseholdResponseDto> {
        return this.householdService.joinHousehold(userId, dto.inviteCode);
    }

    @GetMyHouseholdEndpoint()
    async getMine(@CurrentUser('id') userId: string): Promise<HouseholdResponseDto> {
        return this.householdService.getMyHousehold(userId);
    }

    @RegenerateCodeEndpoint()
    async regenerateCode(@CurrentUser('id') userId: string): Promise<HouseholdResponseDto> {
        return this.householdService.regenerateInviteCode(userId);
    }
}
