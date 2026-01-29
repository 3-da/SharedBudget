import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { HouseholdController } from './household.controller';
import { HouseholdService } from './household.service';
import { HouseholdRole } from '@prisma/client';
import { HouseholdResponseDto } from './dto/household-response.dto';

describe('HouseholdController', () => {
    let controller: HouseholdController;
    let householdService: HouseholdService;

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

    const mockHouseholdService = {
        createHousehold: vi.fn(() => Promise.resolve(mockHouseholdResponse)),
        joinHousehold: vi.fn(() => Promise.resolve(mockHouseholdResponse)),
        getMyHousehold: vi.fn(() => Promise.resolve(mockHouseholdResponse)),
        regenerateInviteCode: vi.fn(() => Promise.resolve(mockHouseholdResponse)),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [HouseholdController],
            providers: [{ provide: HouseholdService, useValue: mockHouseholdService }],
        }).compile();

        controller = module.get<HouseholdController>(HouseholdController);
        householdService = module.get<HouseholdService>(HouseholdService);

        vi.clearAllMocks();
    });

    describe('create', () => {
        it('should call householdService.createHousehold and return household', async () => {
            const result = await controller.create(mockUserId, { name: 'My Home' });

            expect(householdService.createHousehold).toHaveBeenCalledWith(mockUserId, 'My Home');
            expect(householdService.createHousehold).toHaveBeenCalledTimes(1);
            expect(result.id).toBe('household-456');
            expect(result.members).toHaveLength(1);
        });
    });

    describe('join', () => {
        it('should call householdService.joinHousehold and return household', async () => {
            const result = await controller.join(mockUserId, { inviteCode: 'abcd1234' });

            expect(householdService.joinHousehold).toHaveBeenCalledWith(mockUserId, 'abcd1234');
            expect(householdService.joinHousehold).toHaveBeenCalledTimes(1);
            expect(result.id).toBe('household-456');
        });
    });

    describe('getMine', () => {
        it('should call householdService.getMyHousehold and return household', async () => {
            const result = await controller.getMine(mockUserId);

            expect(householdService.getMyHousehold).toHaveBeenCalledWith(mockUserId);
            expect(householdService.getMyHousehold).toHaveBeenCalledTimes(1);
            expect(result.name).toBe('My Home');
        });
    });

    describe('regenerateCode', () => {
        it('should call householdService.regenerateInviteCode and return household', async () => {
            const result = await controller.regenerateCode(mockUserId);

            expect(householdService.regenerateInviteCode).toHaveBeenCalledWith(mockUserId);
            expect(householdService.regenerateInviteCode).toHaveBeenCalledTimes(1);
            expect(result.inviteCode).toBe('abcd1234');
        });
    });
});
