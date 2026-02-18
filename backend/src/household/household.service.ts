import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { HouseholdResponseDto } from './dto/household-response.dto';
import { HouseholdRole } from '../generated/prisma/enums';

@Injectable()
export class HouseholdService {
    private readonly logger = new Logger(HouseholdService.name);

    constructor(
        private readonly prismaService: PrismaService,
        private readonly mailService: MailService,
    ) {}

    //#region Household CRUD
    async createHousehold(userId: string, name: string): Promise<HouseholdResponseDto> {
        this.logger.log(`Create household attempt by user: ${userId}`);

        const existingMembership = await this.prismaService.householdMember.findUnique({ where: { userId } });

        if (existingMembership) {
            this.logger.warn(`User already belongs to a household: ${userId}`);
            throw new ConflictException('User already belongs to a household');
        }

        const inviteCode = this.generateInviteCode();

        const household = await this.prismaService.$transaction(async (tx) => {
            const _household = await tx.household.create({ data: { name, inviteCode } });
            await tx.householdMember.create({ data: { userId, householdId: _household.id, role: HouseholdRole.OWNER } });
            return _household;
        });

        const result = await this.findHouseholdWithMembers(household.id);
        this.logger.log(`Household created: ${household.id} by user: ${userId}`);
        return result;
    }

    async getMyHousehold(userId: string): Promise<HouseholdResponseDto> {
        const membership = await this.prismaService.householdMember.findUnique({
            where: { userId },
            include: {
                household: {
                    include: {
                        members: {
                            include: { user: { select: { firstName: true, lastName: true } } },
                        },
                    },
                },
            },
        });

        if (!membership) {
            this.logger.warn(`User is not a member of any household: ${userId}`);
            throw new NotFoundException('User is not a member of any household');
        }

        return this.mapToResponseDto(membership.household);
    }

    /**
     * Invalidates the current invite code and generates a new one.
     * Only the household owner can perform this action.
     *
     * Use case: The owner shared the invite code publicly by accident,
     * or a previous invitee who didn't join still has the old code.
     * Regenerating ensures only people with the fresh code can join.
     *
     * Scenario: Alex posted the invite code in a group chat by mistake.
     * A stranger could use it — Alex regenerates the code from household
     * settings, the old code becomes useless immediately.
     *
     * @param userId - The ID of the authenticated user (must be OWNER)
     * @returns The updated household with the new invite code and member list
     * @throws {NotFoundException} If the user is not a member of any household
     * @throws {ForbiddenException} If the user is not the household OWNER
     */
    async regenerateInviteCode(userId: string): Promise<HouseholdResponseDto> {
        this.logger.log(`Regenerate invite code attempt by user: ${userId}`);

        const membership = await this.prismaService.householdMember.findUnique({ where: { userId } });

        if (!membership) {
            this.logger.warn(`User is not a member of any household: ${userId}`);
            throw new NotFoundException('User is not a member of any household');
        }

        if (membership.role !== HouseholdRole.OWNER) {
            this.logger.warn(`Non-owner regenerate attempt by user: ${userId}`);
            throw new ForbiddenException('Only the household owner can regenerate the invite code');
        }

        const newCode = this.generateInviteCode();
        await this.prismaService.household.update({ where: { id: membership.householdId }, data: { inviteCode: newCode } });

        const result = await this.findHouseholdWithMembers(membership.householdId);
        this.logger.log(`Invite code regenerated for household: ${membership.householdId}`);
        return result;
    }
    //#endregion

    //#region Invitations & Join Requests

    /**
     * Allows a user to join an existing household using a shared invite code.
     * The user must not already belong to a household, and the target
     * household must not be full.
     *
     * Use case: This is the self-service join flow — no approval needed
     * from the owner. The owner shares the code (e.g. via chat), and the
     * other person enters it to join instantly.
     *
     * Scenario: Alex creates a household and sends the 8-char invite code
     * to Jordan. Jordan opens the app, pastes the code, and instantly
     * becomes a MEMBER of Alex's household.
     *
     * @param userId - The ID of the authenticated user wanting to join
     * @param inviteCode - The 8-char hex code shared by the household owner
     * @returns The household the user just joined, with the full member list
     * @throws {ConflictException} If the user already belongs to a household
     * @throws {NotFoundException} If no household matches the invite code
     * @throws {ConflictException} If the household has reached maxMembers
     */
    async joinByCode(userId: string, inviteCode: string): Promise<HouseholdResponseDto> {
        this.logger.log(`Join by code attempt by user: ${userId}`);

        const existingMembership = await this.prismaService.householdMember.findUnique({ where: { userId } });

        if (existingMembership) {
            this.logger.warn(`User already in a household: ${userId}`);
            throw new ConflictException('You already belong to a household');
        }

        const household = await this.prismaService.household.findUnique({
            where: { inviteCode },
            include: { members: true },
        });

        if (!household) {
            this.logger.warn(`Invalid invite code used by user: ${userId}`);
            throw new NotFoundException('Household not found');
        }

        if (household.members.length >= household.maxMembers) {
            this.logger.warn(`Household full: ${household.id}`);
            throw new ConflictException('Household is full');
        }

        await this.prismaService.householdMember.create({
            data: {
                userId,
                householdId: household.id,
                role: HouseholdRole.MEMBER,
            },
        });

        const result = await this.findHouseholdWithMembers(household.id);
        this.logger.log(`User ${userId} joined household ${household.id} via invite code`);
        return result;
    }
    //#endregion

