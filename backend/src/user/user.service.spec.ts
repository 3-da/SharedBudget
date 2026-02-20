import { beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { ConfigService } from '@nestjs/config';
import { UserService } from './user.service';
import { PrismaService } from '../prisma/prisma.service';
import { SessionService } from '../session/session.service';
import { REDIS_CLIENT } from '../redis/redis.module';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { RequestAccountDeletionDto } from './dto/request-account-deletion.dto';
import { RespondDeleteAccountRequestDto } from './dto/respond-delete-account-request.dto';
import { HouseholdRole, ExpenseType } from '../generated/prisma/enums';

vi.mock('argon2', () => ({
    hash: vi.fn().mockResolvedValue('hashed-password'),
    verify: vi.fn(),
}));

describe('UserService', () => {
    let userService: UserService;

    const userId = 'user-123';
    const targetUserId = 'user-456';
    const householdId = 'household-789';
    const requestId = 'req-abc';

    const mockUser = {
        id: userId,
        email: 'alex@example.com',
        password: 'hashed-password',
        firstName: 'Alex',
        lastName: 'Owner',
        emailVerified: true,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        deletedAt: null,
    };

    const mockTargetUser = {
        id: targetUserId,
        email: 'sam@example.com',
        password: 'hashed-password',
        firstName: 'Sam',
        lastName: 'Member',
        emailVerified: true,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        deletedAt: null,
    };

    const mockHousehold = { id: householdId, name: 'Test Household' };

    const mockOwnerMembership = {
        userId,
        householdId,
        role: HouseholdRole.OWNER,
        household: {
            id: householdId,
            name: 'Test Household',
            members: [
                { userId, role: HouseholdRole.OWNER },
                { userId: targetUserId, role: HouseholdRole.MEMBER },
            ],
        },
    };

    const mockSoleMembership = {
        userId,
        householdId,
        role: HouseholdRole.OWNER,
        household: {
            id: householdId,
            name: 'Test Household',
            members: [{ userId, role: HouseholdRole.OWNER }],
        },
    };

    const mockMemberMembership = {
        userId,
        householdId,
        role: HouseholdRole.MEMBER,
        household: {
            id: householdId,
            name: 'Test Household',
            members: [
                { userId: targetUserId, role: HouseholdRole.OWNER },
                { userId, role: HouseholdRole.MEMBER },
            ],
        },
    };

    const mockPrismaService = {
        user: { findUnique: vi.fn(), update: vi.fn() },
        householdMember: { findUnique: vi.fn(), delete: vi.fn(), update: vi.fn() },
        household: { findUnique: vi.fn(), delete: vi.fn() },
        expense: { deleteMany: vi.fn() },
        saving: { deleteMany: vi.fn() },
        salary: { deleteMany: vi.fn() },
        $transaction: vi.fn(),
    };

    const mockSessionService = {
        invalidateAllSessions: vi.fn().mockResolvedValue(0),
    };

    const mockRedis = {
        get: vi.fn(),
        set: vi.fn(),
        del: vi.fn(),
        pipeline: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnThis(),
            exec: vi.fn().mockResolvedValue([]),
        }),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                UserService,
                { provide: PrismaService, useValue: mockPrismaService },
                { provide: SessionService, useValue: mockSessionService },
                { provide: ConfigService, useValue: { get: vi.fn().mockReturnValue(undefined) } },
                { provide: REDIS_CLIENT, useValue: mockRedis },
            ],
        }).compile();

        userService = module.get<UserService>(UserService);

        vi.clearAllMocks();
        // Reset pipeline mock after clearAllMocks
        mockRedis.pipeline.mockReturnValue({
            set: vi.fn().mockReturnThis(),
            exec: vi.fn().mockResolvedValue([]),
        });
        (argon2.hash as Mock).mockResolvedValue('hashed-password');
    });

    describe('getProfile', () => {
        it('should return user profile for existing user', async () => {
            mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

            const result = await userService.getProfile(userId);

            expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({ where: { id: userId } });
            expect(result).toEqual({
                id: mockUser.id,
                email: mockUser.email,
                firstName: mockUser.firstName,
                lastName: mockUser.lastName,
                createdAt: mockUser.createdAt,
                updatedAt: mockUser.updatedAt,
            });
        });

        it('should not expose password in profile response', async () => {
            mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

            const result = await userService.getProfile(userId);
            expect(result).not.toHaveProperty('password');
        });

        it('should throw NotFoundException if user does not exist', async () => {
            mockPrismaService.user.findUnique.mockResolvedValue(null);

            await expect(userService.getProfile(userId)).rejects.toThrow(NotFoundException);
            await expect(userService.getProfile(userId)).rejects.toThrow('User not found');
        });
    });

    describe('updateProfile', () => {
        const updateDto: UpdateProfileDto = { firstName: 'Alexander', lastName: 'Updated' };

        it('should update and return the updated profile', async () => {
            const updatedUser = { ...mockUser, ...updateDto, updatedAt: new Date('2025-06-01') };
            mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
            mockPrismaService.user.update.mockResolvedValue(updatedUser);

            const result = await userService.updateProfile(userId, updateDto);

            expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({ where: { id: userId } });
            expect(mockPrismaService.user.update).toHaveBeenCalledWith({
                where: { id: userId },
                data: { firstName: updateDto.firstName, lastName: updateDto.lastName },
            });
            expect(result.firstName).toBe('Alexander');
            expect(result.lastName).toBe('Updated');
        });

        it('should throw NotFoundException if user does not exist', async () => {
            mockPrismaService.user.findUnique.mockResolvedValue(null);

            await expect(userService.updateProfile(userId, updateDto)).rejects.toThrow(NotFoundException);
            await expect(userService.updateProfile(userId, updateDto)).rejects.toThrow('User not found');
        });

        it('should only update firstName and lastName, not other fields', async () => {
            mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
            mockPrismaService.user.update.mockResolvedValue({ ...mockUser, ...updateDto });

            await userService.updateProfile(userId, updateDto);
            expect(mockPrismaService.user.update).toHaveBeenCalledWith({ where: { id: userId }, data: { firstName: 'Alexander', lastName: 'Updated' } });
        });
    });

    describe('changePassword', () => {
        const changePasswordDto: ChangePasswordDto = { currentPassword: 'OldPass123!', newPassword: 'NewSecure456!' };

        it('should change password and invalidate all sessions', async () => {
            mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
            (argon2.verify as Mock).mockResolvedValue(true);
            (argon2.hash as Mock).mockResolvedValue('new-hashed-password');
            mockPrismaService.user.update.mockResolvedValue(mockUser);
            mockSessionService.invalidateAllSessions.mockResolvedValue(2);

            const result = await userService.changePassword(userId, changePasswordDto);

            expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({ where: { id: userId } });
            expect(argon2.verify).toHaveBeenCalledWith(mockUser.password, changePasswordDto.currentPassword);
            expect(argon2.hash).toHaveBeenCalledWith(changePasswordDto.newPassword, expect.any(Object));
            expect(mockPrismaService.user.update).toHaveBeenCalledWith({ where: { id: userId }, data: { password: 'new-hashed-password' } });
            expect(mockSessionService.invalidateAllSessions).toHaveBeenCalledWith(userId);
            expect(result.message).toBe('Password changed successfully. Please log in again.');
        });

        it('should throw NotFoundException if user does not exist', async () => {
            mockPrismaService.user.findUnique.mockResolvedValue(null);

            await expect(userService.changePassword(userId, changePasswordDto)).rejects.toThrow(NotFoundException);
            await expect(userService.changePassword(userId, changePasswordDto)).rejects.toThrow('User not found');
            expect(argon2.verify).not.toHaveBeenCalled();
        });

        it('should throw UnauthorizedException if current password is incorrect', async () => {
            mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
            (argon2.verify as Mock).mockResolvedValue(false);

            await expect(userService.changePassword(userId, changePasswordDto)).rejects.toThrow(UnauthorizedException);
            await expect(userService.changePassword(userId, changePasswordDto)).rejects.toThrow('Current password is incorrect.');
            expect(argon2.hash).not.toHaveBeenCalled();
            expect(mockPrismaService.user.update).not.toHaveBeenCalled();
        });

        it('should invalidate sessions even when user has no active sessions', async () => {
            mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
            (argon2.verify as Mock).mockResolvedValue(true);
            (argon2.hash as Mock).mockResolvedValue('new-hashed-password');
            mockPrismaService.user.update.mockResolvedValue(mockUser);
            mockSessionService.invalidateAllSessions.mockResolvedValue(0);

            const result = await userService.changePassword(userId, changePasswordDto);

            expect(mockSessionService.invalidateAllSessions).toHaveBeenCalledWith(userId);
            expect(result.message).toBe('Password changed successfully. Please log in again.');
        });

        it('should hash password before persisting (never store plaintext)', async () => {
            mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
            (argon2.verify as Mock).mockResolvedValue(true);
            (argon2.hash as Mock).mockResolvedValue('argon2-hashed-value');
            mockPrismaService.user.update.mockResolvedValue(mockUser);

            await userService.changePassword(userId, changePasswordDto);

            // The update must use the hashed value, not the plaintext
            expect(mockPrismaService.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: { password: 'argon2-hashed-value' } }));
        });

        it('should not update database if current password verification fails', async () => {
            mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
            (argon2.verify as Mock).mockResolvedValue(false);

            try {
                await userService.changePassword(userId, changePasswordDto);
                expect.unreachable('Should have thrown UnauthorizedException');
            } catch {
                // expected
            }

            expect(mockPrismaService.user.update).not.toHaveBeenCalled();
            expect(mockSessionService.invalidateAllSessions).not.toHaveBeenCalled();
        });
    });

    describe('deleteAccount', () => {
        it('should delete user with no household immediately', async () => {
            mockPrismaService.householdMember.findUnique.mockResolvedValue(null);
            mockPrismaService.user.update.mockResolvedValue(mockUser);

            const result = await userService.deleteAccount(userId);

            expect(mockSessionService.invalidateAllSessions).toHaveBeenCalledWith(userId);
            expect(mockPrismaService.user.update).toHaveBeenCalledWith({
                where: { id: userId },
                data: expect.objectContaining({ deletedAt: expect.any(Date) }),
            });
            expect(result.message).toBe('Your account has been successfully deleted.');
        });

        it('should delete household and anonymize when sole owner', async () => {
            mockPrismaService.householdMember.findUnique.mockResolvedValue(mockSoleMembership);
            mockPrismaService.household.delete.mockResolvedValue({});
            mockPrismaService.user.update.mockResolvedValue(mockUser);

            const result = await userService.deleteAccount(userId);

            expect(mockPrismaService.household.delete).toHaveBeenCalledWith({ where: { id: householdId } });
            expect(result.message).toBe('Your account and household have been successfully deleted.');
        });

        it('should throw ForbiddenException when owner has multiple members', async () => {
            mockPrismaService.householdMember.findUnique.mockResolvedValue(mockOwnerMembership);

            await expect(userService.deleteAccount(userId)).rejects.toThrow(ForbiddenException);
            await expect(userService.deleteAccount(userId)).rejects.toThrow('must send a deletion request first');
        });

        it('should delete personal data and anonymize when member', async () => {
            mockPrismaService.householdMember.findUnique.mockResolvedValue(mockMemberMembership);
            mockPrismaService.$transaction.mockResolvedValue([]);
            mockPrismaService.user.update.mockResolvedValue(mockUser);

            const result = await userService.deleteAccount(userId);

            expect(mockPrismaService.$transaction).toHaveBeenCalled();
            expect(result.message).toBe('Your account has been successfully deleted.');
        });
    });

    describe('requestAccountDeletion', () => {
        const dto: RequestAccountDeletionDto = { targetMemberId: targetUserId };

        it('should create deletion request and return requestId', async () => {
            mockPrismaService.householdMember.findUnique
                .mockResolvedValueOnce(mockOwnerMembership) // owner lookup
                .mockResolvedValueOnce({ userId: targetUserId, householdId }); // target lookup
            mockRedis.get.mockResolvedValue(null); // no existing request

            const result = await userService.requestAccountDeletion(userId, dto);

            expect(result).toHaveProperty('requestId');
            expect(typeof result.requestId).toBe('string');
            expect(mockRedis.pipeline).toHaveBeenCalled();
        });

        it('should throw ForbiddenException if caller is not owner', async () => {
            mockPrismaService.householdMember.findUnique.mockResolvedValue({
                ...mockOwnerMembership,
                role: HouseholdRole.MEMBER,
            });

            await expect(userService.requestAccountDeletion(userId, dto)).rejects.toThrow(ForbiddenException);
            await expect(userService.requestAccountDeletion(userId, dto)).rejects.toThrow('Only the household owner');
        });

        it('should throw BadRequestException if no other members', async () => {
            mockPrismaService.householdMember.findUnique.mockResolvedValue(mockSoleMembership);

            await expect(userService.requestAccountDeletion(userId, dto)).rejects.toThrow(BadRequestException);
            await expect(userService.requestAccountDeletion(userId, dto)).rejects.toThrow('No other members');
        });

        it('should throw ForbiddenException if target is self', async () => {
            mockPrismaService.householdMember.findUnique.mockResolvedValue(mockOwnerMembership);

            const selfDto: RequestAccountDeletionDto = { targetMemberId: userId };
            await expect(userService.requestAccountDeletion(userId, selfDto)).rejects.toThrow(ForbiddenException);
            await expect(userService.requestAccountDeletion(userId, selfDto)).rejects.toThrow('Cannot send a deletion request to yourself');
        });

        it('should throw NotFoundException if target not in household', async () => {
            mockPrismaService.householdMember.findUnique
                .mockResolvedValueOnce(mockOwnerMembership)
                .mockResolvedValueOnce({ userId: targetUserId, householdId: 'other-household' });

            const promise = userService.requestAccountDeletion(userId, dto);
            await expect(promise).rejects.toThrow(NotFoundException);
            await expect(promise).rejects.toThrow('not a member of your household');
        });

        it('should throw ConflictException if pending request already exists', async () => {
            mockPrismaService.householdMember.findUnique
                .mockResolvedValueOnce(mockOwnerMembership)
                .mockResolvedValueOnce({ userId: targetUserId, householdId });
            mockRedis.get.mockResolvedValue(requestId); // existing request

            await expect(userService.requestAccountDeletion(userId, dto)).rejects.toThrow(ConflictException);
            await expect(userService.requestAccountDeletion(userId, dto)).rejects.toThrow('pending deletion request already exists');
        });
    });

    describe('getPendingDeleteAccountRequests', () => {
        it('should return empty array when no pending request', async () => {
            mockRedis.get.mockResolvedValue(null);

            const result = await userService.getPendingDeleteAccountRequests(userId);

            expect(result).toEqual([]);
        });

        it('should return pending request details', async () => {
            const payload = JSON.stringify({
                ownerId: targetUserId,
                householdId,
                requestedAt: '2026-01-01T00:00:00.000Z',
            });
            mockRedis.get
                .mockResolvedValueOnce(requestId) // target lookup
                .mockResolvedValueOnce(payload);  // request payload
            mockPrismaService.user.findUnique.mockResolvedValue(mockTargetUser);
            mockPrismaService.household.findUnique.mockResolvedValue(mockHousehold);

            const result = await userService.getPendingDeleteAccountRequests(userId);

            expect(result).toHaveLength(1);
            expect(result[0].requestId).toBe(requestId);
            expect(result[0].ownerId).toBe(targetUserId);
            expect(result[0].ownerFirstName).toBe('Sam');
        });

        it('should clean up stale index key when request not found', async () => {
            mockRedis.get
                .mockResolvedValueOnce(requestId) // target lookup
                .mockResolvedValueOnce(null);      // request not found
            mockRedis.del.mockResolvedValue(1);

            const result = await userService.getPendingDeleteAccountRequests(userId);

            expect(result).toEqual([]);
            expect(mockRedis.del).toHaveBeenCalledWith(`delete_request_target:${userId}`);
        });
    });

    describe('respondToDeleteAccountRequest', () => {
        const payload = JSON.stringify({ ownerId: targetUserId, targetMemberId: userId, householdId });
        const acceptDto: RespondDeleteAccountRequestDto = { accept: true };
        const rejectDto: RespondDeleteAccountRequestDto = { accept: false };

        it('should throw NotFoundException if request not found', async () => {
            mockRedis.get.mockResolvedValue(null);

            await expect(userService.respondToDeleteAccountRequest(userId, requestId, acceptDto)).rejects.toThrow(NotFoundException);
            await expect(userService.respondToDeleteAccountRequest(userId, requestId, acceptDto)).rejects.toThrow('not found or has expired');
        });

        it('should throw ForbiddenException if caller is not the target', async () => {
            const otherPayload = JSON.stringify({ ownerId: targetUserId, targetMemberId: 'other-user', householdId });
            mockRedis.get.mockResolvedValue(otherPayload);

            await expect(userService.respondToDeleteAccountRequest(userId, requestId, acceptDto)).rejects.toThrow(ForbiddenException);
            await expect(userService.respondToDeleteAccountRequest(userId, requestId, acceptDto)).rejects.toThrow('not the target');
        });

        it('should transfer ownership and anonymize owner on accept', async () => {
            mockRedis.get.mockResolvedValue(payload);
            mockRedis.del.mockResolvedValue(1);
            mockPrismaService.$transaction.mockResolvedValue([]);
            mockPrismaService.user.update.mockResolvedValue({});

            const result = await userService.respondToDeleteAccountRequest(userId, requestId, acceptDto);

            expect(mockPrismaService.$transaction).toHaveBeenCalled();
            expect(mockPrismaService.user.update).toHaveBeenCalledWith({
                where: { id: targetUserId },
                data: expect.objectContaining({ deletedAt: expect.any(Date) }),
            });
            expect(result.message).toContain('household owner');
        });

        it('should delete household and anonymize owner on reject', async () => {
            mockRedis.get.mockResolvedValue(payload);
            mockRedis.del.mockResolvedValue(1);
            mockPrismaService.household.delete.mockResolvedValue({});
            mockPrismaService.user.update.mockResolvedValue({});

            const result = await userService.respondToDeleteAccountRequest(userId, requestId, rejectDto);

            expect(mockPrismaService.household.delete).toHaveBeenCalledWith({ where: { id: householdId } });
            expect(mockPrismaService.user.update).toHaveBeenCalledWith({
                where: { id: targetUserId },
                data: expect.objectContaining({ deletedAt: expect.any(Date) }),
            });
            expect(result.message).toContain('rejected');
        });
    });

    describe('cancelDeleteAccountRequest', () => {
        it('should throw NotFoundException when no pending request', async () => {
            mockRedis.get.mockResolvedValue(null);

            await expect(userService.cancelDeleteAccountRequest(userId)).rejects.toThrow(NotFoundException);
            await expect(userService.cancelDeleteAccountRequest(userId)).rejects.toThrow('No pending deletion request found');
        });

        it('should delete all Redis keys and return success', async () => {
            const payload = JSON.stringify({ targetMemberId: targetUserId });
            mockRedis.get
                .mockResolvedValueOnce(requestId) // owner lookup
                .mockResolvedValueOnce(payload);  // request payload
            mockRedis.del.mockResolvedValue(1);

            const result = await userService.cancelDeleteAccountRequest(userId);

            expect(mockRedis.del).toHaveBeenCalledWith(`delete_request_target:${targetUserId}`);
            expect(mockRedis.del).toHaveBeenCalledWith(`delete_request:${requestId}`, `delete_request_owner:${userId}`);
            expect(result.message).toBe('Your deletion request has been cancelled.');
        });
    });
});
