import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyCodeDto } from './dto/verify-code.dto';
import { ResendCodeDto } from './dto/resend-code.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Request, Response } from 'express';

describe('AuthController', () => {
    let controller: AuthController;
    let authService: AuthService;

    const mockAuthResponse: AuthResponseDto = {
        accessToken: 'mock-access-token',
        user: {
            id: 'user-123',
            email: 'test@example.com',
            firstName: 'John',
            lastName: 'Doe',
        },
    };

    const mockAuthService = {
        register: vi.fn(() => Promise.resolve({ message: "We've sent a verification code to your email." })),
        verifyCode: vi.fn(() => Promise.resolve(mockAuthResponse)),
        resendCode: vi.fn(() => Promise.resolve({ message: "If an account exists, we've sent a new code." })),
        login: vi.fn(() => Promise.resolve(mockAuthResponse)),
        refresh: vi.fn(() => Promise.resolve(mockAuthResponse)),
        logout: vi.fn(() => Promise.resolve()),
        forgotPassword: vi.fn(() => Promise.resolve({ message: "If an account exists, we've sent a password reset link." })),
        resetPassword: vi.fn(() => Promise.resolve({ message: 'Password reset successfully. You can now log in with your new password.' })),
    };

    const mockRes = {
        cookie: vi.fn(),
        clearCookie: vi.fn(),
    } as unknown as Response;

    const mockReqWithCookie = {
        cookies: { refresh_token: 'mock-refresh-token' },
    } as unknown as Request;

    const mockReqWithoutCookie = {
        cookies: {},
    } as unknown as Request;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [AuthController],
            providers: [{ provide: AuthService, useValue: mockAuthService }],
        }).compile();

        controller = module.get<AuthController>(AuthController);
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

        it('should call authService.register and return message', async () => {
            const result = await controller.register(registerDto);

            expect(authService.register).toHaveBeenCalledWith(registerDto);
            expect(authService.register).toHaveBeenCalledTimes(1);
            expect(result.message).toBe("We've sent a verification code to your email.");
        });
    });

    describe('verifyCode', () => {
        const verifyCodeDto: VerifyCodeDto = { email: 'test@example.com', code: '123456' };

        it('should call authService.verifyCode with response and return tokens', async () => {
            const result = await controller.verifyCode(verifyCodeDto, mockRes);

            expect(authService.verifyCode).toHaveBeenCalledWith(verifyCodeDto.email, verifyCodeDto.code, mockRes, undefined);
            expect(authService.verifyCode).toHaveBeenCalledTimes(1);
            expect(result).toEqual(mockAuthResponse);
        });
    });

    describe('resendCode', () => {
        const resendCodeDto: ResendCodeDto = { email: 'test@example.com' };

        it('should call authService.resendCode and return message', async () => {
            const result = await controller.resendCode(resendCodeDto);

            expect(authService.resendCode).toHaveBeenCalledWith(resendCodeDto.email);
            expect(authService.resendCode).toHaveBeenCalledTimes(1);
            expect(result.message).toBe("If an account exists, we've sent a new code.");
        });
    });

    describe('login', () => {
        const loginDto: LoginDto = { email: 'test@example.com', password: 'password123' };

        it('should call authService.login with response and return tokens', async () => {
            const result = await controller.login(loginDto, mockRes);

            expect(authService.login).toHaveBeenCalledWith(loginDto, mockRes, undefined);
            expect(authService.login).toHaveBeenCalledTimes(1);
            expect(result).toEqual(mockAuthResponse);
        });
    });

    describe('refresh', () => {
        it('should read refresh token from cookie and call authService.refresh', async () => {
            const result = await controller.refresh(mockReqWithCookie, mockRes);

            expect(authService.refresh).toHaveBeenCalledWith('mock-refresh-token', mockRes, undefined);
            expect(authService.refresh).toHaveBeenCalledTimes(1);
            expect(result).toEqual(mockAuthResponse);
        });

        it('should throw UnauthorizedException when no refresh token cookie', async () => {
            await expect(controller.refresh(mockReqWithoutCookie, mockRes)).rejects.toThrow(UnauthorizedException);
            await expect(controller.refresh(mockReqWithoutCookie, mockRes)).rejects.toThrow('No refresh token provided.');
        });
    });

    describe('logout', () => {
        it('should read refresh token from cookie and call authService.logout', async () => {
            const result = await controller.logout(mockReqWithCookie, mockRes);

            expect(authService.logout).toHaveBeenCalledWith('mock-refresh-token', mockRes);
            expect(authService.logout).toHaveBeenCalledTimes(1);
            expect(result).toEqual({ message: 'Logged out successfully.' });
        });

        it('should pass empty string when no refresh token cookie', async () => {
            const result = await controller.logout(mockReqWithoutCookie, mockRes);

            expect(authService.logout).toHaveBeenCalledWith('', mockRes);
            expect(result).toEqual({ message: 'Logged out successfully.' });
        });
    });

    describe('forgotPassword', () => {
        const forgotPasswordDto: ForgotPasswordDto = { email: 'test@example.com' };

        it('should call authService.forgotPassword and return message', async () => {
            const result = await controller.forgotPassword(forgotPasswordDto);

            expect(authService.forgotPassword).toHaveBeenCalledWith(forgotPasswordDto.email);
            expect(authService.forgotPassword).toHaveBeenCalledTimes(1);
            expect(result.message).toBe("If an account exists, we've sent a password reset link.");
        });
    });

    describe('resetPassword', () => {
        const resetPasswordDto: ResetPasswordDto = { token: 'valid-reset-token', newPassword: 'newPassword123' };

        it('should call authService.resetPassword and return message', async () => {
            const result = await controller.resetPassword(resetPasswordDto);

            expect(authService.resetPassword).toHaveBeenCalledWith(resetPasswordDto.token, resetPasswordDto.newPassword);
            expect(authService.resetPassword).toHaveBeenCalledTimes(1);
            expect(result.message).toBe('Password reset successfully. You can now log in with your new password.');
        });
    });
});
