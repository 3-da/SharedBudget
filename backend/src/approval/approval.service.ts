import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExpenseHelperService } from '../common/expense/expense-helper.service';
import { ApprovalResponseDto } from './dto/approval-response.dto';
import { AcceptApprovalDto } from './dto/accept-approval.dto';
import { RejectApprovalDto } from './dto/reject-approval.dto';
import { ListApprovalsQueryDto } from './dto/list-approvals-query.dto';
import { ApprovalAction, ApprovalStatus, ExpenseType } from '../generated/prisma/enums';
import { Prisma } from '../generated/prisma/client';
import { buildExpenseNullableFields, mapToApprovalResponse } from '../common/expense/expense.mappers';
import { CacheService } from '../common/cache/cache.service';

@Injectable()
export class ApprovalService {
    private readonly logger = new Logger(ApprovalService.name);

    constructor(
        private readonly prismaService: PrismaService,
        private readonly expenseHelper: ExpenseHelperService,
        private readonly cacheService: CacheService,
    ) {}

    /**
     * Lists all pending approvals for the authenticated user's household.
     *
     * Use case: User opens "Approvals" tab to see what needs their review.
     *
     * Scenario: Sam proposes adding "Monthly Rent" as a shared expense.
     * Alex opens the approvals page and sees the pending proposal.
     *
     * @param userId - The authenticated user's ID
     * @returns Array of pending approvals in the user's household
     * @throws {NotFoundException} If the user is not a member of any household
     */
    async listPendingApprovals(userId: string): Promise<ApprovalResponseDto[]> {
        this.logger.debug(`List pending approvals for user: ${userId}`);

        const membership = await this.expenseHelper.requireMembership(userId);
        const cacheKey = this.cacheService.pendingApprovalsKey(membership.householdId);

        return this.cacheService.getOrSet(cacheKey, this.cacheService.summaryTTL, async () => {
            const approvals = await this.prismaService.expenseApproval.findMany({
                where: {
                    householdId: membership.householdId,
                    status: ApprovalStatus.PENDING,
                },
                orderBy: { createdAt: 'desc' },
                include: {
                    requestedBy: { select: { id: true, firstName: true, lastName: true } },
                    reviewedBy: { select: { id: true, firstName: true, lastName: true } },
                },
            });

            return approvals.map((approval) => mapToApprovalResponse(approval));
        });
    }

