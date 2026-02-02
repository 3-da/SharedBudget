import { applyDecorators, Get, HttpCode, HttpStatus, Put } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { SalaryResponseDto } from '../dto/salary-response.dto';
import { ErrorResponseDto } from '../../common/dto/error-response.dto';

export function GetMySalaryEndpoint() {
    return applyDecorators(
        Get('me'),
        ApiOperation({
            summary: 'Get my salary for current month',
            description: "Returns the current user's salary record for the current month.",
        }),
        ApiResponse({ status: 200, description: 'Salary returned.', type: SalaryResponseDto }),
        ApiResponse({ status: 401, description: 'Unauthorized.', type: ErrorResponseDto }),
        ApiResponse({ status: 404, description: 'No salary set for current month.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 10, ttl: 60000 } }),
        HttpCode(HttpStatus.OK),
    );
}

export function UpsertMySalaryEndpoint() {
    return applyDecorators(
        Put('me'),
        ApiOperation({
            summary: 'Create or update my salary for current month',
            description: 'Sets or updates the salary record for the current month. Month and year are determined automatically.',
        }),
        ApiResponse({ status: 200, description: 'Salary upserted.', type: SalaryResponseDto }),
        ApiResponse({ status: 400, description: 'Validation error.', type: ErrorResponseDto }),
        ApiResponse({ status: 401, description: 'Unauthorized.', type: ErrorResponseDto }),
        ApiResponse({ status: 404, description: 'User not in a household.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 5, ttl: 60000 } }),
        HttpCode(HttpStatus.OK),
    );
}

export function GetHouseholdSalariesEndpoint() {
    return applyDecorators(
        Get('household'),
        ApiOperation({
            summary: 'Get household salaries for current month',
            description: "Returns all members' salaries for the current month in the user's household.",
        }),
        ApiResponse({ status: 200, description: 'Salaries returned.', type: [SalaryResponseDto] }),
        ApiResponse({ status: 401, description: 'Unauthorized.', type: ErrorResponseDto }),
        ApiResponse({ status: 404, description: 'User not in a household.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 10, ttl: 60000 } }),
        HttpCode(HttpStatus.OK),
    );
}

export function GetHouseholdSalariesByMonthEndpoint() {
    return applyDecorators(
        Get('household/:year/:month'),
        ApiOperation({
            summary: 'Get household salaries for a specific month',
            description: "Returns all members' salaries for a given month/year in the user's household.",
        }),
        ApiResponse({ status: 200, description: 'Salaries returned.', type: [SalaryResponseDto] }),
        ApiResponse({ status: 401, description: 'Unauthorized.', type: ErrorResponseDto }),
        ApiResponse({ status: 404, description: 'User not in a household.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 10, ttl: 60000 } }),
        HttpCode(HttpStatus.OK),
    );
}
