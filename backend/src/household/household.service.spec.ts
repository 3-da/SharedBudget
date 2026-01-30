import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { HouseholdService } from './household.service';
import { PrismaService } from '../prisma/prisma.service';
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
        },
        householdMember: {
            findUnique: vi.fn(),
            create: vi.fn(),
        },
        $transaction: vi.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [HouseholdService, { provide: PrismaService, useValue: mockPrismaService }],
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

            await expect(service.createHousehold(mockUserId, 'My Home')).rejects.toThrow(ConflictException);
            expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
        });
    });

    describe('joinHousehold', () => {
        it('should join a household and return it with members', async () => {
            const householdWithOneMember = {
                ...mockHouseholdWithMembers,
                members: [mockHouseholdWithMembers.members[0]],
            };

            mockPrismaService.householdMember.findUnique.mockResolvedValue(null);
            mockPrismaService.household.findUnique
                .mockResolvedValueOnce(householdWithOneMember) // findUnique by inviteCode
                .mockResolvedValueOnce({
                    // findHouseholdWithMembers after join
                    ...mockHouseholdWithMembers,
                    members: [
                        ...mockHouseholdWithMembers.members,
                        {
                            id: 'member-2',
                            userId: 'user-789',
                            householdId: mockHouseholdId,
                            role: HouseholdRole.MEMBER,
                            joinedAt: new Date(),
                            user: { firstName: 'Jane', lastName: 'Doe' },
                        },
                    ],
                });
            mockPrismaService.householdMember.create.mockResolvedValue({});

            const result = await service.joinHousehold('user-789', mockInviteCode);

            expect(mockPrismaService.householdMember.create).toHaveBeenCalledWith({
                data: {
                    userId: 'user-789',
                    householdId: mockHouseholdId,
                    role: HouseholdRole.MEMBER,
                },
            });
            expect(result.members).toHaveLength(2);
        });

        it('should throw ConflictException if user already in a household', async () => {
            mockPrismaService.householdMember.findUnique.mockResolvedValue({
                id: 'member-1',
                userId: mockUserId,
            });

            await expect(service.joinHousehold(mockUserId, mockInviteCode)).rejects.toThrow(ConflictException);
        });

        it('should throw NotFoundException if invite code is invalid', async () => {
            mockPrismaService.householdMember.findUnique.mockResolvedValue(null);
            mockPrismaService.household.findUnique.mockResolvedValue(null);

            await expect(service.joinHousehold(mockUserId, 'bad-code')).rejects.toThrow(NotFoundException);
        });

        it('should throw ConflictException if household is full', async () => {
            const fullHousehold = {
                ...mockHouseholdWithMembers,
                maxMembers: 1,
                members: [mockHouseholdWithMembers.members[0]],
            };

            mockPrismaService.householdMember.findUnique.mockResolvedValue(null);
            mockPrismaService.household.findUnique.mockResolvedValue(fullHousehold);

            await expect(service.joinHousehold('user-789', mockInviteCode)).rejects.toThrow(ConflictException);
            expect(mockPrismaService.householdMember.create).not.toHaveBeenCalled();
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

            await expect(service.getMyHousehold(mockUserId)).rejects.toThrow(NotFoundException);
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

            expect(mockPrismaService.household.update).toHaveBeenCalledWith({
                where: { id: mockHouseholdId },
                data: { inviteCode: expect.any(String) },
            });
            expect(result.id).toBe(mockHouseholdId);
        });

        it('should throw NotFoundException if user has no household', async () => {
            mockPrismaService.householdMember.findUnique.mockResolvedValue(null);

            await expect(service.regenerateInviteCode(mockUserId)).rejects.toThrow(NotFoundException);
        });

        it('should throw ForbiddenException if user is not OWNER', async () => {
            mockPrismaService.householdMember.findUnique.mockResolvedValue({
                id: 'member-2',
                userId: mockUserId,
                householdId: mockHouseholdId,
                role: HouseholdRole.MEMBER,
            });

            await expect(service.regenerateInviteCode(mockUserId)).rejects.toThrow(ForbiddenException);
            expect(mockPrismaService.household.update).not.toHaveBeenCalled();
        });
    });
});
