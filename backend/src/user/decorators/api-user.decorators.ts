import { applyDecorators, Delete, Get, HttpCode, HttpStatus, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UserProfileResponseDto } from '../dto/user-profile-response.dto';
import { PendingDeleteRequestResponseDto } from '../dto/pending-delete-request-response.dto';
import { Throttle } from '@nestjs/throttler';
import { ErrorResponseDto } from '../../common/dto/error-response.dto';
import { MessageResponseDto } from '../../common/dto/message-response.dto';

export function GetProfileEndpoint() {
    return applyDecorators(
        Get('me'),
        ApiOperation({
            summary: 'Get my profile',
            description: "Returns the authenticated user's profile information.",
        }),
        ApiResponse({ status: 200, description: 'Profile returned.', type: UserProfileResponseDto }),
        ApiResponse({ status: 401, description: 'Unauthorized.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 30, ttl: 60000 } }),
        HttpCode(HttpStatus.OK),
    );
}

export function UpdateProfileEndpoint() {
    return applyDecorators(
        Put('me'),
        ApiOperation({
            summary: 'Update my profile',
            description: "Updates the authenticated user's first name and last name.",
        }),
        ApiResponse({ status: 200, description: 'Profile updated.', type: UserProfileResponseDto }),
        ApiResponse({ status: 400, description: 'Validation error.', type: ErrorResponseDto }),
        ApiResponse({ status: 401, description: 'Unauthorized.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 5, ttl: 60000 } }),
        HttpCode(HttpStatus.OK),
    );
}

export function ChangePasswordEndpoint() {
    return applyDecorators(
        Put('me/password'),
        ApiOperation({
            summary: 'Change my password',
            description: "Changes the user's password. Requires current password. Invalidates all sessions.",
        }),
        ApiResponse({ status: 200, description: 'Password changed.', type: MessageResponseDto }),
        ApiResponse({ status: 400, description: 'Validation error.', type: ErrorResponseDto }),
        ApiResponse({ status: 401, description: 'Unauthorized or incorrect password.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 3, ttl: 60000 } }),
        HttpCode(HttpStatus.OK),
    );
}

export function DeleteAccountEndpoint() {
    return applyDecorators(
        Delete('me'),
        ApiOperation({
            summary: 'Delete my account',
            description:
                "Permanently deletes the authenticated user's account and cleans up their household data. Members: removes from household, deletes personal expenses/savings/salary, anonymizes account. Sole owner: deletes the household and all its data. Owner with multiple members: blocked — use POST /users/me/delete-account-request first.",
        }),
        ApiResponse({ status: 200, description: 'Account deleted.', type: MessageResponseDto }),
        ApiResponse({ status: 403, description: 'Owner with multiple members must use the delete-account-request flow.', type: ErrorResponseDto }),
        ApiResponse({ status: 401, description: 'Unauthorized.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 3, ttl: 60000 } }),
        HttpCode(HttpStatus.OK),
    );
}

export function RequestAccountDeletionEndpoint() {
    return applyDecorators(
        Post('me/delete-account-request'),
        ApiOperation({
            summary: 'Request account deletion (owner with members)',
            description:
                'Creates a deletion request targeting another household member. The target member must accept (becoming the new owner) or reject (household is deleted). Only callable by the owner when there are other members.',
        }),
        ApiResponse({ status: 201, description: 'Deletion request created.', schema: { properties: { requestId: { type: 'string' } } } }),
        ApiResponse({ status: 400, description: 'No other members — use DELETE /users/me directly.', type: ErrorResponseDto }),
        ApiResponse({ status: 403, description: 'Caller is not the owner or target is self.', type: ErrorResponseDto }),
        ApiResponse({ status: 404, description: 'Target member not in household.', type: ErrorResponseDto }),
        ApiResponse({ status: 409, description: 'Pending deletion request already exists.', type: ErrorResponseDto }),
        ApiResponse({ status: 401, description: 'Unauthorized.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 3, ttl: 60000 } }),
        HttpCode(HttpStatus.CREATED),
    );
}

export function GetPendingDeleteRequestsEndpoint() {
    return applyDecorators(
        Get('delete-account-requests'),
        ApiOperation({
            summary: 'Get pending delete-account requests (for the target member)',
            description: 'Returns deletion requests sent to the authenticated user. At most one request exists at a time.',
        }),
        ApiResponse({ status: 200, description: 'Pending requests returned.', type: [PendingDeleteRequestResponseDto] }),
        ApiResponse({ status: 401, description: 'Unauthorized.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 30, ttl: 60000 } }),
        HttpCode(HttpStatus.OK),
    );
}

export function RespondToDeleteRequestEndpoint() {
    return applyDecorators(
        Post('delete-account-requests/:requestId/respond'),
        ApiOperation({
            summary: 'Respond to a delete-account request',
            description:
                "Accept or reject a deletion request. Accept: you become owner, original owner's data is removed and their account is deleted. Reject: entire household is deleted for all members, original owner's account is deleted.",
        }),
        ApiResponse({ status: 200, description: 'Response processed.', type: MessageResponseDto }),
        ApiResponse({ status: 404, description: 'Request not found or expired.', type: ErrorResponseDto }),
        ApiResponse({ status: 403, description: 'You are not the target of this request.', type: ErrorResponseDto }),
        ApiResponse({ status: 401, description: 'Unauthorized.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 5, ttl: 60000 } }),
        HttpCode(HttpStatus.OK),
    );
}

export function CancelDeleteRequestEndpoint() {
    return applyDecorators(
        Delete('me/delete-account-request'),
        ApiOperation({
            summary: 'Cancel pending delete-account request',
            description: "Cancels the owner's pending deletion request.",
        }),
        ApiResponse({ status: 200, description: 'Request cancelled.', type: MessageResponseDto }),
        ApiResponse({ status: 404, description: 'No pending request found.', type: ErrorResponseDto }),
        ApiResponse({ status: 401, description: 'Unauthorized.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 5, ttl: 60000 } }),
        HttpCode(HttpStatus.OK),
    );
}
