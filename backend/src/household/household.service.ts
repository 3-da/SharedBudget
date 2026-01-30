import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { HouseholdResponseDto } from './dto/household-response.dto';
import { HouseholdRole } from '../generated/prisma/enums';

@Injectable()
export class HouseholdService {
    private readonly logger = new Logger(HouseholdService.name);

    constructor(private readonly prismaService: PrismaService) {}

    async createHousehold(userId: string, name: string): Promise<HouseholdResponseDto> {
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

    async joinHousehold(userId: string, inviteCode: string): Promise<HouseholdResponseDto> {
        this.logger.log(`Join household attempt by user: ${userId}`);

        const existingMembership = await this.prismaService.householdMember.findUnique({ where: { userId } });

        if (existingMembership) {
            this.logger.warn(`User already belongs to a household: ${userId}`);
            throw new ConflictException('User already belongs to a household');
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
            this.logger.warn(`Household full: ${household.id}, join attempt by user: ${userId}`);
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
        this.logger.log(`User ${userId} joined household: ${household.id}`);
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
            throw new NotFoundException('User is not a member of any household');
        }

        return this.mapToResponseDto(membership.household);
    }

    async regenerateInviteCode(userId: string): Promise<HouseholdResponseDto> {
        this.logger.log(`Regenerate invite code attempt by user: ${userId}`);

        const membership = await this.prismaService.householdMember.findUnique({ where: { userId } });

        if (!membership) {
            this.logger.warn(`User is not a member of any household`);
            throw new NotFoundException('User is not a member of any household');
        }

        if (membership.role !== HouseholdRole.OWNER) {
            this.logger.warn(`Non-owner regenerate attempt by user: ${userId}`);
            throw new ForbiddenException('Only the household owner can regenerate the invite code');
        }

        const newCode = this.generateInviteCode();

        await this.prismaService.household.update({
            where: { id: membership.householdId },
            data: { inviteCode: newCode },
        });

        const result = await this.findHouseholdWithMembers(membership.householdId);
        this.logger.log(`Invite code regenerated for household: ${membership.householdId}`);
        return result;
    }

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

        return this.mapToResponseDto(household);
    }

    private mapToResponseDto(household: any) {
        return {
            id: household.id,
            name: household.name,
            inviteCode: household.inviteCode,
            maxMembers: household.maxMembers,
            createdAt: household.createdAt,
            members: household.members.map((member: any) => ({
                id: member.id,
                userId: member.userId,
                firstName: member.user.firstName,
                lastName: member.user.lastName,
                role: member.role,
                joinedAt: member.joinedAt,
            })),
        };
    }
}
