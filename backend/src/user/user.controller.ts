import { Body, Controller, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserService } from './user.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UserProfileResponseDto } from './dto/user-profile-response.dto';
import { ChangePasswordEndpoint, GetProfileEndpoint, UpdateProfileEndpoint } from './decorators/api-user.decorators';
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
}
