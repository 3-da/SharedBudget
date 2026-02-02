import { applyDecorators, Get, HttpCode, HttpStatus, Put } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UserProfileResponseDto } from '../dto/user-profile-response.dto';
import { Throttle } from '@nestjs/throttler';
import { ErrorResponseDto } from '../../common/dto/error-response.dto';
import { MessageResponseDto } from '../../common/dto/message-response.dto';

export function GetProfileEndpoint() {
    return applyDecorators(
        Get('me'),
        ApiOperation({
            summary: 'Get my profile',
            description: "Returns the authenticated user's profile information.",
        }),
        ApiResponse({ status: 200, description: 'Profile returned.', type: UserProfileResponseDto }),
        ApiResponse({ status: 401, description: 'Unauthorized.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 10, ttl: 60000 } }),
        HttpCode(HttpStatus.OK),
    );
}

export function UpdateProfileEndpoint() {
    return applyDecorators(
        Put('me'),
        ApiOperation({
            summary: 'Update my profile',
            description: "Updates the authenticated user's first name and last name.",
        }),
        ApiResponse({ status: 200, description: 'Profile updated.', type: UserProfileResponseDto }),
        ApiResponse({ status: 400, description: 'Validation error.', type: ErrorResponseDto }),
        ApiResponse({ status: 401, description: 'Unauthorized.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 5, ttl: 60000 } }),
        HttpCode(HttpStatus.OK),
    );
}

export function ChangePasswordEndpoint() {
    return applyDecorators(
        Put('me/password'),
        ApiOperation({
            summary: 'Change my password',
            description: "Changes the user's password. Requires current password. Invalidates all sessions.",
        }),
        ApiResponse({ status: 200, description: 'Password changed.', type: MessageResponseDto }),
        ApiResponse({ status: 400, description: 'Validation error.', type: ErrorResponseDto }),
        ApiResponse({ status: 401, description: 'Unauthorized or incorrect password.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 3, ttl: 60000 } }),
        HttpCode(HttpStatus.OK),
    );
}