    //#region Membership management

    /**
     * Allows a member to voluntarily leave their household.
     * - Regular members are simply removed.
     * - An owner who is the last member triggers household deletion.
     * - An owner with other members must transfer ownership first.
     *
     * Use case: This is the self-initiated exit — the member themselves
     * chooses to go. Not to be confused with removeMember (owner kicks).
     *
     * Scenario: Sam no longer shares expenses with Alex and wants out.
     * Sam hits "Leave household" and is removed. If Alex were the last
     * member and left, the whole household would be deleted automatically.
     *
     * @param userId - The ID of the authenticated user wanting to leave
     * @returns A message confirming the user left or the household was deleted
     * @throws {NotFoundException} If the user is not a member of any household
     * @throws {ForbiddenException} If the user is OWNER and other members remain
     */
    async leaveHousehold(userId: string): Promise<{ message: string }> {
        this.logger.log(`Leave household attempt by user: ${userId}`);

        const membership = await this.prismaService.householdMember.findUnique({ where: { userId }, include: { household: { include: { members: true } } } });

        if (!membership) {
            this.logger.warn(`User not in any household: ${userId}`);
            throw new NotFoundException('User is not a member of any household');
        }

        const isOwner = membership.role === HouseholdRole.OWNER;
        const memberCount = membership.household.members.length;

        if (isOwner && memberCount > 1) {
            this.logger.warn(`Owner tried to leave with members remaining: ${userId}`);
            throw new ForbiddenException('Owner must transfer ownership before leaving. Use /household/transfer-ownership first.');
        }

        // Owner is alone — delete the entire household (cascades invitations)
        if (isOwner && memberCount === 1) {
            await this.prismaService.household.delete({ where: { id: membership.householdId } });
            this.logger.log(`Household deleted (last member left): ${membership.householdId}`);
            return { message: 'Household deleted (you were the only member)' };
        }

        // Regular member leaves
        await this.prismaService.householdMember.delete({ where: { userId } });

        this.logger.log(`User ${userId} left household: ${membership.householdId}`);
        return { message: 'You have left the household' };
    }

    /**
     * Allows the household owner to forcibly remove another member.
     * The owner cannot remove themselves (they should use leaveHousehold).
     * A notification email is sent to the removed user.
     *
     * Use case: This is the owner-initiated kick — used when a member
     * should no longer have access to the shared budget.
     * Not to be confused with leaveHousehold (member leaves voluntarily).
     *
     * Scenario: Alex and Sam had a falling out. Alex opens household
     * settings, selects Sam, and removes them. Sam gets an email saying
     * they were removed from "Alex's Household".
     *
     * @param ownerId - The ID of the authenticated user (must be OWNER)
     * @param targetUserId - The ID of the member to remove
     * @returns A message confirming the member was removed
     * @throws {NotFoundException} If the owner is not a member of any household
     * @throws {ForbiddenException} If the caller is not the household OWNER
     * @throws {ForbiddenException} If the owner tries to remove themselves
     * @throws {NotFoundException} If the target user is not in the same household
     */
    async removeMember(ownerId: string, targetUserId: string): Promise<{ message: string }> {
        this.logger.log(`Remove member attempt by owner: ${ownerId}, target: ${targetUserId}`);

        const ownerMembership = await this.prismaService.householdMember.findUnique({ where: { userId: ownerId }, include: { household: true } });

        if (!ownerMembership) {
            this.logger.warn(`Owner not in any household: ${ownerId}`);
            throw new NotFoundException('You are not a member of any household');
        }

        if (ownerMembership.role !== HouseholdRole.OWNER) {
            this.logger.warn(`Non-owner remove attempt by user: ${ownerId}`);
            throw new ForbiddenException('Only the household owner can remove members');
        }

        if (ownerId === targetUserId) throw new ForbiddenException('Cannot remove yourself. Transfer the ownership or leave/delete the household instead.');

        const targetMembership = await this.prismaService.householdMember.findUnique({
            where: { userId: targetUserId },
            include: { user: { select: { email: true } } },
        });

        if (!targetMembership || targetMembership.householdId !== ownerMembership.householdId) {
            this.logger.warn(`Target user not in same household: ${targetUserId}`);
            throw new NotFoundException('Target user is not a member of your household');
        }

        await this.prismaService.householdMember.delete({ where: { userId: targetUserId } });
        await this.mailService.sendMemberRemoved(targetMembership.user.email, ownerMembership.household.name);

        this.logger.log(`User ${targetUserId} removed from household: ${ownerMembership.householdId}`);
        return { message: 'Member removed from household' };
    }

