import { beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { REDIS_CLIENT } from '../redis/redis.module';

vi.mock('argon2', () => ({
    hash: vi.fn(),
    verify: vi.fn(),
}));

describe('AuthService', () => {
    let authService: AuthService;

    const refreshToken = 'valid-refresh-token';
    const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        password: 'hashed-password',
        firstName: 'John',
        lastName: 'Doe',
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
    };
    const mockUnverifiedUser = { ...mockUser, emailVerified: false };

    const mockPipeline = {
        del: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
    };

    const mockRedis = {
        get: vi.fn(),
        set: vi.fn(),
        del: vi.fn(),
        sadd: vi.fn(),
        srem: vi.fn(),
        smembers: vi.fn().mockResolvedValue([]),
        pipeline: vi.fn(() => mockPipeline),
    };

    const mockPrismaService = {
        user: {
            findUnique: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
        },
    };

    const mockMailService = {
        sendVerificationCode: vi.fn(),
        sendPasswordResetLink: vi.fn(),
    };

    const mockJwtService = { sign: vi.fn().mockReturnValue('mock-access-token') };
    const mockConfigService = { get: vi.fn().mockReturnValue(600) };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthService,
                { provide: PrismaService, useValue: mockPrismaService },
                { provide: JwtService, useValue: mockJwtService },
                { provide: ConfigService, useValue: mockConfigService },
                { provide: REDIS_CLIENT, useValue: mockRedis },
                { provide: MailService, useValue: mockMailService },
            ],
        }).compile();

        authService = module.get<AuthService>(AuthService);

        vi.clearAllMocks();
    });

    describe('register', () => {
        const registerDto: RegisterDto = {
            email: 'test@example.com',
            password: 'password123',
            firstName: 'John',
            lastName: 'Doe',
        };

        it('should register a new user and send verification code', async () => {
            mockPrismaService.user.findUnique.mockResolvedValue(null);
            mockPrismaService.user.create.mockResolvedValue(mockUnverifiedUser);
            (argon2.hash as Mock).mockResolvedValue('hashed-password');

            const result = await authService.register(registerDto);

            expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({ where: { email: registerDto.email } });
            expect(argon2.hash).toHaveBeenCalledWith(registerDto.password);
            expect(mockPrismaService.user.create).toHaveBeenCalled();
            expect(mockRedis.set).toHaveBeenCalled();
            expect(mockMailService.sendVerificationCode).toHaveBeenCalled();
            expect(result.message).toBe("We've sent a verification code to your email.");
        });

        it('should return same message if email already exists (security)', async () => {
            mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

            const result = await authService.register(registerDto);

            expect(result.message).toBe("We've sent a verification code to your email.");
            expect(mockPrismaService.user.create).not.toHaveBeenCalled();
        });
    });

    describe('verifyCode', () => {
        const email = 'test@example.com';
        const code = '123456';

        it('should verify code and return tokens (auto-login)', async () => {
            mockRedis.get.mockResolvedValue(code);
            mockPrismaService.user.findUnique.mockResolvedValue(mockUnverifiedUser);
            mockPrismaService.user.update.mockResolvedValue(mockUser);

            const result = await authService.verifyCode(email, code);

            expect(mockRedis.get).toHaveBeenCalledWith(`verify:${email}`);
            expect(mockPrismaService.user.update).toHaveBeenCalledWith({ where: { id: mockUnverifiedUser.id }, data: { emailVerified: true } });
            expect(mockRedis.del).toHaveBeenCalledWith(`verify:${email}`);
            expect(result.accessToken).toBe('mock-access-token');
            expect(result.refreshToken).toBeDefined();
        });

        it('should track token in session set after verification', async () => {
            mockRedis.get.mockResolvedValue(code);
            mockPrismaService.user.findUnique.mockResolvedValue(mockUnverifiedUser);
            mockPrismaService.user.update.mockResolvedValue(mockUser);

            await authService.verifyCode(email, code);

            expect(mockRedis.sadd).toHaveBeenCalledWith(`user_sessions:${mockUnverifiedUser.id}`, expect.any(String));
        });

        it('should throw UnauthorizedException if code is invalid', async () => {
            mockRedis.get.mockResolvedValue('654321');
            await expect(authService.verifyCode(email, code)).rejects.toThrow(UnauthorizedException);
        });

        it('should throw UnauthorizedException if code is expired', async () => {
            mockRedis.get.mockResolvedValue(null);
            await expect(authService.verifyCode(email, code)).rejects.toThrow(UnauthorizedException);
        });

        it('should throw UnauthorizedException if user not found', async () => {
            mockRedis.get.mockResolvedValue(code);
            mockPrismaService.user.findUnique.mockResolvedValue(null);

            await expect(authService.verifyCode(email, code)).rejects.toThrow(UnauthorizedException);
        });
    });

    describe('resendCode', () => {
        const email = 'test@example.com';

        it('should send new code for unverified user', async () => {
            mockPrismaService.user.findUnique.mockResolvedValue(mockUnverifiedUser);
            const result = await authService.resendCode(email);

            expect(mockRedis.set).toHaveBeenCalled();
            expect(mockMailService.sendVerificationCode).toHaveBeenCalled();
            expect(result.message).toBe("If an account exists, we've sent a new code.");
        });

        it('should return same message for non-existent email (security)', async () => {
            mockPrismaService.user.findUnique.mockResolvedValue(null);
            const result = await authService.resendCode(email);

            expect(result.message).toBe("If an account exists, we've sent a new code.");
            expect(mockMailService.sendVerificationCode).not.toHaveBeenCalled();
        });

        it('should return same message for already verified user', async () => {
            mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
            const result = await authService.resendCode(email);

            expect(result.message).toBe("If an account exists, we've sent a new code.");
            expect(mockMailService.sendVerificationCode).not.toHaveBeenCalled();
        });
    });

    describe('login', () => {
        const loginDto: LoginDto = { email: 'test@example.com', password: 'password123' };

        it('should return tokens for valid credentials (verified user)', async () => {
            mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
            (argon2.verify as Mock).mockResolvedValue(true);

            const result = await authService.login(loginDto);

            expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({ where: { email: loginDto.email } });
            expect(argon2.verify).toHaveBeenCalledWith(mockUser.password, loginDto.password);
            expect(mockRedis.set).toHaveBeenCalled();
            expect(result.accessToken).toBe('mock-access-token');
            expect(result.refreshToken).toBeDefined();
        });

        it('should track token in session set on successful login', async () => {
            mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
            (argon2.verify as Mock).mockResolvedValue(true);

            await authService.login(loginDto);

            expect(mockRedis.sadd).toHaveBeenCalledWith(`user_sessions:${mockUser.id}`, expect.any(String));
        });

        it('should throw UnauthorizedException if user not found', async () => {
            mockPrismaService.user.findUnique.mockResolvedValue(null);

            await expect(authService.login(loginDto)).rejects.toThrow(UnauthorizedException);
            expect(argon2.verify).not.toHaveBeenCalled();
        });

        it('should throw UnauthorizedException if password is invalid', async () => {
            mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
            (argon2.verify as Mock).mockResolvedValue(false);

            await expect(authService.login(loginDto)).rejects.toThrow(UnauthorizedException);
        });

        it('should throw ForbiddenException if email not verified', async () => {
            mockPrismaService.user.findUnique.mockResolvedValue(mockUnverifiedUser);
            (argon2.verify as Mock).mockResolvedValue(true);

            await expect(authService.login(loginDto)).rejects.toThrow(ForbiddenException);
        });
    });

    describe('refresh', () => {
        it('should return new tokens for valid refresh token', async () => {
            mockRedis.get.mockResolvedValue(mockUser.id);
            mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

            const result = await authService.refresh(refreshToken);

            expect(mockRedis.get).toHaveBeenCalledWith(`refresh:${refreshToken}`);
            expect(mockRedis.del).toHaveBeenCalledWith(`refresh:${refreshToken}`);
            expect(mockRedis.srem).toHaveBeenCalledWith(`user_sessions:${mockUser.id}`, refreshToken);
            expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({ where: { id: mockUser.id } });
            expect(result.accessToken).toBe('mock-access-token');
            expect(result.refreshToken).toBeDefined();
        });

        it('should track new token in session set', async () => {
            mockRedis.get.mockResolvedValue(mockUser.id);
            mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

            await authService.refresh(refreshToken);

            expect(mockRedis.sadd).toHaveBeenCalledWith(`user_sessions:${mockUser.id}`, expect.any(String));
        });

        it('should throw UnauthorizedException if refresh token is invalid', async () => {
            mockRedis.get.mockResolvedValue(null);

            await expect(authService.refresh(refreshToken)).rejects.toThrow(UnauthorizedException);
            expect(mockPrismaService.user.findUnique).not.toHaveBeenCalled();
        });

        it('should throw UnauthorizedException if user not found', async () => {
            mockRedis.get.mockResolvedValue(mockUser.id);
            mockPrismaService.user.findUnique.mockResolvedValue(null);

            await expect(authService.refresh(refreshToken)).rejects.toThrow(UnauthorizedException);
        });
    });

    describe('logout', () => {
        it('should delete refresh token and remove from session set', async () => {
            mockRedis.get.mockResolvedValue(mockUser.id);

            await authService.logout(refreshToken);

            expect(mockRedis.del).toHaveBeenCalledWith(`refresh:${refreshToken}`);
            expect(mockRedis.srem).toHaveBeenCalledWith(`user_sessions:${mockUser.id}`, refreshToken);
        });

        it('should still delete token even if userId not found', async () => {
            mockRedis.get.mockResolvedValue(null);

            await authService.logout(refreshToken);

            expect(mockRedis.del).toHaveBeenCalledWith(`refresh:${refreshToken}`);
            expect(mockRedis.srem).not.toHaveBeenCalled();
        });
    });

    describe('forgotPassword', () => {
        const email = 'test@example.com';

        it('should send reset link for existing user', async () => {
            mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

            const result = await authService.forgotPassword(email);

            expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({ where: { email } });
            expect(mockRedis.set).toHaveBeenCalled();
            expect(mockMailService.sendPasswordResetLink).toHaveBeenCalledWith(email, expect.any(String));
            expect(result.message).toBe("If an account exists, we've sent a password reset link.");
        });

        it('should return same message for non-existent email (security)', async () => {
            mockPrismaService.user.findUnique.mockResolvedValue(null);

            const result = await authService.forgotPassword(email);

            expect(result.message).toBe("If an account exists, we've sent a password reset link.");
            expect(mockRedis.set).not.toHaveBeenCalled();
            expect(mockMailService.sendPasswordResetLink).not.toHaveBeenCalled();
        });
    });

    describe('resetPassword', () => {
        const token = 'valid-reset-token';
        const newPassword = 'newPassword123';

        it('should reset password for valid token', async () => {
            mockRedis.get.mockResolvedValue(mockUser.id);
            mockRedis.smembers.mockResolvedValue([]);
            mockPrismaService.user.update.mockResolvedValue(mockUser);
            (argon2.hash as Mock).mockResolvedValue('new-hashed-password');

            const result = await authService.resetPassword(token, newPassword);

            expect(mockRedis.get).toHaveBeenCalledWith(`reset:${token}`);
            expect(argon2.hash).toHaveBeenCalledWith(newPassword);
            expect(mockPrismaService.user.update).toHaveBeenCalledWith({ where: { id: mockUser.id }, data: { password: 'new-hashed-password' } });
            expect(mockRedis.del).toHaveBeenCalledWith(`reset:${token}`);
            expect(result.message).toBe('Password reset successfully. You can now log in with your new password.');
        });

        it('should invalidate all user sessions after password reset', async () => {
            const existingTokens = ['token1', 'token2', 'token3'];
            mockRedis.get.mockResolvedValue(mockUser.id);
            mockRedis.smembers.mockResolvedValue(existingTokens);
            mockPrismaService.user.update.mockResolvedValue(mockUser);
            (argon2.hash as Mock).mockResolvedValue('new-hashed-password');

            await authService.resetPassword(token, newPassword);

            expect(mockRedis.smembers).toHaveBeenCalledWith(`user_sessions:${mockUser.id}`);
            expect(mockRedis.pipeline).toHaveBeenCalled();
            expect(mockPipeline.del).toHaveBeenCalledTimes(4); // 3 tokens + 1 session set
            expect(mockPipeline.exec).toHaveBeenCalled();
        });

        it('should handle reset when user has no active sessions', async () => {
            mockRedis.get.mockResolvedValue(mockUser.id);
            mockRedis.smembers.mockResolvedValue([]);
            mockPrismaService.user.update.mockResolvedValue(mockUser);
            (argon2.hash as Mock).mockResolvedValue('new-hashed-password');

            const result = await authService.resetPassword(token, newPassword);

            expect(mockRedis.smembers).toHaveBeenCalledWith(`user_sessions:${mockUser.id}`);
            expect(mockRedis.pipeline).not.toHaveBeenCalled();
            expect(result.message).toBe('Password reset successfully. You can now log in with your new password.');
        });

        it('should throw UnauthorizedException if token is invalid', async () => {
            mockRedis.get.mockResolvedValue(null);

            await expect(authService.resetPassword(token, newPassword)).rejects.toThrow(UnauthorizedException);
            expect(mockPrismaService.user.update).not.toHaveBeenCalled();
        });

        it('should throw UnauthorizedException if token is expired', async () => {
            mockRedis.get.mockResolvedValue(null);

            await expect(authService.resetPassword(token, newPassword)).rejects.toThrow(UnauthorizedException);
        });
    });
});
