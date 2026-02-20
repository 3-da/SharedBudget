import { Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { SessionService } from '../session/session.service';
import { UserProfileResponseDto } from './dto/user-profile-response.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { MessageResponseDto } from '../common/dto/message-response.dto';
import * as argon2 from 'argon2';

@Injectable()
export class UserService {
    private readonly logger = new Logger(UserService.name);
    private readonly argon2Options: argon2.Options;

    constructor(
        private readonly prismaService: PrismaService,
        private readonly sessionService: SessionService,
        private readonly configService: ConfigService,
    ) {
        this.argon2Options = {
            memoryCost: this.configService.get<number>('ARGON2_MEMORY_COST', 65536),
            timeCost: this.configService.get<number>('ARGON2_TIME_COST', 3),
            parallelism: this.configService.get<number>('ARGON2_PARALLELISM', 4),
        };
    }

    async getProfile(userId: string): Promise<UserProfileResponseDto> {
        this.logger.debug(`Get profile for user: ${userId}`);

        const user = await this.prismaService.user.findUnique({ where: { id: userId } });

        if (!user) {
            this.logger.warn(`User not found: ${userId}`);
            throw new NotFoundException('User not found');
        }

        return this.mapToProfileDto(user);
    }

    async updateProfile(userId: string, dto: UpdateProfileDto): Promise<UserProfileResponseDto> {
        this.logger.log(`Update profile for user: ${userId}`);

        const user = await this.prismaService.user.findUnique({ where: { id: userId } });

        if (!user) {
            this.logger.warn(`User not found for profile update: ${userId}`);
            throw new NotFoundException('User not found');
        }

        const updatedUser = await this.prismaService.user.update({
            where: { id: userId },
            data: {
                firstName: dto.firstName,
                lastName: dto.lastName,
            },
        });

        this.logger.log(`Profile updated for user: ${userId}`);
        return this.mapToProfileDto(updatedUser);
    }

    /**
     * Changes the authenticated user's password after verifying the current one.
     * Invalidates all existing sessions to ensure security after password change.
     *
     * Use case: User wants to change their password from account settings.
     *
     * Scenario: Alex realizes their password might be compromised and changes it.
     * After the change, all of Alex's active sessions (on other devices) are
     * invalidated, requiring fresh login everywhere.
     *
     * @param userId - The ID of the authenticated user
     * @param dto - Contains currentPassword and newPassword
     * @returns Success message
     * @throws {NotFoundException} If the user is not found
     * @throws {UnauthorizedException} If the current password is incorrect
     */
    async changePassword(userId: string, dto: ChangePasswordDto): Promise<MessageResponseDto> {
        this.logger.log(`Password change attempt for user: ${userId}`);

        const user = await this.prismaService.user.findUnique({ where: { id: userId } });
        if (!user) {
            this.logger.warn(`User not found for password change: ${userId}`);
            throw new NotFoundException('User not found');
        }

        const isCurrentPasswordValid = await argon2.verify(user.password, dto.currentPassword);
        if (!isCurrentPasswordValid) {
            this.logger.warn(`Incorrect current password for user: ${userId}`);
            throw new UnauthorizedException('Current password is incorrect.');
        }

        const hashedNewPassword = await argon2.hash(dto.newPassword, this.argon2Options);

        await this.prismaService.user.update({
            where: { id: userId },
            data: { password: hashedNewPassword },
        });

        const invalidatedCount = await this.sessionService.invalidateAllSessions(userId);

        this.logger.log(`Password changed for user: ${userId}, invalidated ${invalidatedCount} sessions`);
        return { message: 'Password changed successfully. Please log in again.' };
    }

    private mapToProfileDto(user: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        createdAt: Date;
        updatedAt: Date;
    }): UserProfileResponseDto {
        return {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        };
    }
}
