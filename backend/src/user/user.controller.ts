import { Body, Controller, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserService } from './user.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { RequestAccountDeletionDto } from './dto/request-account-deletion.dto';
import { RespondDeleteAccountRequestDto } from './dto/respond-delete-account-request.dto';
import { UserProfileResponseDto } from './dto/user-profile-response.dto';
import { PendingDeleteRequestResponseDto } from './dto/pending-delete-request-response.dto';
import {
    ChangePasswordEndpoint,
    GetProfileEndpoint,
    UpdateProfileEndpoint,
    DeleteAccountEndpoint,
    RequestAccountDeletionEndpoint,
    GetPendingDeleteRequestsEndpoint,
    RespondToDeleteRequestEndpoint,
    CancelDeleteRequestEndpoint,
} from './decorators/api-user.decorators';
import { MessageResponseDto } from '../common/dto/message-response.dto';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UserController {
    constructor(private readonly userService: UserService) {}

    @GetProfileEndpoint()
    async getProfile(@CurrentUser('id') userId: string): Promise<UserProfileResponseDto> {
        return this.userService.getProfile(userId);
    }

    @UpdateProfileEndpoint()
    async updateProfile(@CurrentUser('id') userId: string, @Body() dto: UpdateProfileDto): Promise<UserProfileResponseDto> {
        return this.userService.updateProfile(userId, dto);
    }

    @ChangePasswordEndpoint()
    async changePassword(@CurrentUser('id') userId: string, @Body() dto: ChangePasswordDto): Promise<MessageResponseDto> {
        return this.userService.changePassword(userId, dto);
    }

    @DeleteAccountEndpoint()
    async deleteAccount(@CurrentUser('id') userId: string): Promise<MessageResponseDto> {
        return this.userService.deleteAccount(userId);
    }

    @RequestAccountDeletionEndpoint()
    async requestAccountDeletion(@CurrentUser('id') userId: string, @Body() dto: RequestAccountDeletionDto): Promise<{ requestId: string }> {
        return this.userService.requestAccountDeletion(userId, dto);
    }

    @GetPendingDeleteRequestsEndpoint()
    async getPendingDeleteAccountRequests(@CurrentUser('id') userId: string): Promise<PendingDeleteRequestResponseDto[]> {
        return this.userService.getPendingDeleteAccountRequests(userId);
    }

    @RespondToDeleteRequestEndpoint()
    async respondToDeleteAccountRequest(
        @CurrentUser('id') userId: string,
        @Param('requestId') requestId: string,
        @Body() dto: RespondDeleteAccountRequestDto,
    ): Promise<MessageResponseDto> {
        return this.userService.respondToDeleteAccountRequest(userId, requestId, dto);
    }

    @CancelDeleteRequestEndpoint()
    async cancelDeleteAccountRequest(@CurrentUser('id') userId: string): Promise<MessageResponseDto> {
        return this.userService.cancelDeleteAccountRequest(userId);
    }
}
