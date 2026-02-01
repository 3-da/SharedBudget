import { applyDecorators, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthResponseDto, MessageResponseDto } from '../dto/auth-response.dto';
import { ErrorResponseDto } from '../../common/dto/error-response.dto';

export function RegisterEndpoint() {
    return applyDecorators(
        Post('register'),
        ApiOperation({
            summary: 'Register a new user',
            description: 'Creates a new user account and sends a verification code to the email address.',
        }),
        ApiResponse({ status: 201, description: 'Verification code sent to email.', type: MessageResponseDto }),
        ApiResponse({ status: 400, description: 'Validation error.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 3, ttl: 60000, blockDuration: 600000 } }),
    );
}

export function VerifyCodeEndpoint() {
    return applyDecorators(
        Post('verify-code'),
        ApiOperation({
            summary: 'Verify email with code',
            description: 'Verifies the email address using the 6-digit code sent during registration. Returns tokens on success (auto-login).',
        }),
        ApiResponse({ status: 200, description: 'Email verified, tokens returned.', type: AuthResponseDto }),
        ApiResponse({ status: 401, description: 'Invalid or expired verification code.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 5, ttl: 60000, blockDuration: 300000 } }),
        HttpCode(HttpStatus.OK),
    );
}

export function ResendCodeEndpoint() {
    return applyDecorators(
        Post('resend-code'),
        ApiOperation({
            summary: 'Resend verification code',
            description: 'Sends a new verification code to the email address. Rate limited to prevent abuse.',
        }),
        ApiResponse({ status: 200, description: 'New code sent (if account exists).', type: MessageResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 3, ttl: 600000 } }),
        HttpCode(HttpStatus.OK),
    );
}

export function LoginEndpoint() {
    return applyDecorators(
        Post('login'),
        ApiOperation({
            summary: 'Login with email and password',
            description: 'Authenticates a user and returns access and refresh tokens.',
        }),
        ApiResponse({ status: 200, description: 'Login successful.', type: AuthResponseDto }),
        ApiResponse({ status: 401, description: 'Invalid credentials.', type: ErrorResponseDto }),
        ApiResponse({ status: 403, description: 'Email not verified.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 5, ttl: 60000, blockDuration: 300000 } }),
        HttpCode(HttpStatus.OK),
    );
}

export function RefreshEndpoint() {
    return applyDecorators(
        Post('refresh'),
        ApiOperation({
            summary: 'Refresh access token',
            description: 'Exchanges a valid refresh token for new access and refresh tokens. Old refresh token is invalidated.',
        }),
        ApiResponse({ status: 200, description: 'Tokens refreshed.', type: AuthResponseDto }),
        ApiResponse({ status: 401, description: 'Invalid or expired refresh token.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 10, ttl: 60000 } }),
        HttpCode(HttpStatus.OK),
    );
}

export function LogoutEndpoint() {
    return applyDecorators(
        Post('logout'),
        ApiOperation({
            summary: 'Logout user',
            description: 'Invalidates the refresh token, effectively logging out the user.',
        }),
        ApiResponse({ status: 200, description: 'Logged out successfully.', type: MessageResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 10, ttl: 60000 } }),
        HttpCode(HttpStatus.OK),
    );
}

export function ForgotPasswordEndpoint() {
    return applyDecorators(
        Post('forgot-password'),
        ApiOperation({
            summary: 'Request password reset',
            description: 'Sends a password reset link to the email address if an account exists.',
        }),
        ApiResponse({ status: 200, description: 'Reset link sent (if account exists).', type: MessageResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 3, ttl: 600000 } }), // 3 requests per 10 minutes
        HttpCode(HttpStatus.OK),
    );
}

export function ResetPasswordEndpoint() {
    return applyDecorators(
        Post('reset-password'),
        ApiOperation({
            summary: 'Reset password with token',
            description: 'Resets the password using a valid reset token from email.',
        }),
        ApiResponse({ status: 200, description: 'Password reset successfully.', type: MessageResponseDto }),
        ApiResponse({ status: 401, description: 'Invalid or expired reset token.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 5, ttl: 60000, blockDuration: 300000 } }),
        HttpCode(HttpStatus.OK),
    );
}
