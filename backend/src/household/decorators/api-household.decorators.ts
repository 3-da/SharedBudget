/*
    JoinHouseholdEndpoint() — Post('join'), status 200, responses for 200/400/401/404/409/429
    GetMyHouseholdEndpoint() — Get('mine'), status 200, responses for 200/401/404/429
    RegenerateCodeEndpoint() — Post('regenerate-code'), status 200, responses for 200/401/403/429

 */

import { applyDecorators, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HouseholdResponseDto } from '../dto/household-response.dto';
import { Throttle } from '@nestjs/throttler';

export function CreateHouseholdEndpoint() {
    return applyDecorators(
        Post(),
        ApiOperation({
            summary: 'Create a new household',
            description: 'Creates a new household and assigns the current user as OWNER.',
        }),
        ApiResponse({ status: 201, description: 'Household created.', type: HouseholdResponseDto }),
        ApiResponse({ status: 400, description: 'Validation error.' }),
        ApiResponse({ status: 401, description: 'Unauthorized.' }),
        ApiResponse({ status: 409, description: 'User already belongs to a household.' }),
        ApiResponse({ status: 429, description: 'Too many requests.' }),
        Throttle({ default: { limit: 5, ttl: 60000 } }),
    );
}

export function JoinHouseholdEndpoint() {
    return applyDecorators(
        Post('join'),
        ApiOperation({
            summary: 'Join a household.',
            description: 'Joins an existing household using an invite code.',
        }),
        ApiResponse({ status: 200, description: 'Joined household.', type: HouseholdResponseDto }),
        ApiResponse({ status: 400, description: 'Validation error.' }),
        ApiResponse({ status: 401, description: 'Unauthorized.' }),
        ApiResponse({ status: 404, description: 'Household not found.' }),
        ApiResponse({ status: 409, description: 'User already in a household or household is full.' }),
        Throttle({ default: { limit: 5, ttl: 60000 } }),
        HttpCode(HttpStatus.OK),
    );
}

export function GetMyHouseholdEndpoint() {
    return applyDecorators(
        Get('mine'),
        ApiOperation({
            summary: 'Get my household.',
            description: "Returns the current user's household with all members.",
        }),
        ApiResponse({ status: 200, description: 'Household returned.', type: HouseholdResponseDto }),
        ApiResponse({ status: 401, description: 'Unauthorized.' }),
        ApiResponse({ status: 404, description: 'User has no household.' }),
        ApiResponse({ status: 429, description: 'Too many requests.' }),
        Throttle({ default: { limit: 10, ttl: 60000 } }),
    );
}

export function RegenerateCodeEndpoint() {
    return applyDecorators(
        Post('regenerate-code'),
        ApiOperation({
            summary: 'Regenerate invite code',
            description: 'Generates a new invite code for the household. Only the OWNER can do this.',
        }),
        ApiResponse({ status: 200, description: 'New invite code generated.', type: HouseholdResponseDto }),
        ApiResponse({ status: 401, description: 'Unauthorized.' }),
        ApiResponse({ status: 403, description: 'Only the owner can regenerate the code.' }),
        ApiResponse({ status: 429, description: 'Too many requests.' }),
        Throttle({ default: { limit: 5, ttl: 60000 } }),
        HttpCode(HttpStatus.OK),
    );
}
