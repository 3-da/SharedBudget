import { applyDecorators, Delete, Get, HttpCode, HttpStatus, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PersonalExpenseResponseDto } from '../dto/personal-expense-response.dto';
import { ErrorResponseDto } from '../../common/dto/error-response.dto';
import { MessageResponseDto } from '../../common/dto/message-response.dto';

export function ListPersonalExpensesEndpoint() {
    return applyDecorators(
        Get(),
        ApiOperation({
            summary: 'List my personal expenses',
            description: "Returns the current user's personal expenses with optional filters.",
        }),
        ApiResponse({ status: 200, description: 'Expenses returned.', type: [PersonalExpenseResponseDto] }),
        ApiResponse({ status: 401, description: 'Unauthorized.', type: ErrorResponseDto }),
        ApiResponse({ status: 404, description: 'User not in a household.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 30, ttl: 60000 } }),
        HttpCode(HttpStatus.OK),
    );
}

export function CreatePersonalExpenseEndpoint() {
    return applyDecorators(
        Post(),
        ApiOperation({
            summary: 'Create a personal expense',
            description: 'Creates a new personal expense for the current user.',
        }),
        ApiResponse({ status: 201, description: 'Expense created.', type: PersonalExpenseResponseDto }),
        ApiResponse({ status: 400, description: 'Validation error.', type: ErrorResponseDto }),
        ApiResponse({ status: 401, description: 'Unauthorized.', type: ErrorResponseDto }),
        ApiResponse({ status: 404, description: 'User not in a household.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 5, ttl: 60000 } }),
        HttpCode(HttpStatus.CREATED),
    );
}

export function GetPersonalExpenseEndpoint() {
    return applyDecorators(
        Get(':id'),
        ApiOperation({
            summary: 'Get a personal expense by ID',
            description: 'Returns a personal expense. Accessible by creator and household members.',
        }),
        ApiResponse({ status: 200, description: 'Expense returned.', type: PersonalExpenseResponseDto }),
        ApiResponse({ status: 401, description: 'Unauthorized.', type: ErrorResponseDto }),
        ApiResponse({ status: 404, description: 'Expense not found.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 30, ttl: 60000 } }),
        HttpCode(HttpStatus.OK),
    );
}

export function UpdatePersonalExpenseEndpoint() {
    return applyDecorators(
        Put(':id'),
        ApiOperation({
            summary: 'Update a personal expense',
            description: 'Updates a personal expense. Only the creator can modify it.',
        }),
        ApiResponse({ status: 200, description: 'Expense updated.', type: PersonalExpenseResponseDto }),
        ApiResponse({ status: 400, description: 'Validation error.', type: ErrorResponseDto }),
        ApiResponse({ status: 401, description: 'Unauthorized.', type: ErrorResponseDto }),
        ApiResponse({ status: 403, description: 'Not the expense owner.', type: ErrorResponseDto }),
        ApiResponse({ status: 404, description: 'Expense not found.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 5, ttl: 60000 } }),
        HttpCode(HttpStatus.OK),
    );
}

export function GetPersonalSkipStatusesEndpoint() {
    return applyDecorators(
        Get('skip-statuses'),
        ApiOperation({
            summary: 'Get skip statuses for personal expenses',
            description: 'Returns IDs of personal recurring expenses skipped for the given month/year.',
        }),
        ApiResponse({ status: 200, description: 'Skipped expense IDs.', schema: { type: 'array', items: { type: 'string', format: 'uuid' } } }),
        ApiResponse({ status: 401, description: 'Unauthorized.', type: ErrorResponseDto }),
        ApiResponse({ status: 404, description: 'User not in a household.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 30, ttl: 60000 } }),
        HttpCode(HttpStatus.OK),
    );
}

export function DeletePersonalExpenseEndpoint() {
    return applyDecorators(
        Delete(':id'),
        ApiOperation({
            summary: 'Delete a personal expense',
            description: 'Soft-deletes a personal expense. Only the creator can delete it.',
        }),
        ApiResponse({ status: 200, description: 'Expense deleted.', type: MessageResponseDto }),
        ApiResponse({ status: 401, description: 'Unauthorized.', type: ErrorResponseDto }),
        ApiResponse({ status: 403, description: 'Not the expense owner.', type: ErrorResponseDto }),
        ApiResponse({ status: 404, description: 'Expense not found.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 5, ttl: 60000 } }),
        HttpCode(HttpStatus.OK),
    );
}
