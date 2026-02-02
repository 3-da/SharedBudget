import { beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { SessionService } from '../session/session.service';
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

    const mockRedis = {
        get: vi.fn(),
        set: vi.fn(),
        del: vi.fn(),
    };

    const mockSessionService = {
        storeRefreshToken: vi.fn(),
        getUserIdFromRefreshToken: vi.fn(),
        removeRefreshToken: vi.fn(),
        invalidateAllSessions: vi.fn().mockResolvedValue(0),
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
                { provide: SessionService, useValue: mockSessionService },
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

        it('should store token via SessionService after verification', async () => {
            mockRedis.get.mockResolvedValue(code);
            mockPrismaService.user.findUnique.mockResolvedValue(mockUnverifiedUser);
            mockPrismaService.user.update.mockResolvedValue(mockUser);

            await authService.verifyCode(email, code);

            expect(mockSessionService.storeRefreshToken).toHaveBeenCalledWith(mockUnverifiedUser.id, expect.any(String));
        });

        it('should throw UnauthorizedException if code is invalid', async () => {
            mockRedis.get.mockResolvedValue('654321');

            try {
                await authService.verifyCode(email, code);
                expect.unreachable('Should have thrown UnauthorizedException');
            } catch (error) {
                expect(error).toBeInstanceOf(UnauthorizedException);
                expect(error.message).toBe('Invalid or expired verification code.');
            }
        });

        it('should throw UnauthorizedException if code is expired', async () => {
            mockRedis.get.mockResolvedValue(null);

            try {
                await authService.verifyCode(email, code);
                expect.unreachable('Should have thrown UnauthorizedException');
            } catch (error) {
                expect(error).toBeInstanceOf(UnauthorizedException);
                expect(error.message).toBe('Invalid or expired verification code.');
            }
        });

        it('should throw UnauthorizedException if user not found', async () => {
            mockRedis.get.mockResolvedValue(code);
            mockPrismaService.user.findUnique.mockResolvedValue(null);

            try {
                await authService.verifyCode(email, code);
                expect.unreachable('Should have thrown UnauthorizedException');
            } catch (error) {
                expect(error).toBeInstanceOf(UnauthorizedException);
                expect(error.message).toBe('Invalid or expired verification code.');
            }
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
            expect(mockSessionService.storeRefreshToken).toHaveBeenCalledWith(mockUser.id, expect.any(String));
            expect(result.accessToken).toBe('mock-access-token');
            expect(result.refreshToken).toBeDefined();
        });

        it('should throw UnauthorizedException if user not found', async () => {
            mockPrismaService.user.findUnique.mockResolvedValue(null);

            try {
                await authService.login(loginDto);
                expect.unreachable('Should have thrown UnauthorizedException');
            } catch (error) {
                expect(error).toBeInstanceOf(UnauthorizedException);
                expect(error.message).toBe('Incorrect email or password.');
            }
            expect(argon2.verify).not.toHaveBeenCalled();
        });

        it('should throw UnauthorizedException if password is invalid', async () => {
            mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
            (argon2.verify as Mock).mockResolvedValue(false);

            try {
                await authService.login(loginDto);
                expect.unreachable('Should have thrown UnauthorizedException');
            } catch (error) {
                expect(error).toBeInstanceOf(UnauthorizedException);
                expect(error.message).toBe('Incorrect email or password.');
            }
        });

        it('should throw ForbiddenException if email not verified', async () => {
            mockPrismaService.user.findUnique.mockResolvedValue(mockUnverifiedUser);
            (argon2.verify as Mock).mockResolvedValue(true);

            try {
                await authService.login(loginDto);
                expect.unreachable('Should have thrown ForbiddenException');
            } catch (error) {
                expect(error).toBeInstanceOf(ForbiddenException);
                expect(error.message).toBe('Please verify your email first. Check your inbox for the verification code.');
            }
        });

        it('should return the same error message for user-not-found and bad-password (enumeration prevention)', async () => {
            // Security: an attacker must not be able to distinguish "email doesn't exist" from "wrong password"
            mockPrismaService.user.findUnique.mockResolvedValue(null);
            let notFoundMessage: string;
            try {
                await authService.login(loginDto);
                expect.unreachable('Should have thrown');
            } catch (error) {
                notFoundMessage = error.message;
            }

            vi.clearAllMocks();
            mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
            (argon2.verify as Mock).mockResolvedValue(false);
            let badPasswordMessage: string;
            try {
                await authService.login(loginDto);
                expect.unreachable('Should have thrown');
            } catch (error) {
                badPasswordMessage = error.message;
            }

            expect(notFoundMessage).toBe(badPasswordMessage);
            expect(notFoundMessage).toBe('Incorrect email or password.');
        });
    });

    describe('refresh', () => {
        it('should return new tokens for valid refresh token', async () => {
            mockSessionService.getUserIdFromRefreshToken.mockResolvedValue(mockUser.id);
            mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

            const result = await authService.refresh(refreshToken);

            expect(mockSessionService.getUserIdFromRefreshToken).toHaveBeenCalledWith(refreshToken);
            expect(mockSessionService.removeRefreshToken).toHaveBeenCalledWith(refreshToken);
            expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({ where: { id: mockUser.id } });
            expect(result.accessToken).toBe('mock-access-token');
            expect(result.refreshToken).toBeDefined();
        });

        it('should store new token via SessionService after refresh', async () => {
            mockSessionService.getUserIdFromRefreshToken.mockResolvedValue(mockUser.id);
            mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

            await authService.refresh(refreshToken);

            expect(mockSessionService.storeRefreshToken).toHaveBeenCalledWith(mockUser.id, expect.any(String));
        });

        it('should throw UnauthorizedException if refresh token is invalid', async () => {
            mockSessionService.getUserIdFromRefreshToken.mockResolvedValue(null);

            try {
                await authService.refresh(refreshToken);
                expect.unreachable('Should have thrown UnauthorizedException');
            } catch (error) {
                expect(error).toBeInstanceOf(UnauthorizedException);
                expect(error.message).toBe('Invalid or expired session. Please sign in again.');
            }
            expect(mockPrismaService.user.findUnique).not.toHaveBeenCalled();
        });

        it('should throw UnauthorizedException if user not found', async () => {
            mockSessionService.getUserIdFromRefreshToken.mockResolvedValue(mockUser.id);
            mockPrismaService.user.findUnique.mockResolvedValue(null);

            try {
                await authService.refresh(refreshToken);
                expect.unreachable('Should have thrown UnauthorizedException');
            } catch (error) {
                expect(error).toBeInstanceOf(UnauthorizedException);
                expect(error.message).toBe('Invalid or expired session. Please sign in again.');
            }
        });
    });

    describe('logout', () => {
        it('should remove refresh token via SessionService', async () => {
            mockSessionService.removeRefreshToken.mockResolvedValue(mockUser.id);

            await authService.logout(refreshToken);

            expect(mockSessionService.removeRefreshToken).toHaveBeenCalledWith(refreshToken);
        });

        it('should still succeed even if token was already gone', async () => {
            mockSessionService.removeRefreshToken.mockResolvedValue(null);

            await authService.logout(refreshToken);

            expect(mockSessionService.removeRefreshToken).toHaveBeenCalledWith(refreshToken);
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
            mockSessionService.invalidateAllSessions.mockResolvedValue(0);
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
            mockRedis.get.mockResolvedValue(mockUser.id);
            mockSessionService.invalidateAllSessions.mockResolvedValue(3);
            mockPrismaService.user.update.mockResolvedValue(mockUser);
            (argon2.hash as Mock).mockResolvedValue('new-hashed-password');

            await authService.resetPassword(token, newPassword);

            expect(mockSessionService.invalidateAllSessions).toHaveBeenCalledWith(mockUser.id);
        });

        it('should handle reset when user has no active sessions', async () => {
            mockRedis.get.mockResolvedValue(mockUser.id);
            mockSessionService.invalidateAllSessions.mockResolvedValue(0);
            mockPrismaService.user.update.mockResolvedValue(mockUser);
            (argon2.hash as Mock).mockResolvedValue('new-hashed-password');

            const result = await authService.resetPassword(token, newPassword);

            expect(mockSessionService.invalidateAllSessions).toHaveBeenCalledWith(mockUser.id);
            expect(result.message).toBe('Password reset successfully. You can now log in with your new password.');
        });

        it('should throw UnauthorizedException if token is invalid', async () => {
            mockRedis.get.mockResolvedValue(null);

            try {
                await authService.resetPassword(token, newPassword);
                expect.unreachable('Should have thrown UnauthorizedException');
            } catch (error) {
                expect(error).toBeInstanceOf(UnauthorizedException);
                expect(error.message).toBe('Invalid or expired reset token.');
            }
            expect(mockPrismaService.user.update).not.toHaveBeenCalled();
        });

        it('should throw UnauthorizedException if token is expired', async () => {
            mockRedis.get.mockResolvedValue(null);

            try {
                await authService.resetPassword(token, newPassword);
                expect.unreachable('Should have thrown UnauthorizedException');
            } catch (error) {
                expect(error).toBeInstanceOf(UnauthorizedException);
                expect(error.message).toBe('Invalid or expired reset token.');
            }
        });
    });
});
