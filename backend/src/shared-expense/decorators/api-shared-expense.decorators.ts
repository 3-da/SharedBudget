import { applyDecorators, Delete, Get, HttpCode, HttpStatus, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { SharedExpenseResponseDto } from '../dto/shared-expense-response.dto';
import { ApprovalResponseDto } from '../../aproval/dto/approval-response.dto';
import { ErrorResponseDto } from '../../common/dto/error-response.dto';

export function ListSharedExpensesEndpoint() {
    return applyDecorators(
        Get(),
        ApiOperation({
            summary: 'List household shared expenses',
            description: "Returns all shared expenses for the current user's household with optional filters.",
        }),
        ApiResponse({ status: 200, description: 'Expenses returned.', type: [SharedExpenseResponseDto] }),
        ApiResponse({ status: 401, description: 'Unauthorized.', type: ErrorResponseDto }),
        ApiResponse({ status: 404, description: 'User not in a household.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 10, ttl: 60000 } }),
        HttpCode(HttpStatus.OK),
    );
}

export function GetSharedExpenseEndpoint() {
    return applyDecorators(
        Get(':id'),
        ApiOperation({
            summary: 'Get a shared expense by ID',
            description: 'Returns a shared expense. Accessible by any household member.',
        }),
        ApiResponse({ status: 200, description: 'Expense returned.', type: SharedExpenseResponseDto }),
        ApiResponse({ status: 401, description: 'Unauthorized.', type: ErrorResponseDto }),
        ApiResponse({ status: 404, description: 'Expense not found.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 10, ttl: 60000 } }),
        HttpCode(HttpStatus.OK),
    );
}

export function ProposeCreateSharedExpenseEndpoint() {
    return applyDecorators(
        Post(),
        ApiOperation({
            summary: 'Propose a new shared expense',
            description: 'Creates an approval request for a new shared expense. The expense is NOT active until approved.',
        }),
        ApiResponse({ status: 201, description: 'Approval created.', type: ApprovalResponseDto }),
        ApiResponse({ status: 400, description: 'Validation error.', type: ErrorResponseDto }),
        ApiResponse({ status: 401, description: 'Unauthorized.', type: ErrorResponseDto }),
        ApiResponse({ status: 404, description: 'User not in a household.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 5, ttl: 60000 } }),
        HttpCode(HttpStatus.CREATED),
    );
}

export function ProposeUpdateSharedExpenseEndpoint() {
    return applyDecorators(
        Put(':id'),
        ApiOperation({
            summary: 'Propose an edit to a shared expense',
            description: 'Creates an approval request to modify a shared expense. Changes are NOT applied until approved.',
        }),
        ApiResponse({ status: 201, description: 'Approval created.', type: ApprovalResponseDto }),
        ApiResponse({ status: 400, description: 'Validation error.', type: ErrorResponseDto }),
        ApiResponse({ status: 401, description: 'Unauthorized.', type: ErrorResponseDto }),
        ApiResponse({ status: 404, description: 'Expense not found.', type: ErrorResponseDto }),
        ApiResponse({ status: 409, description: 'Pending approval already exists.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 5, ttl: 60000 } }),
        HttpCode(HttpStatus.CREATED),
    );
}

export function ProposeDeleteSharedExpenseEndpoint() {
    return applyDecorators(
        Delete(':id'),
        ApiOperation({
            summary: 'Propose deletion of a shared expense',
            description: 'Creates an approval request to delete a shared expense. The expense is NOT removed until approved.',
        }),
        ApiResponse({ status: 201, description: 'Approval created.', type: ApprovalResponseDto }),
        ApiResponse({ status: 401, description: 'Unauthorized.', type: ErrorResponseDto }),
        ApiResponse({ status: 404, description: 'Expense not found.', type: ErrorResponseDto }),
        ApiResponse({ status: 409, description: 'Pending approval already exists.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 5, ttl: 60000 } }),
        HttpCode(HttpStatus.CREATED),
    );
}
