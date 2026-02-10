import { applyDecorators, Delete, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HouseholdResponseDto } from '../dto/household-response.dto';
import { Throttle } from '@nestjs/throttler';
import { HouseholdInvitationResponseDto } from '../dto/household-invitation-response.dto';
import { MessageResponseDto } from '../../common/dto/message-response.dto';
import { ErrorResponseDto } from '../../common/dto/error-response.dto';

export function CreateHouseholdEndpoint() {
    return applyDecorators(
        Post(),
        ApiOperation({
            summary: 'Create a new household',
            description: 'Creates a new household and assigns the current user as OWNER.',
        }),
        ApiResponse({ status: 201, description: 'Household created.', type: HouseholdResponseDto }),
        ApiResponse({ status: 400, description: 'Validation error.', type: ErrorResponseDto }),
        ApiResponse({ status: 401, description: 'Unauthorized.', type: ErrorResponseDto }),
        ApiResponse({ status: 409, description: 'User already belongs to a household.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 5, ttl: 60000 } }),
        HttpCode(HttpStatus.CREATED),
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
        ApiResponse({ status: 401, description: 'Unauthorized.', type: ErrorResponseDto }),
        ApiResponse({ status: 404, description: 'User has no household.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 30, ttl: 60000 } }),
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
        ApiResponse({ status: 401, description: 'Unauthorized.', type: ErrorResponseDto }),
        ApiResponse({ status: 403, description: 'Only the owner can regenerate the code.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 5, ttl: 60000 } }),
        HttpCode(HttpStatus.OK),
    );
}

export function InviteToHouseholdEndpoint() {
    return applyDecorators(
        Post('invite'),
        ApiOperation({
            summary: 'Invite a user to your household',
            description: 'Owner sends an invitation to a user by email. The user must accept to join.',
        }),
        ApiResponse({ status: 201, description: 'Invitation sent.', type: HouseholdInvitationResponseDto }),
        ApiResponse({ status: 400, description: 'Validation error.', type: ErrorResponseDto }),
        ApiResponse({ status: 401, description: 'Unauthorized.', type: ErrorResponseDto }),
        ApiResponse({ status: 403, description: 'Only the owner can invite.', type: ErrorResponseDto }),
        ApiResponse({ status: 404, description: 'User not found.', type: ErrorResponseDto }),
        ApiResponse({ status: 409, description: 'User already in household, duplicate invitation, or household full.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 5, ttl: 60000 } }),
        HttpCode(HttpStatus.CREATED),
    );
}

export function JoinByCodeEndpoint() {
    return applyDecorators(
        Post('join'),
        ApiOperation({
            summary: 'Join a household by invite code',
            description: 'User joins a household instantly using an invite code. No approval needed.',
        }),
        ApiResponse({ status: 201, description: 'Joined household.', type: HouseholdResponseDto }),
        ApiResponse({ status: 400, description: 'Validation error.', type: ErrorResponseDto }),
        ApiResponse({ status: 401, description: 'Unauthorized.', type: ErrorResponseDto }),
        ApiResponse({ status: 404, description: 'Household not found (invalid code).', type: ErrorResponseDto }),
        ApiResponse({ status: 409, description: 'Already in a household or household full.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 5, ttl: 60000 } }),
        HttpCode(HttpStatus.CREATED),
    );
}

export function RespondToInvitationEndpoint() {
    return applyDecorators(
        Post('invitations/:id/respond'),
        ApiOperation({
            summary: 'Respond to an invitation',
            description: 'Accept or decline a pending invitation. Only the invited user can respond.',
        }),
        ApiResponse({ status: 200, description: 'Response recorded.', type: HouseholdInvitationResponseDto }),
        ApiResponse({ status: 400, description: 'Validation error.', type: ErrorResponseDto }),
        ApiResponse({ status: 401, description: 'Unauthorized.', type: ErrorResponseDto }),
        ApiResponse({ status: 403, description: 'Not authorized to respond.', type: ErrorResponseDto }),
        ApiResponse({ status: 404, description: 'Invitation not found.', type: ErrorResponseDto }),
        ApiResponse({ status: 409, description: 'Already responded, household full, or user already in household.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 30, ttl: 60000 } }),
        HttpCode(HttpStatus.OK),
    );
}

export function GetPendingInvitationsEndpoint() {
    return applyDecorators(
        Get('invitations/pending'),
        ApiOperation({
            summary: 'Get my pending invitations',
            description: 'Returns all pending invitations addressed to the current user.',
        }),
        ApiResponse({ status: 200, description: 'Pending invitations returned.', type: [HouseholdInvitationResponseDto] }),
        ApiResponse({ status: 401, description: 'Unauthorized.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 30, ttl: 60000 } }),
    );
}

export function CancelInvitationEndpoint() {
    return applyDecorators(
        Delete('invitations/:id'),
        ApiOperation({
            summary: 'Cancel a pending invitation',
            description: 'Sender cancels a pending invitation they created.',
        }),
        ApiResponse({ status: 200, description: 'Invitation cancelled.', type: MessageResponseDto }),
        ApiResponse({ status: 401, description: 'Unauthorized.', type: ErrorResponseDto }),
        ApiResponse({ status: 403, description: 'Can only cancel your own invitations.', type: ErrorResponseDto }),
        ApiResponse({ status: 404, description: 'Invitation not found.', type: ErrorResponseDto }),
        ApiResponse({ status: 409, description: 'Invitation is not pending.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 5, ttl: 60000 } }),
        HttpCode(HttpStatus.OK),
    );
}

export function LeaveHouseholdEndpoint() {
    return applyDecorators(
        Post('leave'),
        ApiOperation({
            summary: 'Leave your household',
            description: 'Member leaves the household. Owner must transfer ownership first (unless alone, which deletes the household).',
        }),
        ApiResponse({ status: 200, description: 'Left household.', type: MessageResponseDto }),
        ApiResponse({ status: 401, description: 'Unauthorized.', type: ErrorResponseDto }),
        ApiResponse({ status: 403, description: 'Owner must transfer ownership first.', type: ErrorResponseDto }),
        ApiResponse({ status: 404, description: 'Not in any household.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 5, ttl: 60000 } }),
        HttpCode(HttpStatus.OK),
    );
}

export function RemoveMemberEndpoint() {
    return applyDecorators(
        Delete('members/:userId'),
        ApiOperation({
            summary: 'Remove a member from household',
            description: 'Owner removes a member from the household. Immediate, no approval needed.',
        }),
        ApiResponse({ status: 200, description: 'Member removed.', type: MessageResponseDto }),
        ApiResponse({ status: 401, description: 'Unauthorized.', type: ErrorResponseDto }),
        ApiResponse({ status: 403, description: 'Only the owner can remove members.', type: ErrorResponseDto }),
        ApiResponse({ status: 404, description: 'Member not found.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 5, ttl: 60000 } }),
        HttpCode(HttpStatus.OK),
    );
}

export function TransferOwnershipEndpoint() {
    return applyDecorators(
        Post('transfer-ownership'),
        ApiOperation({
            summary: 'Transfer household ownership',
            description: 'Owner transfers the OWNER role to another member. Current owner becomes MEMBER.',
        }),
        ApiResponse({ status: 200, description: 'Ownership transferred.', type: HouseholdResponseDto }),
        ApiResponse({ status: 401, description: 'Unauthorized.', type: ErrorResponseDto }),
        ApiResponse({ status: 403, description: 'Only the owner can transfer ownership.', type: ErrorResponseDto }),
        ApiResponse({ status: 404, description: 'Target member not found.', type: ErrorResponseDto }),
        ApiResponse({ status: 429, description: 'Too many requests.', type: ErrorResponseDto }),
        Throttle({ default: { limit: 5, ttl: 60000 } }),
        HttpCode(HttpStatus.OK),
    );
}
