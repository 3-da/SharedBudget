import { applyDecorators, Get, HttpCode, HttpStatus, Put } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ApprovalResponseDto } from '../dto/approval-response.dto';
import { ErrorResponseDto } from '../../common/dto/error-response.dto';

export function ListPendingApprovalsEndpoint() {
    return applyDecorators(
        Get(),
        ApiOperation({
            summary: 'List pending approvals',
            description: "Returns all pending approvals for the current user's household.",
        }),
        ApiResponse({ status: 200, description: 'Pending approvals returned.', type: [ApprovalResponseDto] }),
        ApiResponse({ status: 401, description: 'Unauthorized.', type: ErrorResponseDto }),
        ApiResponse({ status: 404, description: 'User not in a household.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 30, ttl: 60000 } }),
        HttpCode(HttpStatus.OK),
    );
}

export function ListApprovalHistoryEndpoint() {
    return applyDecorators(
        Get('history'),
        ApiOperation({
            summary: 'List approval history',
            description: 'Returns past approvals (accepted/rejected) with optional status filter.',
        }),
        ApiResponse({ status: 200, description: 'Approval history returned.', type: [ApprovalResponseDto] }),
        ApiResponse({ status: 401, description: 'Unauthorized.', type: ErrorResponseDto }),
        ApiResponse({ status: 404, description: 'User not in a household.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 30, ttl: 60000 } }),
        HttpCode(HttpStatus.OK),
    );
}

export function AcceptApprovalEndpoint() {
    return applyDecorators(
        Put(':id/accept'),
        ApiOperation({
            summary: 'Accept a pending approval',
            description: 'Accepts the approval and applies the proposed changes. Reviewer cannot be the requester.',
        }),
        ApiResponse({ status: 200, description: 'Approval accepted.', type: ApprovalResponseDto }),
        ApiResponse({ status: 400, description: 'Validation error.', type: ErrorResponseDto }),
        ApiResponse({ status: 401, description: 'Unauthorized.', type: ErrorResponseDto }),
        ApiResponse({ status: 403, description: 'Cannot review own approval.', type: ErrorResponseDto }),
        ApiResponse({ status: 404, description: 'Approval not found.', type: ErrorResponseDto }),
        ApiResponse({ status: 409, description: 'Approval already reviewed.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 5, ttl: 60000 } }),
        HttpCode(HttpStatus.OK),
    );
}

export function RejectApprovalEndpoint() {
    return applyDecorators(
        Put(':id/reject'),
        ApiOperation({
            summary: 'Reject a pending approval',
            description: 'Rejects the approval with a required message. Reviewer cannot be the requester.',
        }),
        ApiResponse({ status: 200, description: 'Approval rejected.', type: ApprovalResponseDto }),
        ApiResponse({ status: 400, description: 'Validation error.', type: ErrorResponseDto }),
        ApiResponse({ status: 401, description: 'Unauthorized.', type: ErrorResponseDto }),
        ApiResponse({ status: 403, description: 'Cannot review own approval.', type: ErrorResponseDto }),
        ApiResponse({ status: 404, description: 'Approval not found.', type: ErrorResponseDto }),
        ApiResponse({ status: 409, description: 'Approval already reviewed.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 5, ttl: 60000 } }),
        HttpCode(HttpStatus.OK),
    );
}
