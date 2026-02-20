import { applyDecorators, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Get, Post } from '@nestjs/common';
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

export function AddPersonalSavingEndpoint() {
    return applyDecorators(
        Post('personal/add'),
        ApiOperation({
            summary: 'Add to personal savings',
            description: 'Adds the specified amount to personal savings for the given (or current) month. Creates a new record if none exists.',
        }),
        ApiResponse({ status: 201, description: 'Amount added to personal savings.', type: SavingResponseDto }),
        ApiResponse({ status: 401, description: 'Unauthorized.', type: ErrorResponseDto }),
        ApiResponse({ status: 404, description: 'User not in a household.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 30, ttl: 60000 } }),
    );
}

export function WithdrawPersonalSavingEndpoint() {
    return applyDecorators(
        Post('personal/withdraw'),
        ApiOperation({
            summary: 'Withdraw from personal savings',
            description: 'Withdraws the specified amount from personal savings. Fails if amount exceeds current savings.',
        }),
        ApiResponse({ status: 200, description: 'Amount withdrawn from personal savings.', type: SavingResponseDto }),
        ApiResponse({ status: 400, description: 'Withdrawal amount exceeds current savings.', type: ErrorResponseDto }),
        ApiResponse({ status: 401, description: 'Unauthorized.', type: ErrorResponseDto }),
        ApiResponse({ status: 404, description: 'User not in a household or no savings found.', type: ErrorResponseDto }),
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

export function AddSharedSavingEndpoint() {
    return applyDecorators(
        Post('shared/add'),
        ApiOperation({
            summary: 'Add to shared savings',
            description: 'Adds the specified amount to shared household savings for the given (or current) month.',
        }),
        ApiResponse({ status: 201, description: 'Amount added to shared savings.', type: SavingResponseDto }),
        ApiResponse({ status: 401, description: 'Unauthorized.', type: ErrorResponseDto }),
        ApiResponse({ status: 404, description: 'User not in a household.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 30, ttl: 60000 } }),
    );
}

export function RequestSharedWithdrawalEndpoint() {
    return applyDecorators(
        Post('shared/withdraw'),
        ApiOperation({
            summary: 'Request shared savings withdrawal',
            description: 'Creates an approval request to withdraw from shared savings. Another household member must approve before the withdrawal is executed.',
        }),
        ApiResponse({ status: 201, description: 'Withdrawal request submitted for approval.' }),
        ApiResponse({ status: 400, description: 'Withdrawal amount exceeds current shared savings.', type: ErrorResponseDto }),
        ApiResponse({ status: 401, description: 'Unauthorized.', type: ErrorResponseDto }),
        ApiResponse({ status: 404, description: 'User not in a household or no shared savings found.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 10, ttl: 60000 } }),
    );
}
