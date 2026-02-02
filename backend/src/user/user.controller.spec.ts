import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

describe('UserController', () => {
    let controller: UserController;

    const userId = 'user-123';

    const mockProfile = {
        id: userId,
        email: 'alex@example.com',
        firstName: 'Alex',
        lastName: 'Owner',
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
    };

    const mockUserService = {
        getProfile: vi.fn(),
        updateProfile: vi.fn(),
        changePassword: vi.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [UserController],
            providers: [{ provide: UserService, useValue: mockUserService }],
        }).compile();

        controller = module.get<UserController>(UserController);

        vi.clearAllMocks();
    });

    describe('getProfile', () => {
        it('should return the user profile', async () => {
            mockUserService.getProfile.mockResolvedValue(mockProfile);

            const result = await controller.getProfile(userId);

            expect(mockUserService.getProfile).toHaveBeenCalledWith(userId);
            expect(result).toEqual(mockProfile);
        });
    });

    describe('updateProfile', () => {
        it('should pass dto to service and return updated profile', async () => {
            const dto: UpdateProfileDto = { firstName: 'Alexander', lastName: 'Updated' };
            const updatedProfile = { ...mockProfile, ...dto };
            mockUserService.updateProfile.mockResolvedValue(updatedProfile);

            const result = await controller.updateProfile(userId, dto);

            expect(mockUserService.updateProfile).toHaveBeenCalledWith(userId, dto);
            expect(result.firstName).toBe('Alexander');
        });
    });

    describe('changePassword', () => {
        it('should pass dto to service and return success message', async () => {
            const dto: ChangePasswordDto = { currentPassword: 'OldPass123!', newPassword: 'NewSecure456!' };
            mockUserService.changePassword.mockResolvedValue({ message: 'Password changed successfully. Please log in again.' });

            const result = await controller.changePassword(userId, dto);

            expect(mockUserService.changePassword).toHaveBeenCalledWith(userId, dto);
            expect(result.message).toBe('Password changed successfully. Please log in again.');
        });
    });
});
