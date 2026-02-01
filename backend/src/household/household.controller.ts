import { Body, Controller, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { HouseholdService } from './household.service';
import {
    CancelInvitationEndpoint,
    CreateHouseholdEndpoint,
    GetMyHouseholdEndpoint,
    GetPendingInvitationsEndpoint,
    InviteToHouseholdEndpoint,
    JoinByCodeEndpoint,
    LeaveHouseholdEndpoint,
    RegenerateCodeEndpoint,
    RemoveMemberEndpoint,
    RespondToInvitationEndpoint,
    TransferOwnershipEndpoint,
} from './decorators/api-household.decorators';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { HouseholdResponseDto } from './dto/household-response.dto';
import { CreateHouseholdDto } from '../generated/dto';
import { InviteToHouseholdDto } from './dto/invite-to-household.dto';
import { HouseholdInvitationResponseDto } from './dto/household-invitation-response.dto';
import { HouseholdInvitationService } from './household-invitation.service';
import { JoinByCodeDto } from './dto/join-by-code.dto';
import { RespondInvitationDto } from './dto/respond-invitation.dto';
import { MessageResponseDto } from './dto/message-response.dto';
import { TransferOwnershipDto } from './dto/transfer-ownership.dto';

@ApiTags('Household')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('household')
export class HouseholdController {
    constructor(
        private readonly householdService: HouseholdService,
        private readonly householdInvitationService: HouseholdInvitationService,
    ) {}

    //#region Household CRUD
    @CreateHouseholdEndpoint()
    async create(@CurrentUser('id') userId: string, @Body() dto: CreateHouseholdDto): Promise<HouseholdResponseDto> {
        return this.householdService.createHousehold(userId, dto.name);
    }

    @GetMyHouseholdEndpoint()
    async getMine(@CurrentUser('id') userId: string): Promise<HouseholdResponseDto> {
        return this.householdService.getMyHousehold(userId);
    }

    @RegenerateCodeEndpoint()
    async regenerateCode(@CurrentUser('id') userId: string): Promise<HouseholdResponseDto> {
        return this.householdService.regenerateInviteCode(userId);
    }
    //#endregion

    //#region Invitations & Join Requests
    @InviteToHouseholdEndpoint()
    async invite(@CurrentUser('id') userId: string, @Body() dto: InviteToHouseholdDto): Promise<HouseholdInvitationResponseDto> {
        return this.householdInvitationService.inviteToHousehold(userId, dto.email);
    }

    @RespondToInvitationEndpoint()
    async respondToInvitation(
        @CurrentUser('id') userId: string,
        @Param('id') invitationId: string,
        @Body() dto: RespondInvitationDto,
    ): Promise<HouseholdInvitationResponseDto> {
        return this.householdInvitationService.respondToInvitation(userId, invitationId, dto.accept);
    }

    @GetPendingInvitationsEndpoint()
    async getPendingInvitations(@CurrentUser('id') userId: string): Promise<HouseholdInvitationResponseDto[]> {
        return this.householdInvitationService.getPendingInvitations(userId);
    }

    @CancelInvitationEndpoint()
    async cancelInvitation(@CurrentUser('id') userId: string, @Param('id') invitationId: string): Promise<MessageResponseDto> {
        return this.householdInvitationService.cancelInvitation(userId, invitationId);
    }

    @JoinByCodeEndpoint()
    async joinByCode(@CurrentUser('id') userId: string, @Body() dto: JoinByCodeDto): Promise<HouseholdResponseDto> {
        return this.householdService.joinByCode(userId, dto.inviteCode);
    }
    //#endregion

    //#region Membership management
    @LeaveHouseholdEndpoint()
    async leave(@CurrentUser('id') userId: string): Promise<MessageResponseDto> {
        return this.householdService.leaveHousehold(userId);
    }

    @RemoveMemberEndpoint()
    async removeMember(@CurrentUser('id') userId: string, @Param('userId') targetUserId: string): Promise<MessageResponseDto> {
        return this.householdService.removeMember(userId, targetUserId);
    }

    @TransferOwnershipEndpoint()
    async transferOwnership(@CurrentUser('id') userId: string, @Body() dto: TransferOwnershipDto): Promise<HouseholdResponseDto> {
        return this.householdService.transferOwnership(userId, dto.targetUserId);
    }
    //#endregion
}