    /**
     * Transfers the OWNER role from the current owner to another member.
     * The current owner becomes a regular MEMBER. Both users must belong
     * to the same household.
     *
     * Use case: Required before the owner can leave a non-empty household.
     * Allows the household to change hands without disbanding.
     *
     * Scenario: Alex no longer manages finances and wants to hand off
     * control. Alex transfers ownership to Sam — Sam becomes the new
     * OWNER and Alex becomes a MEMBER who can now leave freely.
     *
     * @param ownerId - The ID of the authenticated user (must be current OWNER)
     * @param targetUserId - The ID of the member receiving ownership
     * @returns The updated household with new roles reflected in the member list
     * @throws {NotFoundException} If the owner is not a member of any household
     * @throws {ForbiddenException} If the caller is not the household OWNER
     * @throws {ForbiddenException} If the owner tries to transfer to themselves
     * @throws {NotFoundException} If the target user is not in the same household
     */
    async transferOwnership(ownerId: string, targetUserId: string): Promise<HouseholdResponseDto> {
        this.logger.log(`Transfer ownership attempt by: ${ownerId} to: ${targetUserId}`);

        const ownerMembership = await this.prismaService.householdMember.findUnique({ where: { userId: ownerId } });

        if (!ownerMembership) {
            this.logger.warn(`User not in any household: ${ownerId}`);
            throw new NotFoundException('You are not a member of any household');
        }

        if (ownerMembership.role !== HouseholdRole.OWNER) {
            this.logger.warn(`Non-owner transfer attempt by user: ${ownerId}`);
            throw new ForbiddenException('Only the household owner can transfer ownership');
        }

        if (ownerId === targetUserId) throw new ForbiddenException('Cannot transfer ownership to yourself');

        const targetMembership = await this.prismaService.householdMember.findUnique({ where: { userId: targetUserId } });

        if (!targetMembership || targetMembership.householdId !== ownerMembership.householdId) {
            this.logger.warn(`Target user not in same household: ${targetUserId}`);
            throw new NotFoundException('Target user is not a member of your household');
        }

        await this.prismaService.$transaction([
            this.prismaService.householdMember.update({ where: { userId: ownerId }, data: { role: HouseholdRole.MEMBER } }),
            this.prismaService.householdMember.update({ where: { userId: targetUserId }, data: { role: HouseholdRole.OWNER } }),
        ]);

        const result = await this.findHouseholdWithMembers(ownerMembership.householdId);
        this.logger.log(`Ownership transferred from ${ownerId} to ${targetUserId}`);
        return result;
    }
    //#endregion

    //#region Helpers
    private generateInviteCode(): string {
        return crypto.randomBytes(4).toString('hex');
    }

    private async findHouseholdWithMembers(householdId: string) {
        const household = await this.prismaService.household.findUnique({
            where: { id: householdId },
            include: {
                members: {
                    include: { user: { select: { firstName: true, lastName: true } } },
                },
            },
        });

        if (!household) throw new NotFoundException('Household not found');
        return this.mapToResponseDto(household);
    }

    private mapToResponseDto(household: {
        id: string;
        name: string;
        inviteCode: string;
        maxMembers: number;
        createdAt: Date;
        members: Array<{
            id: string;
            userId: string;
            user: { firstName: string; lastName: string };
            role: HouseholdRole;
            joinedAt: Date;
        }>;
    }): HouseholdResponseDto {
        return {
            id: household.id,
            name: household.name,
            inviteCode: household.inviteCode,
            maxMembers: household.maxMembers,
            createdAt: household.createdAt,
            members: household.members.map((member) => ({
                id: member.id,
                userId: member.userId,
                firstName: member.user.firstName,
                lastName: member.user.lastName,
                role: member.role,
                joinedAt: member.joinedAt,
            })),
        };
    }
    //#endregion
}
