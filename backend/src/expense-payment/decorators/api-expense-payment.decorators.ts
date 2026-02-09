import { applyDecorators, HttpCode, HttpStatus, Get, Put } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ErrorResponseDto } from '../../common/dto/error-response.dto';
import { ExpensePaymentResponseDto } from '../dto/expense-payment-response.dto';

export function MarkPaidEndpoint() {
    return applyDecorators(
        Put(':id/mark-paid'),
        ApiOperation({
            summary: 'Mark expense as paid',
            description: 'Marks an expense as paid for the specified month and year. Creates or updates the payment status record.',
        }),
        ApiResponse({ status: 200, description: 'Expense marked as paid.', type: ExpensePaymentResponseDto }),
        ApiResponse({ status: 400, description: 'Validation error.', type: ErrorResponseDto }),
        ApiResponse({ status: 401, description: 'Unauthorized.', type: ErrorResponseDto }),
        ApiResponse({ status: 404, description: 'Expense not found or user not in a household.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 10, ttl: 60000 } }),
        HttpCode(HttpStatus.OK),
    );
}

export function UndoPaidEndpoint() {
    return applyDecorators(
        Put(':id/undo-paid'),
        ApiOperation({
            summary: 'Undo paid status',
            description: 'Sets the payment status back to PENDING for the specified month and year.',
        }),
        ApiResponse({ status: 200, description: 'Payment status reset to pending.', type: ExpensePaymentResponseDto }),
        ApiResponse({ status: 400, description: 'Validation error.', type: ErrorResponseDto }),
        ApiResponse({ status: 401, description: 'Unauthorized.', type: ErrorResponseDto }),
        ApiResponse({ status: 404, description: 'Expense or payment status not found.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 10, ttl: 60000 } }),
        HttpCode(HttpStatus.OK),
    );
}

export function CancelExpenseEndpoint() {
    return applyDecorators(
        Put(':id/cancel'),
        ApiOperation({
            summary: 'Cancel expense for a month',
            description: 'Cancels an expense for the specified month, removing it from budget calculations.',
        }),
        ApiResponse({ status: 200, description: 'Expense cancelled for the month.', type: ExpensePaymentResponseDto }),
        ApiResponse({ status: 400, description: 'Validation error.', type: ErrorResponseDto }),
        ApiResponse({ status: 401, description: 'Unauthorized.', type: ErrorResponseDto }),
        ApiResponse({ status: 404, description: 'Expense not found or user not in a household.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 10, ttl: 60000 } }),
        HttpCode(HttpStatus.OK),
    );
}

export function GetPaymentStatusEndpoint() {
    return applyDecorators(
        Get(':id/payment-status'),
        ApiOperation({
            summary: 'Get payment statuses for an expense',
            description: 'Returns all payment status records for the specified expense, ordered by year and month descending.',
        }),
        ApiResponse({ status: 200, description: 'Payment statuses returned.', type: [ExpensePaymentResponseDto] }),
        ApiResponse({ status: 401, description: 'Unauthorized.', type: ErrorResponseDto }),
        ApiResponse({ status: 404, description: 'Expense not found or user not in a household.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 10, ttl: 60000 } }),
        HttpCode(HttpStatus.OK),
    );
}