    /**
     * Lists past approvals (accepted or rejected) for the authenticated user's household.
     * Supports optional filtering by status (ACCEPTED or REJECTED).
     *
     * Use case: User reviews the history of approved/rejected changes.
     *
     * Scenario: Alex wants to see which shared expense proposals were rejected
     * in the past, so they filter by REJECTED status.
     *
     * @param userId - The authenticated user's ID
     * @param query - Optional status filter (ACCEPTED or REJECTED)
     * @returns Array of past approvals matching the filter
     * @throws {NotFoundException} If the user is not a member of any household
     */
    async listApprovalHistory(userId: string, query: ListApprovalsQueryDto): Promise<ApprovalResponseDto[]> {
        this.logger.debug(`List approval history for user: ${userId}`);

        const membership = await this.expenseHelper.requireMembership(userId);
        const cacheKey = this.cacheService.approvalHistoryKey(membership.householdId, query.status);

        return this.cacheService.getOrSet(cacheKey, this.cacheService.summaryTTL, async () => {
            const where: Prisma.ExpenseApprovalWhereInput = {
                householdId: membership.householdId,
                status: query.status ? query.status : { in: [ApprovalStatus.ACCEPTED, ApprovalStatus.REJECTED] },
            };

            const approvals = await this.prismaService.expenseApproval.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                include: {
                    requestedBy: { select: { id: true, firstName: true, lastName: true } },
                    reviewedBy: { select: { id: true, firstName: true, lastName: true } },
                },
            });

            return approvals.map((approval) => mapToApprovalResponse(approval));
        });
    }

    /**
     * Accepts a pending approval and applies the proposed changes.
     * The reviewer cannot be the same user who requested the approval.
     *
     * Depending on the action type:
     * - CREATE: Creates a new shared expense from proposedData
     * - UPDATE: Applies proposedData fields to the existing expense
     * - DELETE: Soft-deletes the associated expense (sets deletedAt)
     *
     * All changes are wrapped in a Prisma transaction.
     *
     * Use case: A household member reviews and approves a proposed expense change.
     *
     * Scenario: Sam proposed adding "Monthly Rent — €800". Alex reviews it,
     * finds it reasonable, and accepts. The expense becomes active.
     *
     * @param userId - The authenticated user's ID (the reviewer)
     * @param approvalId - The approval to accept
     * @param dto - Optional reviewer comment
     * @returns The updated approval record
     * @throws {NotFoundException} If the user is not a member of any household
     * @throws {NotFoundException} If the approval does not exist or belongs to a different household
     * @throws {ConflictException} If the approval is not in PENDING status
     * @throws {ForbiddenException} If the reviewer is the same user who requested the approval
     */
    async acceptApproval(userId: string, approvalId: string, dto: AcceptApprovalDto): Promise<ApprovalResponseDto> {
        this.logger.log(`Accept approval: ${approvalId} by user: ${userId}`);

        const membership = await this.expenseHelper.requireMembership(userId);
        const approval = await this.findApprovalOrFail(approvalId, membership.householdId);

        if (approval.status !== ApprovalStatus.PENDING) {
            this.logger.warn(`Approval not pending: ${approvalId}, status: ${approval.status}`);
            throw new ConflictException('This approval has already been reviewed');
        }

        if (approval.requestedById === userId) {
            this.logger.warn(`Self-review attempt: user ${userId} on approval ${approvalId}`);
            throw new ForbiddenException('You cannot review your own approval');
        }

        const now = new Date();

        const result = await this.prismaService.$transaction(async (tx) => {
            const updatedApproval = await tx.expenseApproval.update({
                where: { id: approvalId },
                data: {
                    status: ApprovalStatus.ACCEPTED,
                    reviewedById: userId,
                    message: dto.message ?? null,
                    reviewedAt: now,
                },
                include: {
                    requestedBy: { select: { id: true, firstName: true, lastName: true } },
                    reviewedBy: { select: { id: true, firstName: true, lastName: true } },
                },
            });

            if (approval.action === ApprovalAction.CREATE) {
                const proposed = approval.proposedData as any;
                await tx.expense.create({
                    data: {
                        householdId: approval.householdId,
                        createdById: approval.requestedById,
                        type: ExpenseType.SHARED,
                        name: proposed.name,
                        amount: proposed.amount,
                        category: proposed.category,
                        frequency: proposed.frequency,
                        paidByUserId: proposed.paidByUserId ?? null,
                        ...buildExpenseNullableFields(proposed),
                    },
                });
            } else if (approval.action === ApprovalAction.UPDATE) {
                const proposed = approval.proposedData as any;
                await tx.expense.update({
                    where: { id: approval.expenseId! },
                    data: proposed,
                });
            } else if (approval.action === ApprovalAction.DELETE) {
                await tx.expense.update({
                    where: { id: approval.expenseId! },
                    data: { deletedAt: now },
                });
            }

            return updatedApproval;
        });

        this.logger.log(`Approval accepted: ${approvalId} (action: ${approval.action})`);

        // Invalidate ALL household caches since expense was created/updated/deleted
        await this.cacheService.invalidateHousehold(approval.householdId);

        return mapToApprovalResponse(result);
    }

    /**
     * Rejects a pending approval with a required message explaining the reason.
     * The reviewer cannot be the same user who requested the approval.
     * No expense changes are applied.
     *
     * Use case: A household member disagrees with a proposed expense change.
     *
     * Scenario: Sam proposed increasing rent to €1000. Alex finds the amount
     * unreasonable and rejects with a message explaining why.
     *
     * @param userId - The authenticated user's ID (the reviewer)
     * @param approvalId - The approval to reject
     * @param dto - Required rejection message
     * @returns The updated approval record
     * @throws {NotFoundException} If the user is not a member of any household
     * @throws {NotFoundException} If the approval does not exist or belongs to a different household
     * @throws {ConflictException} If the approval is not in PENDING status
     * @throws {ForbiddenException} If the reviewer is the same user who requested the approval
     */
    async rejectApproval(userId: string, approvalId: string, dto: RejectApprovalDto): Promise<ApprovalResponseDto> {
        this.logger.log(`Reject approval: ${approvalId} by user: ${userId}`);

        const membership = await this.expenseHelper.requireMembership(userId);
        const approval = await this.findApprovalOrFail(approvalId, membership.householdId);

        if (approval.status !== ApprovalStatus.PENDING) {
            this.logger.warn(`Approval not pending: ${approvalId}, status: ${approval.status}`);
            throw new ConflictException('This approval has already been reviewed');
        }

        if (approval.requestedById === userId) {
            this.logger.warn(`Self-review attempt: user ${userId} on approval ${approvalId}`);
            throw new ForbiddenException('You cannot review your own approval');
        }

        const updatedApproval = await this.prismaService.expenseApproval.update({
            where: { id: approvalId },
            data: {
                status: ApprovalStatus.REJECTED,
                reviewedById: userId,
                message: dto.message,
                reviewedAt: new Date(),
            },
            include: {
                requestedBy: { select: { id: true, firstName: true, lastName: true } },
                reviewedBy: { select: { id: true, firstName: true, lastName: true } },
            },
        });

        this.logger.log(`Approval rejected: ${approvalId}`);

        // Only invalidate approval caches (no expense change)
        await this.cacheService.invalidateApprovals(approval.householdId);

        return mapToApprovalResponse(updatedApproval);
    }

    /**
     * Cancels a pending approval that was requested by the authenticated user.
     * Sets the status to REJECTED with the reviewer being the requester themselves.
     * No expense changes are applied.
     *
     * Use case: A requester changes their mind about a proposed expense change
     * and wants to withdraw it before anyone reviews it.
     *
     * Scenario: Sam proposed adding "Monthly Rent" as a shared expense, but
     * realises the amount was wrong. Instead of waiting for Alex to reject it,
     * Sam cancels the approval directly.
     *
     * @param userId - The authenticated user's ID (must be the original requester)
     * @param approvalId - The approval to cancel
     * @returns The updated approval record with status REJECTED
     * @throws {NotFoundException} If the user is not a member of any household
     * @throws {NotFoundException} If the approval does not exist or belongs to a different household
     * @throws {ConflictException} If the approval is not in PENDING status
     * @throws {ForbiddenException} If the user is not the original requester
     */
    async cancelApproval(userId: string, approvalId: string): Promise<ApprovalResponseDto> {
        this.logger.log(`Cancel approval: ${approvalId} by user: ${userId}`);

        const membership = await this.expenseHelper.requireMembership(userId);
        const approval = await this.findApprovalOrFail(approvalId, membership.householdId);

        if (approval.status !== ApprovalStatus.PENDING) {
            this.logger.warn(`Approval not pending: ${approvalId}, status: ${approval.status}`);
            throw new ConflictException('This approval has already been reviewed');
        }

        if (approval.requestedById !== userId) {
            this.logger.warn(`Non-requester cancel attempt: user ${userId} on approval ${approvalId}`);
            throw new ForbiddenException('Only the requester can cancel their own approval');
        }

        const updatedApproval = await this.prismaService.expenseApproval.update({
            where: { id: approvalId },
            data: {
                status: ApprovalStatus.REJECTED,
                reviewedById: userId,
                message: 'Cancelled by requester',
                reviewedAt: new Date(),
            },
            include: {
                requestedBy: { select: { id: true, firstName: true, lastName: true } },
                reviewedBy: { select: { id: true, firstName: true, lastName: true } },
            },
        });

        this.logger.log(`Approval cancelled: ${approvalId}`);

        // Only invalidate approval caches (no expense change)
        await this.cacheService.invalidateApprovals(approval.householdId);

        return mapToApprovalResponse(updatedApproval);
    }

    private async findApprovalOrFail(approvalId: string, householdId: string) {
        const approval = await this.prismaService.expenseApproval.findFirst({
            where: { id: approvalId, householdId },
        });

        if (!approval) {
            this.logger.warn(`Approval not found: ${approvalId}`);
            throw new NotFoundException('Approval not found');
        }

        return approval;
    }
}
