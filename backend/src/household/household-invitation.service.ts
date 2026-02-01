import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { HouseholdInvitationResponseDto } from './dto/household-invitation-response.dto';
import { HouseholdRole, InvitationStatus } from '../generated/prisma/enums';

@Injectable()
export class HouseholdInvitationService {
    private readonly logger = new Logger(HouseholdInvitationService.name);

    constructor(
        private readonly prismaService: PrismaService,
        private readonly mailService: MailService,
    ) {}

    //#region Invitations & Join Requests

    /**
     * Sends a direct email invitation from the household owner to a
     * specific user (looked up by email). Creates a PENDING invitation
     * record and notifies the target via email.
     *
     * Use case: This is the owner-initiated, targeted invite flow —
     * unlike joinByCode where anyone with the code can join instantly,
     * this requires the target to explicitly accept or decline.
     *
     * Scenario: Alex knows Jordan's email but doesn't want to share the
     * invite code openly. Alex types jordan@example.com and sends an
     * invitation. Jordan gets an email saying "Alex invited you to
     * 'Our Budget'" with accept/decline options. Nothing happens until
     * Jordan responds.
     *
     * @param ownerId - The ID of the authenticated user (must be OWNER)
     * @param email - The email address of the user to invite
     * @returns The created invitation with household, sender and target details
     * @throws {NotFoundException} If the owner is not a member of any household
     * @throws {ForbiddenException} If the caller is not the household OWNER
     * @throws {ConflictException} If the household has reached maxMembers
     * @throws {NotFoundException} If no registered user matches the email
     * @throws {ConflictException} If the target user already belongs to a household
     * @throws {ConflictException} If a pending invitation already exists for this user
     */
    async inviteToHousehold(ownerId: string, email: string): Promise<HouseholdInvitationResponseDto> {
        this.logger.log(`Invite attempt by owner: ${ownerId} to email: ${email}`);

        //#region Validate ownership
        const ownerMembership = await this.prismaService.householdMember.findUnique({
            where: { userId: ownerId },
            include: { household: { include: { members: true } } },
        });

        if (!ownerMembership) {
            this.logger.warn(`User not in any household: ${ownerId}`);
            throw new NotFoundException('You are not a member of any household');
        }

        if (ownerMembership.role !== HouseholdRole.OWNER) {
            this.logger.warn(`Non-owner invite attempt by user: ${ownerId}`);
            throw new ForbiddenException('Only the household owner can send invitations');
        }
        //#endregion

        // Check is household full
        if (ownerMembership.household.members.length >= ownerMembership.household.maxMembers) {
            this.logger.warn(`Household full, invite rejected: ${ownerMembership.householdId}`);
            throw new ConflictException('Household is full');
        }

        // Find the target user by email
        const targetUser = await this.prismaService.user.findUnique({ where: { email } });
        if (!targetUser) {
            this.logger.log(`Invited user not found: ${email}`);
            throw new NotFoundException('User with this email not found');
        }

        // Check is target already in a household
        const targetMembership = await this.prismaService.householdMember.findUnique({ where: { userId: targetUser.id } });
        if (targetMembership) {
            this.logger.warn(`Invited user already in a household: ${targetUser.id}`);
            throw new ConflictException('This user already belongs to a household');
        }

        // Check no duplicate pending invitation exists
        const existingInvitation = await this.prismaService.householdInvitation.findFirst({
            where: {
                householdId: ownerMembership.householdId,
                targetUserId: targetUser.id,
                status: InvitationStatus.PENDING,
            },
        });

        if (existingInvitation) {
            this.logger.warn(`Duplicate invitation to user: ${targetUser.id}`);
            throw new ConflictException('A pending invitation already exists for this user');
        }

        // Create the invitation
        const invitation = await this.prismaService.householdInvitation.create({
            data: {
                householdId: ownerMembership.householdId,
                senderId: ownerId,
                targetUserId: targetUser.id,
            },
            include: {
                household: true,
                sender: { select: { firstName: true, lastName: true } },
                targetUser: { select: { firstName: true, lastName: true, email: true } },
            },
        });

        // Send email notification
        await this.mailService.sendHouseholdInvitation(email, `${invitation.sender.firstName} ${invitation.sender.lastName}`, invitation.household.name);

        this.logger.log(`Invitation created: ${invitation.id} for household: ${ownerMembership.householdId}`);
        return this.mapToResponseDto(invitation);
    }

