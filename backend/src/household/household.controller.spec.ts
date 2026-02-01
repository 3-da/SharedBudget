import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { HouseholdController } from './household.controller';
import { HouseholdService } from './household.service';
import { HouseholdInvitationService } from './household-invitation.service';
import { HouseholdRole } from '../generated/prisma/enums';
import { HouseholdResponseDto } from './dto/household-response.dto';

describe('HouseholdController', () => {
    let controller: HouseholdController;
    let householdService: HouseholdService;
    let invitationService: HouseholdInvitationService;

    const mockUserId = 'user-123';

    const mockHouseholdResponse: HouseholdResponseDto = {
        id: 'household-456',
        name: 'My Home',
        inviteCode: 'abcd1234',
        maxMembers: 2,
        createdAt: new Date(),
        members: [
            {
                id: 'member-1',
                userId: mockUserId,
                firstName: 'John',
                lastName: 'Doe',
                role: HouseholdRole.OWNER,
                joinedAt: new Date(),
            },
        ],
    };

    const mockInvitationResponse = {
        id: 'invitation-1',
        status: 'PENDING',
        householdId: 'household-456',
        householdName: 'My Home',
        senderId: mockUserId,
        senderFirstName: 'John',
        senderLastName: 'Doe',
        targetUserId: 'user-789',
        targetFirstName: 'Jane',
        targetLastName: 'Doe',
        createdAt: new Date(),
        respondedAt: null,
    };

    const mockMessageResponse = { message: 'Success' };

    const mockHouseholdService = {
        createHousehold: vi.fn(() => Promise.resolve(mockHouseholdResponse)),
        getMyHousehold: vi.fn(() => Promise.resolve(mockHouseholdResponse)),
        regenerateInviteCode: vi.fn(() => Promise.resolve(mockHouseholdResponse)),
        joinByCode: vi.fn(() => Promise.resolve(mockHouseholdResponse)),
        leaveHousehold: vi.fn(() => Promise.resolve(mockMessageResponse)),
        removeMember: vi.fn(() => Promise.resolve(mockMessageResponse)),
        transferOwnership: vi.fn(() => Promise.resolve(mockHouseholdResponse)),
    };

    const mockInvitationService = {
        inviteToHousehold: vi.fn(() => Promise.resolve(mockInvitationResponse)),
        respondToInvitation: vi.fn(() => Promise.resolve(mockInvitationResponse)),
        getPendingInvitations: vi.fn(() => Promise.resolve([mockInvitationResponse])),
        cancelInvitation: vi.fn(() => Promise.resolve(mockMessageResponse)),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [HouseholdController],
            providers: [
                { provide: HouseholdService, useValue: mockHouseholdService },
                { provide: HouseholdInvitationService, useValue: mockInvitationService },
            ],
        }).compile();

        controller = module.get<HouseholdController>(HouseholdController);
        householdService = module.get<HouseholdService>(HouseholdService);
        invitationService = module.get<HouseholdInvitationService>(HouseholdInvitationService);

        vi.clearAllMocks();
    });

    //#region Household CRUD
    describe('create', () => {
        it('should call householdService.createHousehold and return household', async () => {
            const result = await controller.create(mockUserId, { name: 'My Home' });

            expect(householdService.createHousehold).toHaveBeenCalledWith(mockUserId, 'My Home');
            expect(result.id).toBe('household-456');
        });
    });

    describe('getMine', () => {
        it('should call householdService.getMyHousehold and return household', async () => {
            const result = await controller.getMine(mockUserId);

            expect(householdService.getMyHousehold).toHaveBeenCalledWith(mockUserId);
            expect(result.name).toBe('My Home');
        });
    });

    describe('regenerateCode', () => {
        it('should call householdService.regenerateInviteCode and return household', async () => {
            const result = await controller.regenerateCode(mockUserId);

            expect(householdService.regenerateInviteCode).toHaveBeenCalledWith(mockUserId);
            expect(result.inviteCode).toBe('abcd1234');
        });
    });
    //#endregion

    //#region Invitations & Join Requests
    describe('invite', () => {
        it('should call invitationService.inviteToHousehold', async () => {
            const result = await controller.invite(mockUserId, { email: 'target@example.com' });

            expect(invitationService.inviteToHousehold).toHaveBeenCalledWith(mockUserId, 'target@example.com');
            expect(result.id).toBe('invitation-1');
        });
    });

    describe('joinByCode', () => {
        it('should call householdService.joinByCode', async () => {
            const result = await controller.joinByCode(mockUserId, { inviteCode: 'abcd1234' });

            expect(householdService.joinByCode).toHaveBeenCalledWith(mockUserId, 'abcd1234');
            expect(result.id).toBe('household-456');
        });
    });

    describe('respondToInvitation', () => {
        it('should call invitationService.respondToInvitation', async () => {
            const result = await controller.respondToInvitation(mockUserId, 'invitation-1', { accept: true });

            expect(invitationService.respondToInvitation).toHaveBeenCalledWith(mockUserId, 'invitation-1', true);
            expect(result.id).toBe('invitation-1');
        });
    });

    describe('getPendingInvitations', () => {
        it('should call invitationService.getPendingInvitations', async () => {
            const result = await controller.getPendingInvitations(mockUserId);

            expect(invitationService.getPendingInvitations).toHaveBeenCalledWith(mockUserId);
            expect(result).toHaveLength(1);
        });
    });

    describe('cancelInvitation', () => {
        it('should call invitationService.cancelInvitation', async () => {
            const result = await controller.cancelInvitation(mockUserId, 'invitation-1');

            expect(invitationService.cancelInvitation).toHaveBeenCalledWith(mockUserId, 'invitation-1');
            expect(result.message).toBe('Success');
        });
    });
    //#endregion

    //#region Membership Management
    describe('leave', () => {
        it('should call householdService.leaveHousehold', async () => {
            const result = await controller.leave(mockUserId);

            expect(householdService.leaveHousehold).toHaveBeenCalledWith(mockUserId);
            expect(result.message).toBe('Success');
        });
    });

    describe('removeMember', () => {
        it('should call householdService.removeMember', async () => {
            const result = await controller.removeMember(mockUserId, 'user-789');

            expect(householdService.removeMember).toHaveBeenCalledWith(mockUserId, 'user-789');
            expect(result.message).toBe('Success');
        });
    });

    describe('transferOwnership', () => {
        it('should call householdService.transferOwnership', async () => {
            const result = await controller.transferOwnership(mockUserId, { targetUserId: 'user-789' });

            expect(householdService.transferOwnership).toHaveBeenCalledWith(mockUserId, 'user-789');
            expect(result.id).toBe('household-456');
        });
    });
    //#endregion
});
