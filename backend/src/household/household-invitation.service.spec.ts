import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { HouseholdInvitationService } from './household-invitation.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { HouseholdRole, InvitationStatus } from '../generated/prisma/enums';

describe('HouseholdInvitationService', () => {
    let service: HouseholdInvitationService;

    const mockOwnerId = 'owner-123';
    const mockUserId = 'user-456';
    const mockHouseholdId = 'household-789';
    const mockInvitationId = 'invitation-001';

    const mockPrismaService = {
        householdMember: { findUnique: vi.fn(), create: vi.fn() },
        household: { findUnique: vi.fn() },
        user: { findUnique: vi.fn() },
        householdInvitation: {
            findFirst: vi.fn(),
            findUnique: vi.fn(),
            findMany: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
        },
        $transaction: vi.fn(),
    };

    const mockMailService = {
        sendHouseholdInvitation: vi.fn(),
        sendInvitationResponse: vi.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                HouseholdInvitationService,
                { provide: PrismaService, useValue: mockPrismaService },
                { provide: MailService, useValue: mockMailService },
            ],
        }).compile();

        service = module.get<HouseholdInvitationService>(HouseholdInvitationService);
        vi.clearAllMocks();
    });

    describe('inviteToHousehold', () => {
        const mockOwnerMembership = {
            userId: mockOwnerId,
            householdId: mockHouseholdId,
            role: HouseholdRole.OWNER,
            household: {
                id: mockHouseholdId,
                name: 'My Home',
                maxMembers: 2,
                members: [{ userId: mockOwnerId, role: HouseholdRole.OWNER }],
            },
        };

        const mockTargetUser = { id: mockUserId, email: 'target@example.com', firstName: 'Jane', lastName: 'Doe' };

        const mockCreatedInvitation = {
            id: mockInvitationId,
            status: InvitationStatus.PENDING,
            householdId: mockHouseholdId,
            senderId: mockOwnerId,
            targetUserId: mockUserId,
            createdAt: new Date(),
            respondedAt: null,
            household: { name: 'My Home' },
            sender: { firstName: 'John', lastName: 'Doe' },
            targetUser: { firstName: 'Jane', lastName: 'Doe', email: 'target@example.com' },
        };

        it('should create an invitation and send email', async () => {
            mockPrismaService.householdMember.findUnique
                .mockResolvedValueOnce(mockOwnerMembership) // owner check
                .mockResolvedValueOnce(null); // target not in household
            mockPrismaService.user.findUnique.mockResolvedValue(mockTargetUser);
            mockPrismaService.householdInvitation.findFirst.mockResolvedValue(null);
            mockPrismaService.householdInvitation.create.mockResolvedValue(mockCreatedInvitation);

            const result = await service.inviteToHousehold(mockOwnerId, 'target@example.com');

            expect(result.id).toBe(mockInvitationId);
            expect(mockMailService.sendHouseholdInvitation).toHaveBeenCalledWith('target@example.com', 'John Doe', 'My Home');
        });

        it('should throw NotFoundException if owner has no household', async () => {
            mockPrismaService.householdMember.findUnique.mockResolvedValue(null);

            try {
                await service.inviteToHousehold(mockOwnerId, 'target@example.com');
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error: any) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('You are not a member of any household');
            }
        });

        it('should throw ForbiddenException if user is not owner', async () => {
            mockPrismaService.householdMember.findUnique.mockResolvedValue({
                ...mockOwnerMembership,
                role: HouseholdRole.MEMBER,
            });

            try {
                await service.inviteToHousehold(mockOwnerId, 'target@example.com');
                expect.unreachable('Should have thrown ForbiddenException');
            } catch (error: any) {
                expect(error).toBeInstanceOf(ForbiddenException);
                expect(error.message).toBe('Only the household owner can send invitations');
            }
        });

        it('should throw ConflictException if household is full', async () => {
            mockPrismaService.householdMember.findUnique.mockResolvedValue({
                ...mockOwnerMembership,
                household: {
                    ...mockOwnerMembership.household,
                    maxMembers: 1,
                },
            });

            try {
                await service.inviteToHousehold(mockOwnerId, 'target@example.com');
                expect.unreachable('Should have thrown ConflictException');
            } catch (error: any) {
                expect(error).toBeInstanceOf(ConflictException);
                expect(error.message).toBe('Household is full');
            }
        });

        it('should throw NotFoundException if target email not found', async () => {
            mockPrismaService.householdMember.findUnique.mockResolvedValue(mockOwnerMembership);
            mockPrismaService.user.findUnique.mockResolvedValue(null);

            try {
                await service.inviteToHousehold(mockOwnerId, 'nobody@example.com');
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error: any) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('User with this email not found');
            }
        });

        it('should throw ConflictException if target already in a household', async () => {
            mockPrismaService.householdMember.findUnique
                .mockResolvedValueOnce(mockOwnerMembership)
                .mockResolvedValueOnce({ userId: mockUserId, householdId: 'other' });
            mockPrismaService.user.findUnique.mockResolvedValue(mockTargetUser);

            try {
                await service.inviteToHousehold(mockOwnerId, 'target@example.com');
                expect.unreachable('Should have thrown ConflictException');
            } catch (error: any) {
                expect(error).toBeInstanceOf(ConflictException);
                expect(error.message).toBe('This user already belongs to a household');
            }
        });

        it('should throw ConflictException if duplicate pending invitation exists', async () => {
            mockPrismaService.householdMember.findUnique.mockResolvedValueOnce(mockOwnerMembership).mockResolvedValueOnce(null);
            mockPrismaService.user.findUnique.mockResolvedValue(mockTargetUser);
            mockPrismaService.householdInvitation.findFirst.mockResolvedValue({ id: 'existing' });

            try {
                await service.inviteToHousehold(mockOwnerId, 'target@example.com');
                expect.unreachable('Should have thrown ConflictException');
            } catch (error: any) {
                expect(error).toBeInstanceOf(ConflictException);
                expect(error.message).toBe('A pending invitation already exists for this user');
            }
        });

        it('should allow inviting when household has one slot left (maxMembers - 1)', async () => {
            // Boundary: 1 member, maxMembers 2 → one slot left → invitation should succeed
            mockPrismaService.householdMember.findUnique
                .mockResolvedValueOnce(mockOwnerMembership) // owner with 1 member, maxMembers 2
                .mockResolvedValueOnce(null); // target not in household
            mockPrismaService.user.findUnique.mockResolvedValue(mockTargetUser);
            mockPrismaService.householdInvitation.findFirst.mockResolvedValue(null);
            mockPrismaService.householdInvitation.create.mockResolvedValue(mockCreatedInvitation);

            const result = await service.inviteToHousehold(mockOwnerId, 'target@example.com');

            expect(result.id).toBe(mockInvitationId);
        });

        it('should throw ConflictException if owner tries to invite themselves', async () => {
            // Edge case: owner's email used as target → target found is the owner themselves
            const ownerAsTarget = { id: mockOwnerId, email: 'owner@example.com', firstName: 'John', lastName: 'Doe' };
            mockPrismaService.householdMember.findUnique
                .mockResolvedValueOnce(mockOwnerMembership) // owner check
                .mockResolvedValueOnce({ userId: mockOwnerId, householdId: mockHouseholdId }); // target already in household (same household)
            mockPrismaService.user.findUnique.mockResolvedValue(ownerAsTarget);

            try {
                await service.inviteToHousehold(mockOwnerId, 'owner@example.com');
                expect.unreachable('Should have thrown ConflictException');
            } catch (error: any) {
                expect(error).toBeInstanceOf(ConflictException);
                expect(error.message).toBe('This user already belongs to a household');
            }
        });
    });

    // ─── respondToInvitation ────────────────────────────────

    describe('respondToInvitation', () => {
        const mockInvitation = {
            id: mockInvitationId,
            status: InvitationStatus.PENDING,
            householdId: mockHouseholdId,
            senderId: mockOwnerId,
            targetUserId: mockUserId,
            createdAt: new Date(),
            respondedAt: null,
            household: { id: mockHouseholdId, name: 'My Home', maxMembers: 2, members: [{ userId: mockOwnerId }] },
            sender: { firstName: 'John', lastName: 'Doe', email: 'owner@example.com' },
            targetUser: { firstName: 'Jane', lastName: 'Doe', email: 'target@example.com' },
        };

        const mockUpdatedInvitation = {
            ...mockInvitation,
            status: InvitationStatus.ACCEPTED,
            respondedAt: new Date(),
            household: { name: 'My Home' },
            sender: { firstName: 'John', lastName: 'Doe' },
            targetUser: { firstName: 'Jane', lastName: 'Doe' },
        };

        it('should accept an invitation and create membership', async () => {
            mockPrismaService.householdInvitation.findUnique.mockResolvedValueOnce(mockInvitation).mockResolvedValueOnce(mockUpdatedInvitation);
            mockPrismaService.householdMember.findUnique.mockResolvedValue(null);
            mockPrismaService.$transaction.mockResolvedValue([]);

            const result = await service.respondToInvitation(mockUserId, mockInvitationId, true);

            expect(mockPrismaService.$transaction).toHaveBeenCalled();
            expect(result.status).toBe(InvitationStatus.ACCEPTED);
            expect(mockMailService.sendInvitationResponse).toHaveBeenCalledWith('owner@example.com', 'Jane Doe', 'My Home', true);
        });

        it('should decline an invitation', async () => {
            const mockDeclined = { ...mockUpdatedInvitation, status: InvitationStatus.DECLINED };
            mockPrismaService.householdInvitation.findUnique.mockResolvedValueOnce(mockInvitation).mockResolvedValueOnce(mockDeclined);

            const result = await service.respondToInvitation(mockUserId, mockInvitationId, false);

            expect(mockPrismaService.householdInvitation.update).toHaveBeenCalledWith({
                where: { id: mockInvitationId },
                data: { status: InvitationStatus.DECLINED, respondedAt: expect.any(Date) },
            });
            expect(result.status).toBe(InvitationStatus.DECLINED);
        });

        it('should throw NotFoundException if invitation not found', async () => {
            mockPrismaService.householdInvitation.findUnique.mockResolvedValue(null);

            try {
                await service.respondToInvitation(mockUserId, 'bad-id', true);
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error: any) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('Invitation not found');
            }
        });

        it('should throw ForbiddenException if user is not the target', async () => {
            mockPrismaService.householdInvitation.findUnique.mockResolvedValue(mockInvitation);

            try {
                await service.respondToInvitation('wrong-user', mockInvitationId, true);
                expect.unreachable('Should have thrown ForbiddenException');
            } catch (error: any) {
                expect(error).toBeInstanceOf(ForbiddenException);
                expect(error.message).toBe('You are not authorized to respond to this invitation');
            }
        });

        it('should throw ConflictException if already responded', async () => {
            mockPrismaService.householdInvitation.findUnique.mockResolvedValue({
                ...mockInvitation,
                status: InvitationStatus.ACCEPTED,
            });

            try {
                await service.respondToInvitation(mockUserId, mockInvitationId, true);
                expect.unreachable('Should have thrown ConflictException');
            } catch (error: any) {
                expect(error).toBeInstanceOf(ConflictException);
                expect(error.message).toBe('This invitation has already been responded to');
            }
        });

        it('should throw ConflictException if household full when accepting', async () => {
            mockPrismaService.householdInvitation.findUnique.mockResolvedValue({
                ...mockInvitation,
                household: { ...mockInvitation.household, maxMembers: 1 },
            });

            try {
                await service.respondToInvitation(mockUserId, mockInvitationId, true);
                expect.unreachable('Should have thrown ConflictException');
            } catch (error: any) {
                expect(error).toBeInstanceOf(ConflictException);
                expect(error.message).toBe('Household is full');
            }
        });

        it('should throw ConflictException if joining user already in household', async () => {
            mockPrismaService.householdInvitation.findUnique.mockResolvedValue(mockInvitation);
            mockPrismaService.householdMember.findUnique.mockResolvedValue({ userId: mockUserId });

            try {
                await service.respondToInvitation(mockUserId, mockInvitationId, true);
                expect.unreachable('Should have thrown ConflictException');
            } catch (error: any) {
                expect(error).toBeInstanceOf(ConflictException);
                expect(error.message).toBe('The joining user already belongs to a household');
            }
        });

        it('should throw ConflictException when accepting and household is at capacity', async () => {
            // Boundary: household has 2 members and maxMembers is 2 → exactly full
            mockPrismaService.householdInvitation.findUnique.mockResolvedValue({
                ...mockInvitation,
                household: {
                    ...mockInvitation.household,
                    maxMembers: 2,
                    members: [{ userId: mockOwnerId }, { userId: 'member-2' }],
                },
            });

            try {
                await service.respondToInvitation(mockUserId, mockInvitationId, true);
                expect.unreachable('Should have thrown ConflictException');
            } catch (error: any) {
                expect(error).toBeInstanceOf(ConflictException);
                expect(error.message).toBe('Household is full');
            }
        });

        it('should allow declining when household is full (declining does not need room)', async () => {
            // Edge case: household full but user declines → should succeed, no room needed
            const mockDeclined = { ...mockUpdatedInvitation, status: InvitationStatus.DECLINED };
            mockPrismaService.householdInvitation.findUnique
                .mockResolvedValueOnce({
                    ...mockInvitation,
                    household: { ...mockInvitation.household, maxMembers: 1 },
                })
                .mockResolvedValueOnce(mockDeclined);

            const result = await service.respondToInvitation(mockUserId, mockInvitationId, false);

            expect(result.status).toBe(InvitationStatus.DECLINED);
            expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
        });
    });

    // ─── getPendingInvitations ──────────────────────────────

    describe('getPendingInvitations', () => {
        it('should return pending invitations for user', async () => {
            const mockInvitations = [
                {
                    id: 'inv-1',
                    status: InvitationStatus.PENDING,
                    householdId: mockHouseholdId,
                    senderId: mockOwnerId,
                    targetUserId: mockUserId,
                    createdAt: new Date(),
                    respondedAt: null,
                    household: { name: 'Home 1' },
                    sender: { firstName: 'John', lastName: 'Doe' },
                    targetUser: { firstName: 'Jane', lastName: 'Doe' },
                },
            ];
            mockPrismaService.householdInvitation.findMany.mockResolvedValue(mockInvitations);

            const result = await service.getPendingInvitations(mockUserId);

            expect(result).toHaveLength(1);
            expect(result[0].householdName).toBe('Home 1');
        });

        it('should return empty array when no pending invitations', async () => {
            mockPrismaService.householdInvitation.findMany.mockResolvedValue([]);

            const result = await service.getPendingInvitations(mockUserId);

            expect(result).toHaveLength(0);
        });
    });

    describe('cancelInvitation', () => {
        it('should cancel a pending invitation', async () => {
            mockPrismaService.householdInvitation.findUnique.mockResolvedValue({
                id: mockInvitationId,
                senderId: mockOwnerId,
                status: InvitationStatus.PENDING,
            });
            mockPrismaService.householdInvitation.update.mockResolvedValue({});

            const result = await service.cancelInvitation(mockOwnerId, mockInvitationId);

            expect(result.message).toContain('cancelled');
            expect(mockPrismaService.householdInvitation.update).toHaveBeenCalledWith({
                where: { id: mockInvitationId },
                data: { status: InvitationStatus.CANCELLED, respondedAt: expect.any(Date) },
            });
        });

        it('should throw NotFoundException if invitation not found', async () => {
            mockPrismaService.householdInvitation.findUnique.mockResolvedValue(null);

            try {
                await service.cancelInvitation(mockOwnerId, 'bad-id');
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error: any) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('Invitation not found');
            }
        });

        it('should throw ForbiddenException if not the sender', async () => {
            mockPrismaService.householdInvitation.findUnique.mockResolvedValue({
                id: mockInvitationId,
                senderId: 'other-user',
                status: InvitationStatus.PENDING,
            });

            try {
                await service.cancelInvitation(mockOwnerId, mockInvitationId);
                expect.unreachable('Should have thrown ForbiddenException');
            } catch (error: any) {
                expect(error).toBeInstanceOf(ForbiddenException);
                expect(error.message).toBe('You can only cancel invitations you sent');
            }
        });

        it('should throw ConflictException if invitation is ACCEPTED (not pending)', async () => {
            mockPrismaService.householdInvitation.findUnique.mockResolvedValue({
                id: mockInvitationId,
                senderId: mockOwnerId,
                status: InvitationStatus.ACCEPTED,
            });

            try {
                await service.cancelInvitation(mockOwnerId, mockInvitationId);
                expect.unreachable('Should have thrown ConflictException');
            } catch (error: any) {
                expect(error).toBeInstanceOf(ConflictException);
                expect(error.message).toBe('Only pending invitations can be cancelled');
            }
        });

        it('should throw ConflictException if invitation is DECLINED (not pending)', async () => {
            // Boundary: DECLINED status should also be rejected, not just ACCEPTED
            mockPrismaService.householdInvitation.findUnique.mockResolvedValue({
                id: mockInvitationId,
                senderId: mockOwnerId,
                status: InvitationStatus.DECLINED,
            });

            try {
                await service.cancelInvitation(mockOwnerId, mockInvitationId);
                expect.unreachable('Should have thrown ConflictException');
            } catch (error: any) {
                expect(error).toBeInstanceOf(ConflictException);
                expect(error.message).toBe('Only pending invitations can be cancelled');
            }
        });
    });
});
