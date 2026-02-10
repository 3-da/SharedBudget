import { applyDecorators, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Get, Put } from '@nestjs/common';
import { ErrorResponseDto } from '../../common/dto/error-response.dto';
import { SavingResponseDto } from '../dto/saving-response.dto';

export function GetMySavingsEndpoint() {
    return applyDecorators(
        Get('me'),
        ApiOperation({
            summary: 'Get my savings',
            description: "Returns the authenticated user's personal and shared savings for the current month.",
        }),
        ApiResponse({ status: 200, description: 'Savings returned.', type: [SavingResponseDto] }),
        ApiResponse({ status: 401, description: 'Unauthorized.', type: ErrorResponseDto }),
        ApiResponse({ status: 404, description: 'User not in a household.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 30, ttl: 60000 } }),
        HttpCode(HttpStatus.OK),
    );
}

export function UpsertPersonalSavingEndpoint() {
    return applyDecorators(
        Put('me'),
        ApiOperation({
            summary: 'Upsert personal savings',
            description: 'Creates or updates the personal savings amount for the specified (or current) month.',
        }),
        ApiResponse({ status: 200, description: 'Personal savings saved.', type: SavingResponseDto }),
        ApiResponse({ status: 401, description: 'Unauthorized.', type: ErrorResponseDto }),
        ApiResponse({ status: 404, description: 'User not in a household.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 30, ttl: 60000 } }),
        HttpCode(HttpStatus.OK),
    );
}

export function GetHouseholdSavingsEndpoint() {
    return applyDecorators(
        Get('household'),
        ApiOperation({
            summary: 'Get household savings',
            description: 'Returns all savings for the household for the current month (personal + shared for all members).',
        }),
        ApiResponse({ status: 200, description: 'Household savings returned.', type: [SavingResponseDto] }),
        ApiResponse({ status: 401, description: 'Unauthorized.', type: ErrorResponseDto }),
        ApiResponse({ status: 404, description: 'User not in a household.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 30, ttl: 60000 } }),
        HttpCode(HttpStatus.OK),
    );
}

export function UpsertSharedSavingEndpoint() {
    return applyDecorators(
        Put('shared'),
        ApiOperation({
            summary: 'Upsert shared savings',
            description: 'Creates or updates the shared savings amount for the specified (or current) month.',
        }),
        ApiResponse({ status: 200, description: 'Shared savings saved.', type: SavingResponseDto }),
        ApiResponse({ status: 401, description: 'Unauthorized.', type: ErrorResponseDto }),
        ApiResponse({ status: 404, description: 'User not in a household.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 30, ttl: 60000 } }),
        HttpCode(HttpStatus.OK),
    );
}
