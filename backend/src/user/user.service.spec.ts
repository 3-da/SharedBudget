import { beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { UserService } from './user.service';
import { PrismaService } from '../prisma/prisma.service';
import { SessionService } from '../session/session.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

vi.mock('argon2', () => ({
    hash: vi.fn(),
    verify: vi.fn(),
}));

describe('UserService', () => {
    let userService: UserService;

    const userId = 'user-123';
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

    const mockPrismaService = {
        user: { findUnique: vi.fn(), update: vi.fn() },
    };

    const mockSessionService = {
        invalidateAllSessions: vi.fn().mockResolvedValue(0),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [UserService, { provide: PrismaService, useValue: mockPrismaService }, { provide: SessionService, useValue: mockSessionService }],
        }).compile();

        userService = module.get<UserService>(UserService);

        vi.clearAllMocks();
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
            expect(argon2.hash).toHaveBeenCalledWith(changePasswordDto.newPassword);
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
});
