// noinspection SqlNoDataSource
import { applyDecorators, Delete, Get, HttpCode, HttpStatus, Put } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
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
        Throttle({ default: { limit: 60, ttl: 60000 } }),
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
        Throttle({ default: { limit: 60, ttl: 60000 } }),
        HttpCode(HttpStatus.OK),
    );
}

export function DeleteOverrideEndpoint() {
    return applyDecorators(
        Delete(':id/override/:year/:month'),
        ApiOperation({
            summary: 'Delete a single override for a recurring expense',
            description: 'Removes the override for a specific month, resetting to the default amount.',
        }),
        ApiParam({ name: 'id', description: 'Expense ID' }),
        ApiParam({ name: 'year', description: 'Year', example: 2026 }),
        ApiParam({ name: 'month', description: 'Month (1-12)', example: 6 }),
        ApiResponse({ status: 200, description: 'Override removed.', type: MessageResponseDto }),
        ApiResponse({ status: 401, description: 'Unauthorized.', type: ErrorResponseDto }),
        ApiResponse({ status: 404, description: 'Expense not found.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 60, ttl: 60000 } }),
        HttpCode(HttpStatus.OK),
    );
}

export function DeleteAllOverridesEndpoint() {
    return applyDecorators(
        Delete(':id/overrides'),
        ApiOperation({
            summary: 'Delete all overrides for a recurring expense',
            description: 'Removes all per-month overrides, resetting to the default amount.',
        }),
        ApiResponse({ status: 200, description: 'Overrides deleted.', type: MessageResponseDto }),
        ApiResponse({ status: 401, description: 'Unauthorized.', type: ErrorResponseDto }),
        ApiResponse({ status: 404, description: 'Expense not found.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 60, ttl: 60000 } }),
        HttpCode(HttpStatus.OK),
    );
}

export function BatchUpsertOverridesEndpoint() {
    return applyDecorators(
        Put(':id/overrides/batch'),
        ApiOperation({
            summary: 'Batch create or update overrides for a recurring expense',
            description: 'Creates or updates multiple monthly overrides in a single atomic operation. Useful for applying changes to all upcoming months.',
        }),
        ApiParam({ name: 'id', description: 'Expense ID' }),
        ApiResponse({ status: 200, description: 'Overrides saved.', type: [RecurringOverrideResponseDto] }),
        ApiResponse({ status: 400, description: 'Expense is not recurring.', type: ErrorResponseDto }),
        ApiResponse({ status: 401, description: 'Unauthorized.', type: ErrorResponseDto }),
        ApiResponse({ status: 404, description: 'Expense not found or user not in a household.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 60, ttl: 60000 } }),
        HttpCode(HttpStatus.OK),
    );
}

// noinspection HtmlUnknownTarget
const deleteUpcomingDescription =
    'Removes overrides for a recurring expense starting from the specified month/year onwards. Useful for undoing "apply to all upcoming" changes.';

export function DeleteUpcomingOverridesEndpoint() {
    return applyDecorators(
        Delete(':id/overrides/upcoming/:year/:month'),
        ApiOperation({
            summary: 'Delete overrides starting at a specific month',
            description: 'Removes overrides for a recurring expense starting at the specified month and year.',
        }),
        ApiParam({ name: 'id', description: 'Expense ID' }),
        ApiParam({ name: 'year', description: 'Starting year (inclusive)', example: 2026 }),
        ApiParam({ name: 'month', description: 'Starting month (inclusive, 1-12)', example: 6 }),
        ApiResponse({ status: 200, description: 'Upcoming overrides deleted.', type: MessageResponseDto }),
        ApiResponse({ status: 401, description: 'Unauthorized.', type: ErrorResponseDto }),
        ApiResponse({ status: 404, description: 'Expense not found.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 60, ttl: 60000 } }),
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
        Throttle({ default: { limit: 60, ttl: 60000 } }),
        HttpCode(HttpStatus.OK),
    );
}
