import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SalaryController } from './salary.controller';
import { SalaryService } from './salary.service';
import { SalaryResponseDto } from './dto/salary-response.dto';

describe('SalaryController', () => {
    let controller: SalaryController;
    let salaryService: SalaryService;

    const mockUserId = 'user-123';

    const mockSalaryResponse: SalaryResponseDto = {
        id: 'salary-789',
        userId: mockUserId,
        firstName: 'John',
        lastName: 'Doe',
        defaultAmount: 3500,
        currentAmount: 3500,
        month: 6,
        year: 2026,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    const mockSalaryService = {
        getMySalary: vi.fn(() => Promise.resolve(mockSalaryResponse)),
        upsertMySalary: vi.fn(() => Promise.resolve(mockSalaryResponse)),
        getHouseholdSalaries: vi.fn(() => Promise.resolve([mockSalaryResponse])),
        getHouseholdSalariesByMonth: vi.fn(() => Promise.resolve([mockSalaryResponse])),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [SalaryController],
            providers: [{ provide: SalaryService, useValue: mockSalaryService }],
        }).compile();

        controller = module.get<SalaryController>(SalaryController);
        salaryService = module.get<SalaryService>(SalaryService);

        vi.clearAllMocks();
    });

    describe('getMySalary', () => {
        it('should call salaryService.getMySalary and return salary', async () => {
            const result = await controller.getMySalary(mockUserId);

            expect(salaryService.getMySalary).toHaveBeenCalledWith(mockUserId);
            expect(result.id).toBe('salary-789');
            expect(result.defaultAmount).toBe(3500);
        });

        it('should propagate NotFoundException from service', async () => {
            mockSalaryService.getMySalary.mockRejectedValue(new NotFoundException('No salary record found for current month'));

            await expect(controller.getMySalary(mockUserId)).rejects.toThrow(NotFoundException);
            await expect(controller.getMySalary(mockUserId)).rejects.toThrow('No salary record found for current month');
        });
    });

    describe('upsertMySalary', () => {
        it('should call salaryService.upsertMySalary and return salary', async () => {
            const dto = { defaultAmount: 4000, currentAmount: 3800 };
            const result = await controller.upsertMySalary(mockUserId, dto);

            expect(salaryService.upsertMySalary).toHaveBeenCalledWith(mockUserId, dto);
            expect(result.id).toBe('salary-789');
        });

        it('should propagate NotFoundException when user not in household', async () => {
            mockSalaryService.upsertMySalary.mockRejectedValue(new NotFoundException('You must be in a household to set a salary'));
            const dto = { defaultAmount: 4000, currentAmount: 3800 };

            await expect(controller.upsertMySalary(mockUserId, dto)).rejects.toThrow(NotFoundException);
            await expect(controller.upsertMySalary(mockUserId, dto)).rejects.toThrow('You must be in a household to set a salary');
        });
    });

    describe('getHouseholdSalaries', () => {
        it('should call salaryService.getHouseholdSalaries and return array', async () => {
            const result = await controller.getHouseholdSalaries(mockUserId);

            expect(salaryService.getHouseholdSalaries).toHaveBeenCalledWith(mockUserId);
            expect(result).toHaveLength(1);
            expect(result[0].firstName).toBe('John');
        });

        it('should propagate NotFoundException when user not in household', async () => {
            mockSalaryService.getHouseholdSalaries.mockRejectedValue(new NotFoundException('You are not a member of any household'));

            await expect(controller.getHouseholdSalaries(mockUserId)).rejects.toThrow(NotFoundException);
            await expect(controller.getHouseholdSalaries(mockUserId)).rejects.toThrow('You are not a member of any household');
        });
    });

    describe('getHouseholdSalariesByMonth', () => {
        it('should call salaryService.getHouseholdSalariesByMonth with parsed params', async () => {
            const result = await controller.getHouseholdSalariesByMonth(mockUserId, 2026, 3);

            expect(salaryService.getHouseholdSalariesByMonth).toHaveBeenCalledWith(mockUserId, 2026, 3);
            expect(result).toHaveLength(1);
        });

        it('should propagate NotFoundException when user not in household', async () => {
            mockSalaryService.getHouseholdSalariesByMonth.mockRejectedValue(new NotFoundException('You are not a member of any household'));

            await expect(controller.getHouseholdSalariesByMonth(mockUserId, 2026, 3)).rejects.toThrow(NotFoundException);
            await expect(controller.getHouseholdSalariesByMonth(mockUserId, 2026, 3)).rejects.toThrow('You are not a member of any household');
        });

        it('should pass month boundary values to service', async () => {
            mockSalaryService.getHouseholdSalariesByMonth.mockResolvedValue([mockSalaryResponse]);

            await controller.getHouseholdSalariesByMonth(mockUserId, 2026, 1);
            expect(salaryService.getHouseholdSalariesByMonth).toHaveBeenCalledWith(mockUserId, 2026, 1);

            vi.clearAllMocks();
            mockSalaryService.getHouseholdSalariesByMonth.mockResolvedValue([mockSalaryResponse]);

            await controller.getHouseholdSalariesByMonth(mockUserId, 2026, 12);
            expect(salaryService.getHouseholdSalariesByMonth).toHaveBeenCalledWith(mockUserId, 2026, 12);
        });
    });
});
