import { applyDecorators, Delete, Get, HttpCode, HttpStatus, Patch, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { SharedExpenseResponseDto } from '../dto/shared-expense-response.dto';
import { ApprovalResponseDto } from '../../approval/dto/approval-response.dto';
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
        Throttle({ default: { limit: 30, ttl: 60000 } }),
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
        Throttle({ default: { limit: 30, ttl: 60000 } }),
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

export function GetSharedSkipStatusesEndpoint() {
    return applyDecorators(
        Get('skip-statuses'),
        ApiOperation({
            summary: 'Get skip statuses for shared expenses',
            description: 'Returns IDs of shared recurring expenses skipped for the given month/year.',
        }),
        ApiResponse({ status: 200, description: 'Skipped expense IDs.', schema: { type: 'array', items: { type: 'string', format: 'uuid' } } }),
        ApiResponse({ status: 401, description: 'Unauthorized.', type: ErrorResponseDto }),
        ApiResponse({ status: 404, description: 'User not in a household.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 30, ttl: 60000 } }),
        HttpCode(HttpStatus.OK),
    );
}

export function ProposeSkipSharedExpenseEndpoint() {
    return applyDecorators(
        Patch(':id/skip'),
        ApiOperation({
            summary: 'Propose skipping a shared expense for a month',
            description: 'Creates an approval request to skip a recurring shared expense for the specified month. The skip is NOT applied until approved by another member.',
        }),
        ApiResponse({ status: 201, description: 'Skip approval created.', type: ApprovalResponseDto }),
        ApiResponse({ status: 400, description: 'Expense is not recurring.', type: ErrorResponseDto }),
        ApiResponse({ status: 401, description: 'Unauthorized.', type: ErrorResponseDto }),
        ApiResponse({ status: 404, description: 'Expense not found.', type: ErrorResponseDto }),
        ApiResponse({ status: 409, description: 'Pending approval already exists.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 5, ttl: 60000 } }),
        HttpCode(HttpStatus.CREATED),
    );
}

export function ProposeUnskipSharedExpenseEndpoint() {
    return applyDecorators(
        Patch(':id/unskip'),
        ApiOperation({
            summary: 'Propose un-skipping a shared expense for a month',
            description: 'Creates an approval request to revert a previously skipped recurring shared expense for the specified month.',
        }),
        ApiResponse({ status: 201, description: 'Unskip approval created.', type: ApprovalResponseDto }),
        ApiResponse({ status: 400, description: 'Expense is not recurring or not currently skipped.', type: ErrorResponseDto }),
        ApiResponse({ status: 401, description: 'Unauthorized.', type: ErrorResponseDto }),
        ApiResponse({ status: 404, description: 'Expense not found.', type: ErrorResponseDto }),
        ApiResponse({ status: 409, description: 'Pending approval already exists.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 5, ttl: 60000 } }),
        HttpCode(HttpStatus.CREATED),
    );
}
