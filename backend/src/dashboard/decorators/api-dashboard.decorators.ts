import { applyDecorators, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { DashboardResponseDto } from '../dto/dashboard-response.dto';
import { SavingsResponseDto } from '../dto/member-savings.dto';
import { SettlementResponseDto } from '../dto/settlement-response.dto';
import { MarkSettlementPaidResponseDto } from '../dto/mark-settlement-paid-response.dto';
import { ErrorResponseDto } from '../../common/dto/error-response.dto';

export function GetDashboardEndpoint() {
    return applyDecorators(
        Get(),
        ApiOperation({
            summary: 'Get complete household financial overview',
            description: 'Returns a comprehensive dashboard with income, expenses, savings, settlement, and pending approvals for the current month.',
        }),
        ApiResponse({ status: 200, description: 'Dashboard overview returned.', type: DashboardResponseDto }),
        ApiResponse({ status: 401, description: 'Unauthorized.', type: ErrorResponseDto }),
        ApiResponse({ status: 404, description: 'User not in a household.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 30, ttl: 60000 } }),
        HttpCode(HttpStatus.OK),
    );
}

export function GetSavingsEndpoint() {
    return applyDecorators(
        Get('savings'),
        ApiOperation({
            summary: 'Get savings breakdown per member',
            description: 'Returns default and current savings for each household member, plus combined household totals.',
        }),
        ApiResponse({ status: 200, description: 'Savings breakdown returned.', type: SavingsResponseDto }),
        ApiResponse({ status: 401, description: 'Unauthorized.', type: ErrorResponseDto }),
        ApiResponse({ status: 404, description: 'User not in a household.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 30, ttl: 60000 } }),
        HttpCode(HttpStatus.OK),
    );
}

export function GetSettlementEndpoint() {
    return applyDecorators(
        Get('settlement'),
        ApiOperation({
            summary: 'Get current settlement calculation',
            description: 'Calculates who owes whom based on shared expenses. Returns the net amount, direction, and a human-readable message.',
        }),
        ApiResponse({ status: 200, description: 'Settlement calculation returned.', type: SettlementResponseDto }),
        ApiResponse({ status: 401, description: 'Unauthorized.', type: ErrorResponseDto }),
        ApiResponse({ status: 404, description: 'User not in a household.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 30, ttl: 60000 } }),
        HttpCode(HttpStatus.OK),
    );
}

export function MarkSettlementPaidEndpoint() {
    return applyDecorators(
        Post('settlement/mark-paid'),
        ApiOperation({
            summary: "Mark current month's settlement as paid",
            description: "Records that the current month's settlement has been paid. Creates an audit trail for financial tracking.",
        }),
        ApiResponse({ status: 200, description: 'Settlement marked as paid.', type: MarkSettlementPaidResponseDto }),
        ApiResponse({ status: 400, description: 'No settlement needed or already settled.', type: ErrorResponseDto }),
        ApiResponse({ status: 401, description: 'Unauthorized.', type: ErrorResponseDto }),
        ApiResponse({ status: 404, description: 'User not in a household.', type: ErrorResponseDto }),
        ApiResponse({ status: 409, description: 'Settlement already marked as paid this month.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 5, ttl: 60000 } }),
        HttpCode(HttpStatus.OK),
    );
}