    async respondToInvitation(userId: string, invitationId: string, accept: boolean): Promise<HouseholdInvitationResponseDto> {
        this.logger.log(`Respond to invitation: ${invitationId} by user: ${userId}, accept: ${accept}`);

        // 1. Find the invitation
        const invitation = await this.prismaService.householdInvitation.findUnique({
            where: { id: invitationId },
            include: {
                household: { include: { members: true } },
                sender: { select: { firstName: true, lastName: true, email: true } },
                targetUser: { select: { firstName: true, lastName: true, email: true } },
            },
        });

        if (!invitation) {
            this.logger.warn(`Invitation not found: ${invitationId}`);
            throw new NotFoundException('Invitation not found');
        }

        // 2. Verify the current user is the target
        if (invitation.targetUserId !== userId) {
            this.logger.warn(`User ${userId} tried to respond to invitation not addressed to them`);
            throw new ForbiddenException('You are not authorized to respond to this invitation');
        }

        // 3. Check it's still pending
        if (invitation.status !== InvitationStatus.PENDING) {
            this.logger.warn(`Invitation already responded to: ${invitationId}`);
            throw new ConflictException('This invitation has already been responded to');
        }

        if (accept) {
            // 4a. Accepting — validate household still has room
            if (invitation.household.members.length >= invitation.household.maxMembers) {
                this.logger.warn(`Household full when accepting: ${invitation.householdId}`);
                throw new ConflictException('Household is full');
            }

            const joiningUserId = invitation.targetUserId;

            // Check joining user isn't already in a household (race condition guard)
            const existingMembership = await this.prismaService.householdMember.findUnique({ where: { userId: joiningUserId } });

            if (existingMembership) {
                this.logger.warn(`Joining user already in household: ${joiningUserId}`);
                throw new ConflictException('The joining user already belongs to a household');
            }

            // Accept: update invitation + create member in a transaction
            await this.prismaService.$transaction([
                this.prismaService.householdInvitation.update({
                    where: { id: invitationId },
                    data: { status: InvitationStatus.ACCEPTED, respondedAt: new Date() },
                }),
                this.prismaService.householdMember.create({
                    data: {
                        userId: joiningUserId,
                        householdId: invitation.householdId,
                        role: HouseholdRole.MEMBER,
                    },
                }),
            ]);

            this.logger.log(`Invitation accepted: ${invitationId}, user ${joiningUserId} joined`);
        } else {
            // 4b. Declining
            await this.prismaService.householdInvitation.update({
                where: { id: invitationId },
                data: { status: InvitationStatus.DECLINED, respondedAt: new Date() },
            });

            this.logger.log(`Invitation declined: ${invitationId}`);
        }

        // 5. Send email notification to the sender
        const responderName = `${invitation.targetUser.firstName} ${invitation.targetUser.lastName}`;
        await this.mailService.sendInvitationResponse(invitation.sender.email, responderName, invitation.household.name, accept);

        // 6. Return updated invitation
        const updated = await this.prismaService.householdInvitation.findUnique({
            where: { id: invitationId },
            include: {
                household: true,
                sender: { select: { firstName: true, lastName: true } },
                targetUser: { select: { firstName: true, lastName: true } },
            },
        });

        return this.mapToResponseDto(updated);
    }

    async getPendingInvitations(userId: string): Promise<HouseholdInvitationResponseDto[]> {
        const invitations = await this.prismaService.householdInvitation.findMany({
            where: {
                targetUserId: userId,
                status: InvitationStatus.PENDING,
            },
            include: {
                household: true,
                sender: { select: { firstName: true, lastName: true } },
                targetUser: { select: { firstName: true, lastName: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        return invitations.map((inv) => this.mapToResponseDto(inv));
    }

    async cancelInvitation(userId: string, invitationId: string): Promise<{ message: string }> {
        this.logger.log(`Cancel invitation attempt: ${invitationId} by user: ${userId}`);

        const invitation = await this.prismaService.householdInvitation.findUnique({ where: { id: invitationId } });

        if (!invitation) {
            this.logger.warn(`Invitation not found: ${invitationId}`);
            throw new NotFoundException('Invitation not found');
        }

        if (invitation.senderId !== userId) {
            this.logger.warn(`User ${userId} tried to cancel invitation they didn't send`);
            throw new ForbiddenException('You can only cancel invitations you sent');
        }

        if (invitation.status !== InvitationStatus.PENDING) {
            this.logger.warn(`Cannot cancel non-pending invitation: ${invitationId}`);
            throw new ConflictException('Only pending invitations can be cancelled');
        }

        await this.prismaService.householdInvitation.update({
            where: { id: invitationId },
            data: { status: InvitationStatus.CANCELLED, respondedAt: new Date() },
        });

        this.logger.log(`Invitation cancelled: ${invitationId}`);
        return { message: 'Invitation cancelled' };
    }
    //#endregion

    //#region Helpers
    private mapToResponseDto(invitation: any): HouseholdInvitationResponseDto {
        return {
            id: invitation.id,
            status: invitation.status,
            householdId: invitation.householdId,
            householdName: invitation.household.name,
            senderId: invitation.senderId,
            senderFirstName: invitation.sender.firstName,
            senderLastName: invitation.sender.lastName,
            targetUserId: invitation.targetUserId,
            targetFirstName: invitation.targetUser.firstName,
            targetLastName: invitation.targetUser.lastName,
            createdAt: invitation.createdAt,
            respondedAt: invitation.respondedAt,
        };
    }
    //#endregion
}
