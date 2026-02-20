import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { SessionService } from '../session/session.service';
import { UserProfileResponseDto } from './dto/user-profile-response.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { RequestAccountDeletionDto } from './dto/request-account-deletion.dto';
import { RespondDeleteAccountRequestDto } from './dto/respond-delete-account-request.dto';
import { PendingDeleteRequestResponseDto } from './dto/pending-delete-request-response.dto';
import { MessageResponseDto } from '../common/dto/message-response.dto';
import { REDIS_CLIENT } from '../redis/redis.module';
import { HouseholdRole, ExpenseType } from '../generated/prisma/enums';
import Redis from 'ioredis';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';

const DELETE_REQUEST_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

@Injectable()
export class UserService {
    private readonly logger = new Logger(UserService.name);
    private readonly argon2Options: argon2.Options;

    constructor(
        private readonly prismaService: PrismaService,
        private readonly sessionService: SessionService,
        private readonly configService: ConfigService,
        @Inject(REDIS_CLIENT) private readonly redis: Redis,
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

    /**
     * Deletes the authenticated user's account.
     * Handles: no household (immediate), sole owner (deletes household), member (cleans personal data),
     * owner with multiple members (blocked — must use requestAccountDeletion first).
     *
     * Scenario: Sam (MEMBER) wants to leave the platform. Sam's personal expenses, savings, and
     * salary records are removed from the household. Sam's account is anonymized and sessions cleared.
     *
     * @param userId - The ID of the authenticated user
     * @returns Success message
     * @throws {ForbiddenException} If user is owner with multiple members — must use delete-account-request flow
     */
    async deleteAccount(userId: string): Promise<MessageResponseDto> {
        this.logger.log(`Account deletion initiated for user: ${userId}`);

        const membership = await this.prismaService.householdMember.findUnique({
            where: { userId },
            include: { household: { include: { members: true } } },
        });

        if (!membership) {
            await this.sessionService.invalidateAllSessions(userId);
            await this.anonymizeUser(userId);
            this.logger.log(`Account deleted (no household) for user: ${userId}`);
            return { message: 'Your account has been successfully deleted.' };
        }

        const isOwner = membership.role === HouseholdRole.OWNER;
        const memberCount = membership.household.members.length;

        if (isOwner && memberCount > 1) {
            throw new ForbiddenException(
                'As a household owner with other members, you must send a deletion request first. Use POST /users/me/delete-account-request.',
            );
        }

        if (isOwner && memberCount === 1) {
            await this.sessionService.invalidateAllSessions(userId);
            await this.prismaService.household.delete({ where: { id: membership.householdId } });
            await this.anonymizeUser(userId);
            this.logger.log(`Account deleted with household for sole owner: ${userId}`);
            return { message: 'Your account and household have been successfully deleted.' };
        }

        // Regular member — delete personal data and remove from household
        await this.sessionService.invalidateAllSessions(userId);
        await this.prismaService.$transaction([
            this.prismaService.expense.deleteMany({
                where: { householdId: membership.householdId, createdById: userId, type: ExpenseType.PERSONAL },
            }),
            this.prismaService.saving.deleteMany({ where: { householdId: membership.householdId, userId } }),
            this.prismaService.salary.deleteMany({ where: { householdId: membership.householdId, userId } }),
            this.prismaService.householdMember.delete({ where: { userId } }),
        ]);
        await this.anonymizeUser(userId);
        this.logger.log(`Account deleted (member) for user: ${userId}`);
        return { message: 'Your account has been successfully deleted.' };
    }

    /**
     * Creates a delete-account request targeting another household member.
     * Only the household owner can call this when there are other members.
     * The target member must respond via respondToDeleteAccountRequest.
     *
     * Scenario: Alex (OWNER) wants to delete their account. Alex selects Sam (MEMBER) as the
     * recipient. Sam sees the request and can accept (Sam becomes OWNER, Alex's data removed)
     * or reject (the entire household is deleted, Alex's account is closed).
     *
     * @param ownerId - The ID of the authenticated owner
     * @param dto - Contains targetMemberId
     * @returns The requestId
     * @throws {ForbiddenException} If caller is not the owner
     * @throws {BadRequestException} If there are no other members
     * @throws {ForbiddenException} If target is self
     * @throws {NotFoundException} If target is not in the same household
     * @throws {ConflictException} If a pending request already exists
     */
    async requestAccountDeletion(ownerId: string, dto: RequestAccountDeletionDto): Promise<{ requestId: string }> {
        this.logger.log(`Delete account request by owner: ${ownerId} targeting: ${dto.targetMemberId}`);

        const ownerMembership = await this.prismaService.householdMember.findUnique({
            where: { userId: ownerId },
            include: { household: { include: { members: true } } },
        });

        if (!ownerMembership || ownerMembership.role !== HouseholdRole.OWNER) {
            throw new ForbiddenException('Only the household owner can create a deletion request.');
        }

        if (ownerMembership.household.members.length < 2) {
            throw new BadRequestException('No other members to send the request to. Use DELETE /users/me directly.');
        }

        if (ownerId === dto.targetMemberId) {
            throw new ForbiddenException('Cannot send a deletion request to yourself.');
        }

        const targetMembership = await this.prismaService.householdMember.findUnique({ where: { userId: dto.targetMemberId } });
        if (!targetMembership || targetMembership.householdId !== ownerMembership.householdId) {
            throw new NotFoundException('Target user is not a member of your household.');
        }

        const existingRequestId = await this.redis.get(`delete_request_owner:${ownerId}`);
        if (existingRequestId) {
            throw new ConflictException('A pending deletion request already exists. Cancel it before creating a new one.');
        }

        const requestId = crypto.randomBytes(16).toString('hex');
        const payload = JSON.stringify({
            ownerId,
            targetMemberId: dto.targetMemberId,
            householdId: ownerMembership.householdId,
            requestedAt: new Date().toISOString(),
        });

        await this.redis.pipeline()
            .set(`delete_request:${requestId}`, payload, 'EX', DELETE_REQUEST_TTL)
            .set(`delete_request_owner:${ownerId}`, requestId, 'EX', DELETE_REQUEST_TTL)
            .set(`delete_request_target:${dto.targetMemberId}`, requestId, 'EX', DELETE_REQUEST_TTL)
            .exec();

        this.logger.log(`Delete account request ${requestId} stored for owner: ${ownerId}`);
        return { requestId };
    }

    /**
     * Returns pending delete-account requests where the caller is the target member.
     *
     * Scenario: Sam opens Settings and sees Alex's deletion request awaiting response.
     *
     * @param userId - The ID of the authenticated user
     * @returns List of pending requests (at most one per user at a time)
     */
    async getPendingDeleteAccountRequests(userId: string): Promise<PendingDeleteRequestResponseDto[]> {
        const requestId = await this.redis.get(`delete_request_target:${userId}`);
        if (!requestId) return [];

        const raw = await this.redis.get(`delete_request:${requestId}`);
        if (!raw) {
            await this.redis.del(`delete_request_target:${userId}`);
            return [];
        }

        const data = JSON.parse(raw) as { ownerId: string; householdId: string; requestedAt: string };

        const [owner, household] = await Promise.all([
            this.prismaService.user.findUnique({ where: { id: data.ownerId } }),
            this.prismaService.household.findUnique({ where: { id: data.householdId } }),
        ]);

        if (!owner || !household) {
            await this.redis.del(`delete_request:${requestId}`, `delete_request_target:${userId}`, `delete_request_owner:${data.ownerId}`);
            return [];
        }

        return [{
            requestId,
            ownerId: data.ownerId,
            ownerFirstName: owner.firstName,
            ownerLastName: owner.lastName,
            householdName: household.name,
            requestedAt: data.requestedAt,
        }];
    }

    /**
     * Responds to a delete-account request.
     * Accept: target becomes owner, original owner's data is cleaned up and account anonymized.
     * Reject: entire household is deleted, original owner's account is anonymized.
     *
     * Scenario: Sam accepts Alex's request → Sam becomes OWNER, Alex's personal data is removed,
     * Alex's account is closed. OR Sam rejects → household is deleted for all members, Alex's account is closed.
     *
     * @param userId - The ID of the authenticated user (must be the request target)
     * @param requestId - The delete request ID
     * @param dto - Contains `accept: boolean`
     * @returns Success message
     * @throws {NotFoundException} If the request does not exist or has expired
     * @throws {ForbiddenException} If the caller is not the intended target
     */
    async respondToDeleteAccountRequest(userId: string, requestId: string, dto: RespondDeleteAccountRequestDto): Promise<MessageResponseDto> {
        this.logger.log(`Delete account request ${requestId} responded (accept=${dto.accept}) by: ${userId}`);

        const raw = await this.redis.get(`delete_request:${requestId}`);
        if (!raw) throw new NotFoundException('Delete account request not found or has expired.');

        const data = JSON.parse(raw) as { ownerId: string; targetMemberId: string; householdId: string };

        if (data.targetMemberId !== userId) throw new ForbiddenException('You are not the target of this deletion request.');

        await this.redis.del(`delete_request:${requestId}`, `delete_request_owner:${data.ownerId}`, `delete_request_target:${userId}`);
        await this.sessionService.invalidateAllSessions(data.ownerId);

        if (dto.accept) {
            await this.prismaService.$transaction([
                this.prismaService.householdMember.update({ where: { userId: data.ownerId }, data: { role: HouseholdRole.MEMBER } }),
                this.prismaService.householdMember.update({ where: { userId }, data: { role: HouseholdRole.OWNER } }),
                this.prismaService.expense.deleteMany({
                    where: { householdId: data.householdId, createdById: data.ownerId, type: ExpenseType.PERSONAL },
                }),
                this.prismaService.saving.deleteMany({ where: { householdId: data.householdId, userId: data.ownerId } }),
                this.prismaService.salary.deleteMany({ where: { householdId: data.householdId, userId: data.ownerId } }),
                this.prismaService.householdMember.delete({ where: { userId: data.ownerId } }),
            ]);
            await this.anonymizeUser(data.ownerId);
            this.logger.log(`Request ${requestId} accepted — ownership → ${userId}, owner ${data.ownerId} anonymized`);
            return { message: "You are now the household owner. The previous owner's account has been deleted." };
        } else {
            await this.prismaService.household.delete({ where: { id: data.householdId } });
            await this.anonymizeUser(data.ownerId);
            this.logger.log(`Request ${requestId} rejected — household ${data.householdId} deleted, owner ${data.ownerId} anonymized`);
            return { message: 'The deletion request has been rejected. The household and all its data have been deleted.' };
        }
    }

    /**
     * Cancels an existing pending delete-account request created by the owner.
     *
     * @param ownerId - The ID of the authenticated owner
     * @returns Success message
     * @throws {NotFoundException} If no pending request exists
     */
    async cancelDeleteAccountRequest(ownerId: string): Promise<MessageResponseDto> {
        const requestId = await this.redis.get(`delete_request_owner:${ownerId}`);
        if (!requestId) throw new NotFoundException('No pending deletion request found.');

        const raw = await this.redis.get(`delete_request:${requestId}`);
        if (raw) {
            const data = JSON.parse(raw) as { targetMemberId: string };
            await this.redis.del(`delete_request_target:${data.targetMemberId}`);
        }
        await this.redis.del(`delete_request:${requestId}`, `delete_request_owner:${ownerId}`);

        this.logger.log(`Delete account request ${requestId} cancelled by: ${ownerId}`);
        return { message: 'Your deletion request has been cancelled.' };
    }

    private async anonymizeUser(userId: string): Promise<void> {
        const anonymizedEmail = `deleted_${crypto.randomUUID()}@deleted.invalid`;
        const unusablePasswordHash = await argon2.hash(crypto.randomBytes(32).toString('hex'), this.argon2Options);

        await this.prismaService.user.update({
            where: { id: userId },
            data: {
                email: anonymizedEmail,
                password: unusablePasswordHash,
                firstName: 'Deleted',
                lastName: 'Account',
                deletedAt: new Date(),
            },
        });
        this.logger.log(`User ${userId} anonymized`);
    }
}
