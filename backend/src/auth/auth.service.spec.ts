import { beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, HttpException, HttpStatus, UnauthorizedException } from '@nestjs/common';
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
import { Response } from 'express';

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
        incr: vi.fn().mockReturnThis(),
        expire: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
    };

    const mockRedis = {
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn(),
        del: vi.fn(),
        pipeline: vi.fn(() => mockPipeline),
    };

    const mockSessionService = {
        storeRefreshToken: vi.fn(),
        getUserIdFromRefreshToken: vi.fn(),
        getSessionFromRefreshToken: vi.fn(),
        removeRefreshToken: vi.fn(),
        invalidateAllSessions: vi.fn().mockResolvedValue(0),
        hashUserAgent: vi.fn((ua: string) => (ua === 'Chrome/120' ? 'aaaa' : 'bbbb')),
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

    const mockRes = {
        cookie: vi.fn(),
        clearCookie: vi.fn(),
    } as unknown as Response;

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

        // A7: onModuleInit generates dummy argon2 hash at startup
        (argon2.hash as Mock).mockResolvedValue('$argon2id$v=19$m=65536,t=3,p=4$dummy$hash');
        await authService.onModuleInit();
        vi.clearAllMocks();

        // Reset redis.get to return null by default (D2: lockout check needs falsy value)
        mockRedis.get.mockResolvedValue(null);
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
            expect(argon2.hash).toHaveBeenCalledWith(registerDto.password, expect.objectContaining({ memoryCost: expect.any(Number) }));
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

            const result = await authService.verifyCode(email, code, mockRes);

            expect(mockRedis.get).toHaveBeenCalledWith(`verify:${email}`);
            expect(mockPrismaService.user.update).toHaveBeenCalledWith({ where: { id: mockUnverifiedUser.id }, data: { emailVerified: true } });
            expect(mockRedis.del).toHaveBeenCalledWith(`verify:${email}`);
            expect(result.accessToken).toBe('mock-access-token');
            expect(mockRes.cookie as unknown as Mock).toHaveBeenCalledWith('refresh_token', expect.any(String), expect.objectContaining({ httpOnly: true }));
        });

        it('should store token via SessionService after verification', async () => {
            mockRedis.get.mockResolvedValue(code);
            mockPrismaService.user.findUnique.mockResolvedValue(mockUnverifiedUser);
            mockPrismaService.user.update.mockResolvedValue(mockUser);

            await authService.verifyCode(email, code, mockRes);

            expect(mockSessionService.storeRefreshToken).toHaveBeenCalledWith(mockUnverifiedUser.id, expect.any(String), undefined);
        });

        it('should throw UnauthorizedException if code is invalid', async () => {
            mockRedis.get.mockResolvedValue('654321');

            await expect(authService.verifyCode(email, code, mockRes)).rejects.toThrow(UnauthorizedException);
            await expect(authService.verifyCode(email, code, mockRes)).rejects.toThrow('Invalid or expired verification code.');
        });

        it('should throw UnauthorizedException if code is expired', async () => {
            mockRedis.get.mockResolvedValue(null);

            await expect(authService.verifyCode(email, code, mockRes)).rejects.toThrow(UnauthorizedException);
            await expect(authService.verifyCode(email, code, mockRes)).rejects.toThrow('Invalid or expired verification code.');
        });

        it('should throw UnauthorizedException if user not found', async () => {
            mockRedis.get.mockResolvedValue(code);
            mockPrismaService.user.findUnique.mockResolvedValue(null);

            await expect(authService.verifyCode(email, code, mockRes)).rejects.toThrow(UnauthorizedException);
            await expect(authService.verifyCode(email, code, mockRes)).rejects.toThrow('Invalid or expired verification code.');
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

            const result = await authService.login(loginDto, mockRes);

            expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({ where: { email: loginDto.email } });
            expect(argon2.verify).toHaveBeenCalledWith(mockUser.password, loginDto.password);
            expect(mockSessionService.storeRefreshToken).toHaveBeenCalledWith(mockUser.id, expect.any(String), undefined);
            expect(result.accessToken).toBe('mock-access-token');
            expect(mockRes.cookie as unknown as Mock).toHaveBeenCalledWith('refresh_token', expect.any(String), expect.objectContaining({ httpOnly: true }));
        });

        it('should set XSRF-TOKEN cookie on login', async () => {
            mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
            (argon2.verify as Mock).mockResolvedValue(true);

            await authService.login(loginDto, mockRes);

            expect(mockRes.cookie as unknown as Mock).toHaveBeenCalledWith('XSRF-TOKEN', expect.any(String), expect.objectContaining({ httpOnly: false }));
        });

        it('should throw UnauthorizedException if user not found', async () => {
            mockPrismaService.user.findUnique.mockResolvedValue(null);
            (argon2.verify as Mock).mockResolvedValue(false);

            await expect(authService.login(loginDto, mockRes)).rejects.toThrow(UnauthorizedException);
            await expect(authService.login(loginDto, mockRes)).rejects.toThrow('Incorrect email or password.');
            // Dummy hash verification should be called to equalize timing
            expect(argon2.verify).toHaveBeenCalledWith(expect.stringContaining('$argon2id$'), loginDto.password);
        });

        it('should throw UnauthorizedException if password is invalid', async () => {
            mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
            (argon2.verify as Mock).mockResolvedValue(false);

            await expect(authService.login(loginDto, mockRes)).rejects.toThrow(UnauthorizedException);
            await expect(authService.login(loginDto, mockRes)).rejects.toThrow('Incorrect email or password.');
        });

        it('should throw ForbiddenException if email not verified', async () => {
            mockPrismaService.user.findUnique.mockResolvedValue(mockUnverifiedUser);
            (argon2.verify as Mock).mockResolvedValue(true);

            await expect(authService.login(loginDto, mockRes)).rejects.toThrow(ForbiddenException);
            await expect(authService.login(loginDto, mockRes)).rejects.toThrow('Please verify your email first. Check your inbox for the verification code.');
        });

        it('should return the same error message for user-not-found and bad-password (enumeration prevention)', async () => {
            // Security: an attacker must not be able to distinguish "email doesn't exist" from "wrong password"
            mockPrismaService.user.findUnique.mockResolvedValue(null);
            await expect(authService.login(loginDto, mockRes)).rejects.toThrow(UnauthorizedException);
            await expect(authService.login(loginDto, mockRes)).rejects.toThrow('Incorrect email or password.');

            vi.clearAllMocks();
            mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
            (argon2.verify as Mock).mockResolvedValue(false);
            await expect(authService.login(loginDto, mockRes)).rejects.toThrow(UnauthorizedException);
            await expect(authService.login(loginDto, mockRes)).rejects.toThrow('Incorrect email or password.');
        });

        it('should throw 429 when account is locked out', async () => {
            mockRedis.get.mockResolvedValue('5'); // MAX_LOGIN_ATTEMPTS reached

            await expect(authService.login(loginDto, mockRes)).rejects.toThrow(HttpException);
            await expect(authService.login(loginDto, mockRes)).rejects.toThrow('Too many failed login attempts. Please try again later.');
            // Should not even attempt to find user
            expect(mockPrismaService.user.findUnique).not.toHaveBeenCalled();
        });

        it('should increment login attempts on failed password', async () => {
            mockRedis.get.mockResolvedValue(null); // Not locked out
            mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
            (argon2.verify as Mock).mockResolvedValue(false);

            await expect(authService.login(loginDto, mockRes)).rejects.toThrow(UnauthorizedException);

            expect(mockRedis.pipeline).toHaveBeenCalled();
            expect(mockPipeline.incr).toHaveBeenCalledWith(`login_attempts:${loginDto.email}`);
            expect(mockPipeline.expire).toHaveBeenCalledWith(`login_attempts:${loginDto.email}`, 900);
        });

        it('should increment login attempts on user-not-found', async () => {
            mockRedis.get.mockResolvedValue(null);
            mockPrismaService.user.findUnique.mockResolvedValue(null);
            (argon2.verify as Mock).mockResolvedValue(false);

            await expect(authService.login(loginDto, mockRes)).rejects.toThrow(UnauthorizedException);

            expect(mockPipeline.incr).toHaveBeenCalledWith(`login_attempts:${loginDto.email}`);
        });

        it('should reset login attempts on successful login', async () => {
            mockRedis.get.mockResolvedValue('3'); // Some failed attempts but not locked
            mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
            (argon2.verify as Mock).mockResolvedValue(true);

            await authService.login(loginDto, mockRes);

            expect(mockRedis.del).toHaveBeenCalledWith(`login_attempts:${loginDto.email}`);
        });
    });

    describe('refresh', () => {
        it('should return new tokens for valid refresh token', async () => {
            mockSessionService.getSessionFromRefreshToken.mockResolvedValue({ userId: mockUser.id, uaHash: null });
            mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

            const result = await authService.refresh(refreshToken, mockRes);

            expect(mockSessionService.getSessionFromRefreshToken).toHaveBeenCalledWith(refreshToken);
            expect(mockSessionService.removeRefreshToken).toHaveBeenCalledWith(refreshToken);
            expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({ where: { id: mockUser.id } });
            expect(result.accessToken).toBe('mock-access-token');
            expect(mockRes.cookie as unknown as Mock).toHaveBeenCalledWith('refresh_token', expect.any(String), expect.objectContaining({ httpOnly: true }));
        });

        it('should store new token via SessionService after refresh', async () => {
            mockSessionService.getSessionFromRefreshToken.mockResolvedValue({ userId: mockUser.id, uaHash: null });
            mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

            await authService.refresh(refreshToken, mockRes);

            expect(mockSessionService.storeRefreshToken).toHaveBeenCalledWith(mockUser.id, expect.any(String), undefined);
        });

        it('should throw UnauthorizedException if refresh token is invalid', async () => {
            mockSessionService.getSessionFromRefreshToken.mockResolvedValue(null);

            await expect(authService.refresh(refreshToken, mockRes)).rejects.toThrow(UnauthorizedException);
            await expect(authService.refresh(refreshToken, mockRes)).rejects.toThrow('Invalid or expired session. Please sign in again.');
            expect(mockPrismaService.user.findUnique).not.toHaveBeenCalled();
        });

        it('should throw UnauthorizedException if user not found', async () => {
            mockSessionService.getSessionFromRefreshToken.mockResolvedValue({ userId: mockUser.id, uaHash: null });
            mockPrismaService.user.findUnique.mockResolvedValue(null);

            await expect(authService.refresh(refreshToken, mockRes)).rejects.toThrow(UnauthorizedException);
            await expect(authService.refresh(refreshToken, mockRes)).rejects.toThrow('Invalid or expired session. Please sign in again.');
        });

        it('should throw UnauthorizedException on device mismatch', async () => {
            mockSessionService.getSessionFromRefreshToken.mockResolvedValue({ userId: mockUser.id, uaHash: 'aaaa' });
            mockSessionService.hashUserAgent.mockReturnValue('bbbb');

            await expect(authService.refresh(refreshToken, mockRes, 'Firefox/115')).rejects.toThrow(UnauthorizedException);
            await expect(authService.refresh(refreshToken, mockRes, 'Firefox/115')).rejects.toThrow(
                'Session expired due to device change. Please sign in again.',
            );
            expect(mockSessionService.removeRefreshToken).toHaveBeenCalledWith(refreshToken);
        });

        it('should allow refresh when device matches', async () => {
            mockSessionService.getSessionFromRefreshToken.mockResolvedValue({ userId: mockUser.id, uaHash: 'aaaa' });
            mockSessionService.hashUserAgent.mockReturnValue('aaaa');
            mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

            const result = await authService.refresh(refreshToken, mockRes, 'Chrome/120');

            expect(result.accessToken).toBe('mock-access-token');
        });

        it('should skip device check for old tokens without uaHash', async () => {
            mockSessionService.getSessionFromRefreshToken.mockResolvedValue({ userId: mockUser.id, uaHash: null });
            mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

            const result = await authService.refresh(refreshToken, mockRes, 'Firefox/115');

            expect(result.accessToken).toBe('mock-access-token');
        });
    });

    describe('logout', () => {
        it('should remove refresh token and clear cookies', async () => {
            mockSessionService.removeRefreshToken.mockResolvedValue(mockUser.id);

            await authService.logout(refreshToken, mockRes);

            expect(mockSessionService.removeRefreshToken).toHaveBeenCalledWith(refreshToken);
            expect(mockRes.clearCookie as unknown as Mock).toHaveBeenCalledWith('refresh_token', { path: '/api/v1/auth' });
            expect(mockRes.clearCookie as unknown as Mock).toHaveBeenCalledWith('XSRF-TOKEN', { path: '/' });
        });

        it('should still clear cookies even if token was already gone', async () => {
            mockSessionService.removeRefreshToken.mockResolvedValue(null);

            await authService.logout(refreshToken, mockRes);

            expect(mockSessionService.removeRefreshToken).toHaveBeenCalledWith(refreshToken);
            expect(mockRes.clearCookie as unknown as Mock).toHaveBeenCalledWith('refresh_token', { path: '/api/v1/auth' });
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
        const token = 'a'.repeat(64); // valid 64-char hex string
        const newPassword = 'newPassword123';

        it('should reset password for valid token', async () => {
            mockRedis.get.mockResolvedValue(mockUser.id);
            mockSessionService.invalidateAllSessions.mockResolvedValue(0);
            mockPrismaService.user.update.mockResolvedValue(mockUser);
            (argon2.hash as Mock).mockResolvedValue('new-hashed-password');

            const result = await authService.resetPassword(token, newPassword);

            expect(mockRedis.get).toHaveBeenCalledWith(`reset:${token}`);
            expect(argon2.hash).toHaveBeenCalledWith(newPassword, expect.objectContaining({ memoryCost: expect.any(Number) }));
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

            await expect(authService.resetPassword(token, newPassword)).rejects.toThrow(UnauthorizedException);
            await expect(authService.resetPassword(token, newPassword)).rejects.toThrow('Invalid or expired reset token.');
            expect(mockPrismaService.user.update).not.toHaveBeenCalled();
        });

        it('should throw UnauthorizedException if token is expired', async () => {
            mockRedis.get.mockResolvedValue(null);

            await expect(authService.resetPassword(token, newPassword)).rejects.toThrow(UnauthorizedException);
            await expect(authService.resetPassword(token, newPassword)).rejects.toThrow('Invalid or expired reset token.');
        });

        it('should reject malformed reset token (too short)', async () => {
            await expect(authService.resetPassword('abc123', newPassword)).rejects.toThrow(UnauthorizedException);
            await expect(authService.resetPassword('abc123', newPassword)).rejects.toThrow('Invalid or expired reset token.');
            expect(mockRedis.get).not.toHaveBeenCalled();
        });

        it('should reject reset token with non-hex characters', async () => {
            const badToken = 'g'.repeat(64);
            await expect(authService.resetPassword(badToken, newPassword)).rejects.toThrow(UnauthorizedException);
            await expect(authService.resetPassword(badToken, newPassword)).rejects.toThrow('Invalid or expired reset token.');
            expect(mockRedis.get).not.toHaveBeenCalled();
        });

        it('should reject empty reset token', async () => {
            await expect(authService.resetPassword('', newPassword)).rejects.toThrow(UnauthorizedException);
            await expect(authService.resetPassword('', newPassword)).rejects.toThrow('Invalid or expired reset token.');
            expect(mockRedis.get).not.toHaveBeenCalled();
        });
    });
});
