import { applyDecorators, HttpCode, HttpStatus, Get, Put } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ErrorResponseDto } from '../../common/dto/error-response.dto';
import { RecurringOverrideResponseDto } from '../dto/recurring-override-response.dto';
import { MessageResponseDto } from '../../common/dto/message-response.dto';

export function UpsertOverrideEndpoint() {
    return applyDecorators(
        Put(':id/override/:year/:month'),
        ApiOperation({
            summary: 'Override recurring expense amount for a month',
            description: 'Creates or updates an override for a recurring expense for a specific month. Can also skip the expense.',
        }),
        ApiParam({ name: 'id', description: 'Expense ID' }),
        ApiParam({ name: 'year', description: 'Year', example: 2026 }),
        ApiParam({ name: 'month', description: 'Month (1-12)', example: 6 }),
        ApiResponse({ status: 200, description: 'Override saved.', type: RecurringOverrideResponseDto }),
        ApiResponse({ status: 400, description: 'Expense is not recurring.', type: ErrorResponseDto }),
        ApiResponse({ status: 401, description: 'Unauthorized.', type: ErrorResponseDto }),
        ApiResponse({ status: 404, description: 'Expense not found or user not in a household.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 10, ttl: 60000 } }),
        HttpCode(HttpStatus.OK),
    );
}

export function UpdateDefaultAmountEndpoint() {
    return applyDecorators(
        Put(':id/default-amount'),
        ApiOperation({
            summary: 'Update default amount for a recurring expense',
            description: 'Updates the base amount of the expense, affecting all future months without overrides.',
        }),
        ApiResponse({ status: 200, description: 'Default amount updated.', type: MessageResponseDto }),
        ApiResponse({ status: 400, description: 'Expense is not recurring.', type: ErrorResponseDto }),
        ApiResponse({ status: 401, description: 'Unauthorized.', type: ErrorResponseDto }),
        ApiResponse({ status: 404, description: 'Expense not found.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 10, ttl: 60000 } }),
        HttpCode(HttpStatus.OK),
    );
}

export function ListOverridesEndpoint() {
    return applyDecorators(
        Get(':id/overrides'),
        ApiOperation({
            summary: 'List overrides for a recurring expense',
            description: 'Returns all per-month overrides for the specified expense.',
        }),
        ApiResponse({ status: 200, description: 'Overrides returned.', type: [RecurringOverrideResponseDto] }),
        ApiResponse({ status: 401, description: 'Unauthorized.', type: ErrorResponseDto }),
        ApiResponse({ status: 404, description: 'Expense not found.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 10, ttl: 60000 } }),
        HttpCode(HttpStatus.OK),
    );
}
