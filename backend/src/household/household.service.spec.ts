import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { HouseholdService } from './household.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { HouseholdRole } from '../generated/prisma/enums';

describe('HouseholdService', () => {
    let service: HouseholdService;

    const mockUserId = 'user-123';
    const mockHouseholdId = 'household-456';
    const mockInviteCode = 'abcd1234';

    const mockHouseholdWithMembers = {
        id: mockHouseholdId,
        name: 'My Home',
        inviteCode: mockInviteCode,
        maxMembers: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
        members: [
            {
                id: 'member-1',
                userId: mockUserId,
                householdId: mockHouseholdId,
                role: HouseholdRole.OWNER,
                joinedAt: new Date(),
                user: { firstName: 'John', lastName: 'Doe' },
            },
        ],
    };

    const mockPrismaService = {
        household: {
            create: vi.fn(),
            findUnique: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
        },
        householdMember: {
            findUnique: vi.fn(),
            create: vi.fn(),
            delete: vi.fn(),
            update: vi.fn(),
        },
        $transaction: vi.fn(),
    };

    const mockMailService = {
        sendMemberRemoved: vi.fn().mockResolvedValue(undefined),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [HouseholdService, { provide: PrismaService, useValue: mockPrismaService }, { provide: MailService, useValue: mockMailService }],
        }).compile();

        service = module.get<HouseholdService>(HouseholdService);

        vi.clearAllMocks();
    });

    describe('createHousehold', () => {
        it('should create a household and return it with members', async () => {
            mockPrismaService.householdMember.findUnique.mockResolvedValue(null);
            mockPrismaService.$transaction.mockResolvedValue({ id: mockHouseholdId });
            mockPrismaService.household.findUnique.mockResolvedValue(mockHouseholdWithMembers);

            const result = await service.createHousehold(mockUserId, 'My Home');

            expect(mockPrismaService.householdMember.findUnique).toHaveBeenCalledWith({ where: { userId: mockUserId } });
            expect(mockPrismaService.$transaction).toHaveBeenCalled();
            expect(mockPrismaService.household.findUnique).toHaveBeenCalledWith({
                where: { id: mockHouseholdId },
                include: {
                    members: {
                        include: { user: { select: { firstName: true, lastName: true } } },
                    },
                },
            });
            expect(result.id).toBe(mockHouseholdId);
            expect(result.name).toBe('My Home');
            expect(result.members).toHaveLength(1);
            expect(result.members[0].role).toBe(HouseholdRole.OWNER);
        });

        it('should throw ConflictException if user already in a household', async () => {
            mockPrismaService.householdMember.findUnique.mockResolvedValue({
                id: 'member-1',
                userId: mockUserId,
                householdId: mockHouseholdId,
                role: HouseholdRole.OWNER,
            });

            try {
                await service.createHousehold(mockUserId, 'My Home');
                expect.unreachable('Should have thrown ConflictException');
            } catch (error) {
                expect(error).toBeInstanceOf(ConflictException);
                expect(error.message).toBe('User already belongs to a household');
            }
            expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
        });
    });

    describe('getMyHousehold', () => {
        it('should return the household with members', async () => {
            mockPrismaService.householdMember.findUnique.mockResolvedValue({
                id: 'member-1',
                userId: mockUserId,
                household: mockHouseholdWithMembers,
            });

            const result = await service.getMyHousehold(mockUserId);

            expect(result.id).toBe(mockHouseholdId);
            expect(result.members[0].firstName).toBe('John');
            expect(result.members[0].lastName).toBe('Doe');
        });

        it('should throw NotFoundException if user has no household', async () => {
            mockPrismaService.householdMember.findUnique.mockResolvedValue(null);

            try {
                await service.getMyHousehold(mockUserId);
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('User is not a member of any household');
            }
        });
    });

    describe('regenerateInviteCode', () => {
        it('should regenerate invite code and return updated household', async () => {
            mockPrismaService.householdMember.findUnique.mockResolvedValue({
                id: 'member-1',
                userId: mockUserId,
                householdId: mockHouseholdId,
                role: HouseholdRole.OWNER,
            });
            mockPrismaService.household.update.mockResolvedValue({});
            mockPrismaService.household.findUnique.mockResolvedValue(mockHouseholdWithMembers);

            const result = await service.regenerateInviteCode(mockUserId);

            expect(mockPrismaService.household.update).toHaveBeenCalledWith({ where: { id: mockHouseholdId }, data: { inviteCode: expect.any(String) } });
            expect(result.id).toBe(mockHouseholdId);
        });

        it('should throw NotFoundException if user has no household', async () => {
            mockPrismaService.householdMember.findUnique.mockResolvedValue(null);

            try {
                await service.regenerateInviteCode(mockUserId);
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('User is not a member of any household');
            }
        });

        it('should throw ForbiddenException if user is not OWNER', async () => {
            mockPrismaService.householdMember.findUnique.mockResolvedValue({
                id: 'member-2',
                userId: mockUserId,
                householdId: mockHouseholdId,
                role: HouseholdRole.MEMBER,
            });

            try {
                await service.regenerateInviteCode(mockUserId);
                expect.unreachable('Should have thrown ForbiddenException');
            } catch (error) {
                expect(error).toBeInstanceOf(ForbiddenException);
                expect(error.message).toBe('Only the household owner can regenerate the invite code');
            }
            expect(mockPrismaService.household.update).not.toHaveBeenCalled();
        });
    });

    describe('joinByCode', () => {
        it('should join household and return it with members', async () => {
            mockPrismaService.householdMember.findUnique.mockResolvedValue(null);
            mockPrismaService.household.findUnique
                .mockResolvedValueOnce({
                    id: mockHouseholdId,
                    inviteCode: mockInviteCode,
                    maxMembers: 2,
                    members: [{ userId: 'owner-1', role: HouseholdRole.OWNER }],
                })
                .mockResolvedValueOnce(mockHouseholdWithMembers);
            mockPrismaService.householdMember.create.mockResolvedValue({});

            const result = await service.joinByCode(mockUserId, mockInviteCode);

            expect(mockPrismaService.householdMember.create).toHaveBeenCalledWith({
                data: {
                    userId: mockUserId,
                    householdId: mockHouseholdId,
                    role: HouseholdRole.MEMBER,
                },
            });
            expect(result.id).toBe(mockHouseholdId);
        });

        it('should throw ConflictException if user already in a household', async () => {
            mockPrismaService.householdMember.findUnique.mockResolvedValue({
                userId: mockUserId,
                householdId: mockHouseholdId,
            });

            try {
                await service.joinByCode(mockUserId, mockInviteCode);
                expect.unreachable('Should have thrown ConflictException');
            } catch (error) {
                expect(error).toBeInstanceOf(ConflictException);
                expect(error.message).toBe('You already belong to a household');
            }
        });

        it('should throw NotFoundException if invite code is invalid', async () => {
            mockPrismaService.householdMember.findUnique.mockResolvedValue(null);
            mockPrismaService.household.findUnique.mockResolvedValue(null);

            try {
                await service.joinByCode(mockUserId, 'bad-code');
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('Household not found');
            }
        });

        it('should throw ConflictException if household is full (at maxMembers)', async () => {
            mockPrismaService.householdMember.findUnique.mockResolvedValue(null);
            mockPrismaService.household.findUnique.mockResolvedValue({
                id: mockHouseholdId,
                inviteCode: mockInviteCode,
                maxMembers: 1,
                members: [{ userId: 'owner-1', role: HouseholdRole.OWNER }],
            });

            try {
                await service.joinByCode(mockUserId, mockInviteCode);
                expect.unreachable('Should have thrown ConflictException');
            } catch (error) {
                expect(error).toBeInstanceOf(ConflictException);
                expect(error.message).toBe('Household is full');
            }
        });

        it('should allow joining when household has one slot left (maxMembers - 1)', async () => {
            // Boundary: household has 1 member and maxMembers is 2 → 1 slot left → should succeed
            mockPrismaService.householdMember.findUnique.mockResolvedValue(null);
            mockPrismaService.household.findUnique
                .mockResolvedValueOnce({
                    id: mockHouseholdId,
                    inviteCode: mockInviteCode,
                    maxMembers: 2,
                    members: [{ userId: 'owner-1', role: HouseholdRole.OWNER }],
                })
                .mockResolvedValueOnce(mockHouseholdWithMembers);
            mockPrismaService.householdMember.create.mockResolvedValue({});

            const result = await service.joinByCode(mockUserId, mockInviteCode);

            expect(mockPrismaService.householdMember.create).toHaveBeenCalled();
            expect(result.id).toBe(mockHouseholdId);
        });

        it('should throw ConflictException when household is exactly at maxMembers', async () => {
            // Boundary: household has 2 members and maxMembers is 2 → exactly full → should fail
            mockPrismaService.householdMember.findUnique.mockResolvedValue(null);
            mockPrismaService.household.findUnique.mockResolvedValue({
                id: mockHouseholdId,
                inviteCode: mockInviteCode,
                maxMembers: 2,
                members: [
                    { userId: 'owner-1', role: HouseholdRole.OWNER },
                    { userId: 'member-2', role: HouseholdRole.MEMBER },
                ],
            });

            try {
                await service.joinByCode(mockUserId, mockInviteCode);
                expect.unreachable('Should have thrown ConflictException');
            } catch (error) {
                expect(error).toBeInstanceOf(ConflictException);
                expect(error.message).toBe('Household is full');
            }
        });
    });

    describe('leaveHousehold', () => {
        it('should delete household when owner is alone', async () => {
            mockPrismaService.householdMember.findUnique.mockResolvedValue({
                id: 'member-1',
                userId: mockUserId,
                householdId: mockHouseholdId,
                role: HouseholdRole.OWNER,
                household: {
                    ...mockHouseholdWithMembers,
                    members: [mockHouseholdWithMembers.members[0]],
                },
            });
            mockPrismaService.household.delete.mockResolvedValue({});

            const result = await service.leaveHousehold(mockUserId);

            expect(result.message).toContain('deleted');
            expect(mockPrismaService.household.delete).toHaveBeenCalledWith({ where: { id: mockHouseholdId } });
        });

        it('should allow regular member to leave', async () => {
            mockPrismaService.householdMember.findUnique.mockResolvedValue({
                id: 'member-2',
                userId: 'user-789',
                householdId: mockHouseholdId,
                role: HouseholdRole.MEMBER,
                household: {
                    ...mockHouseholdWithMembers,
                    members: [mockHouseholdWithMembers.members[0], { id: 'member-2', userId: 'user-789', role: HouseholdRole.MEMBER }],
                },
            });
            mockPrismaService.householdMember.delete.mockResolvedValue({});

            const result = await service.leaveHousehold('user-789');

            expect(result.message).toContain('left');
            expect(mockPrismaService.householdMember.delete).toHaveBeenCalledWith({ where: { userId: 'user-789' } });
        });

        it('should throw NotFoundException if user has no household', async () => {
            mockPrismaService.householdMember.findUnique.mockResolvedValue(null);

            try {
                await service.leaveHousehold(mockUserId);
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('User is not a member of any household');
            }
        });

        it('should throw ForbiddenException if owner has other members', async () => {
            mockPrismaService.householdMember.findUnique.mockResolvedValue({
                id: 'member-1',
                userId: mockUserId,
                householdId: mockHouseholdId,
                role: HouseholdRole.OWNER,
                household: {
                    ...mockHouseholdWithMembers,
                    members: [mockHouseholdWithMembers.members[0], { id: 'member-2', userId: 'user-789', role: HouseholdRole.MEMBER }],
                },
            });

            try {
                await service.leaveHousehold(mockUserId);
                expect.unreachable('Should have thrown ForbiddenException');
            } catch (error) {
                expect(error).toBeInstanceOf(ForbiddenException);
                expect(error.message).toBe('Owner must transfer ownership before leaving. Use /household/transfer-ownership first.');
            }
            expect(mockPrismaService.householdMember.delete).not.toHaveBeenCalled();
        });
    });

    describe('removeMember', () => {
        it('should remove a member from household and send email notification', async () => {
            mockPrismaService.householdMember.findUnique
                .mockResolvedValueOnce({
                    id: 'member-1',
                    userId: mockUserId,
                    householdId: mockHouseholdId,
                    role: HouseholdRole.OWNER,
                    household: { name: 'My Home' },
                })
                .mockResolvedValueOnce({
                    id: 'member-2',
                    userId: 'user-789',
                    householdId: mockHouseholdId,
                    role: HouseholdRole.MEMBER,
                    user: { email: 'removed@example.com' },
                });
            mockPrismaService.householdMember.delete.mockResolvedValue({});

            const result = await service.removeMember(mockUserId, 'user-789');

            expect(result.message).toContain('removed');
            expect(mockPrismaService.householdMember.delete).toHaveBeenCalledWith({ where: { userId: 'user-789' } });
            expect(mockMailService.sendMemberRemoved).toHaveBeenCalledWith('removed@example.com', 'My Home');
        });

        it('should throw NotFoundException if owner has no household', async () => {
            mockPrismaService.householdMember.findUnique.mockResolvedValue(null);

            try {
                await service.removeMember(mockUserId, 'user-789');
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('You are not a member of any household');
            }
        });

        it('should throw ForbiddenException if user is not owner', async () => {
            mockPrismaService.householdMember.findUnique.mockResolvedValue({
                id: 'member-2',
                userId: mockUserId,
                householdId: mockHouseholdId,
                role: HouseholdRole.MEMBER,
            });

            try {
                await service.removeMember(mockUserId, 'user-789');
                expect.unreachable('Should have thrown ForbiddenException');
            } catch (error) {
                expect(error).toBeInstanceOf(ForbiddenException);
                expect(error.message).toBe('Only the household owner can remove members');
            }
        });

        it('should throw ForbiddenException if owner tries to remove themselves', async () => {
            mockPrismaService.householdMember.findUnique.mockResolvedValue({
                id: 'member-1',
                userId: mockUserId,
                householdId: mockHouseholdId,
                role: HouseholdRole.OWNER,
            });

            try {
                await service.removeMember(mockUserId, mockUserId);
                expect.unreachable('Should have thrown ForbiddenException');
            } catch (error) {
                expect(error).toBeInstanceOf(ForbiddenException);
                expect(error.message).toBe('Cannot remove yourself. Transfer the ownership or leave/delete the household instead.');
            }
        });

        it('should throw NotFoundException if target not in same household', async () => {
            mockPrismaService.householdMember.findUnique
                .mockResolvedValueOnce({
                    id: 'member-1',
                    userId: mockUserId,
                    householdId: mockHouseholdId,
                    role: HouseholdRole.OWNER,
                })
                .mockResolvedValueOnce({
                    id: 'member-3',
                    userId: 'user-789',
                    householdId: 'different-household',
                    role: HouseholdRole.MEMBER,
                });

            try {
                await service.removeMember(mockUserId, 'user-789');
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('Target user is not a member of your household');
            }
        });
    });

    describe('transferOwnership', () => {
        it('should swap roles between owner and target', async () => {
            mockPrismaService.householdMember.findUnique
                .mockResolvedValueOnce({
                    id: 'member-1',
                    userId: mockUserId,
                    householdId: mockHouseholdId,
                    role: HouseholdRole.OWNER,
                })
                .mockResolvedValueOnce({
                    id: 'member-2',
                    userId: 'user-789',
                    householdId: mockHouseholdId,
                    role: HouseholdRole.MEMBER,
                });
            mockPrismaService.householdMember.update.mockReturnValue({});
            mockPrismaService.$transaction.mockResolvedValue([]);
            mockPrismaService.household.findUnique.mockResolvedValue(mockHouseholdWithMembers);

            const result = await service.transferOwnership(mockUserId, 'user-789');

            expect(mockPrismaService.$transaction).toHaveBeenCalled();
            expect(result.id).toBe(mockHouseholdId);
        });

        it('should throw NotFoundException if user has no household', async () => {
            mockPrismaService.householdMember.findUnique.mockResolvedValue(null);

            try {
                await service.transferOwnership(mockUserId, 'user-789');
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('You are not a member of any household');
            }
        });

        it('should throw ForbiddenException if user is not owner', async () => {
            mockPrismaService.householdMember.findUnique.mockResolvedValue({
                id: 'member-2',
                userId: mockUserId,
                householdId: mockHouseholdId,
                role: HouseholdRole.MEMBER,
            });

            try {
                await service.transferOwnership(mockUserId, 'user-789');
                expect.unreachable('Should have thrown ForbiddenException');
            } catch (error) {
                expect(error).toBeInstanceOf(ForbiddenException);
                expect(error.message).toBe('Only the household owner can transfer ownership');
            }
        });

        it('should throw ForbiddenException if transferring to self', async () => {
            mockPrismaService.householdMember.findUnique.mockResolvedValue({
                id: 'member-1',
                userId: mockUserId,
                householdId: mockHouseholdId,
                role: HouseholdRole.OWNER,
            });

            try {
                await service.transferOwnership(mockUserId, mockUserId);
                expect.unreachable('Should have thrown ForbiddenException');
            } catch (error) {
                expect(error).toBeInstanceOf(ForbiddenException);
                expect(error.message).toBe('Cannot transfer ownership to yourself');
            }
        });

        it('should throw NotFoundException if target not in same household', async () => {
            mockPrismaService.householdMember.findUnique
                .mockResolvedValueOnce({
                    id: 'member-1',
                    userId: mockUserId,
                    householdId: mockHouseholdId,
                    role: HouseholdRole.OWNER,
                })
                .mockResolvedValueOnce({
                    id: 'member-3',
                    userId: 'user-789',
                    householdId: 'different-household',
                    role: HouseholdRole.MEMBER,
                });

            try {
                await service.transferOwnership(mockUserId, 'user-789');
                expect.unreachable('Should have thrown NotFoundException');
            } catch (error) {
                expect(error).toBeInstanceOf(NotFoundException);
                expect(error.message).toBe('Target user is not a member of your household');
            }
        });
    });
});
