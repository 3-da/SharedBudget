import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SalaryService } from './salary.service';
import { PrismaService } from '../prisma/prisma.service';

describe('SalaryService', () => {
    let service: SalaryService;

    const mockUserId = 'user-123';
    const mockHouseholdId = 'household-456';
    const mockSalaryId = 'salary-789';

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const mockSalaryRecord = {
        id: mockSalaryId,
        userId: mockUserId,
        householdId: mockHouseholdId,
        defaultAmount: { toNumber: () => 3500.0, valueOf: () => 3500.0 },
        currentAmount: { toNumber: () => 3500.0, valueOf: () => 3500.0 },
        month: currentMonth,
        year: currentYear,
        createdAt: now,
        updatedAt: now,
        user: { firstName: 'John', lastName: 'Doe' },
    };

    const mockPrismaService = {
        salary: {
            findUnique: vi.fn(),
            findMany: vi.fn(),
            upsert: vi.fn(),
        },
        householdMember: {
            findUnique: vi.fn(),
        },
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [SalaryService, { provide: PrismaService, useValue: mockPrismaService }],
        }).compile();

        service = module.get<SalaryService>(SalaryService);

        vi.clearAllMocks();
    });

    describe('getMySalary', () => {
        it('should return salary for current month', async () => {
            mockPrismaService.salary.findUnique.mockResolvedValue(mockSalaryRecord);

            const result = await service.getMySalary(mockUserId);

            expect(mockPrismaService.salary.findUnique).toHaveBeenCalledWith({
                where: { userId_month_year: { userId: mockUserId, month: currentMonth, year: currentYear } },
                include: { user: { select: { firstName: true, lastName: true } } },
            });
            expect(result.id).toBe(mockSalaryId);
            expect(result.firstName).toBe('John');
            expect(result.lastName).toBe('Doe');
            expect(result.defaultAmount).toBe(3500.0);
            expect(result.currentAmount).toBe(3500.0);
        });

        it('should throw NotFoundException with correct message when no salary exists', async () => {
            mockPrismaService.salary.findUnique.mockResolvedValue(null);

            await expect(service.getMySalary(mockUserId)).rejects.toThrow(NotFoundException);
            await expect(service.getMySalary(mockUserId)).rejects.toThrow('No salary record found for current month');
        });

        it('should correctly map Decimal fields to numbers in response', async () => {
            const salaryWithDecimals = {
                ...mockSalaryRecord,
                defaultAmount: { valueOf: () => 0 },
                currentAmount: { valueOf: () => 0 },
            };
            mockPrismaService.salary.findUnique.mockResolvedValue(salaryWithDecimals);

            const result = await service.getMySalary(mockUserId);

            expect(result.defaultAmount).toBe(0);
            expect(result.currentAmount).toBe(0);
            expect(typeof result.defaultAmount).toBe('number');
            expect(typeof result.currentAmount).toBe('number');
        });
    });

    describe('upsertMySalary', () => {
        const dto = { defaultAmount: 4000, currentAmount: 3800 };

        it('should create a new salary when none exists', async () => {
            mockPrismaService.householdMember.findUnique.mockResolvedValue({
                userId: mockUserId,
                householdId: mockHouseholdId,
            });
            mockPrismaService.salary.upsert.mockResolvedValue({
                ...mockSalaryRecord,
                defaultAmount: { valueOf: () => 4000 },
                currentAmount: { valueOf: () => 3800 },
            });

            const result = await service.upsertMySalary(mockUserId, dto);

            expect(mockPrismaService.householdMember.findUnique).toHaveBeenCalledWith({
                where: { userId: mockUserId },
            });
            expect(mockPrismaService.salary.upsert).toHaveBeenCalledWith({
                where: { userId_month_year: { userId: mockUserId, month: currentMonth, year: currentYear } },
                create: {
                    userId: mockUserId,
                    householdId: mockHouseholdId,
                    defaultAmount: 4000,
                    currentAmount: 3800,
                    month: currentMonth,
                    year: currentYear,
                },
                update: {
                    defaultAmount: 4000,
                    currentAmount: 3800,
                },
                include: { user: { select: { firstName: true, lastName: true } } },
            });
            expect(result.defaultAmount).toBe(4000);
            expect(result.currentAmount).toBe(3800);
        });

        it('should update an existing salary', async () => {
            mockPrismaService.householdMember.findUnique.mockResolvedValue({
                userId: mockUserId,
                householdId: mockHouseholdId,
            });
            mockPrismaService.salary.upsert.mockResolvedValue({
                ...mockSalaryRecord,
                defaultAmount: { valueOf: () => 5000 },
                currentAmount: { valueOf: () => 4500 },
            });

            const result = await service.upsertMySalary(mockUserId, { defaultAmount: 5000, currentAmount: 4500 });

            expect(result.defaultAmount).toBe(5000);
            expect(result.currentAmount).toBe(4500);
        });

        it('should throw NotFoundException with correct message when user not in a household', async () => {
            mockPrismaService.householdMember.findUnique.mockResolvedValue(null);

            await expect(service.upsertMySalary(mockUserId, dto)).rejects.toThrow(NotFoundException);
            await expect(service.upsertMySalary(mockUserId, dto)).rejects.toThrow('You must be in a household to set a salary');
            expect(mockPrismaService.salary.upsert).not.toHaveBeenCalled();
        });

        it('should handle zero amounts as valid salary values', async () => {
            mockPrismaService.householdMember.findUnique.mockResolvedValue({
                userId: mockUserId,
                householdId: mockHouseholdId,
            });
            mockPrismaService.salary.upsert.mockResolvedValue({
                ...mockSalaryRecord,
                defaultAmount: { valueOf: () => 0 },
                currentAmount: { valueOf: () => 0 },
            });

            const result = await service.upsertMySalary(mockUserId, { defaultAmount: 0, currentAmount: 0 });

            expect(result.defaultAmount).toBe(0);
            expect(result.currentAmount).toBe(0);
        });

        it('should handle large salary amounts', async () => {
            mockPrismaService.householdMember.findUnique.mockResolvedValue({
                userId: mockUserId,
                householdId: mockHouseholdId,
            });
            mockPrismaService.salary.upsert.mockResolvedValue({
                ...mockSalaryRecord,
                defaultAmount: { valueOf: () => 9999999999.99 },
                currentAmount: { valueOf: () => 9999999999.99 },
            });

            const result = await service.upsertMySalary(mockUserId, { defaultAmount: 9999999999.99, currentAmount: 9999999999.99 });

            expect(result.defaultAmount).toBe(9999999999.99);
            expect(result.currentAmount).toBe(9999999999.99);
        });
    });

    describe('getHouseholdSalaries', () => {
        it('should return all salaries for household in current month', async () => {
            const secondSalary = {
                ...mockSalaryRecord,
                id: 'salary-other',
                userId: 'user-other',
                defaultAmount: { valueOf: () => 2500 },
                currentAmount: { valueOf: () => 2500 },
                user: { firstName: 'Jane', lastName: 'Smith' },
            };

            mockPrismaService.householdMember.findUnique.mockResolvedValue({
                userId: mockUserId,
                householdId: mockHouseholdId,
            });
            mockPrismaService.salary.findMany.mockResolvedValue([mockSalaryRecord, secondSalary]);

            const result = await service.getHouseholdSalaries(mockUserId);

            expect(mockPrismaService.salary.findMany).toHaveBeenCalledWith({
                where: { householdId: mockHouseholdId, month: currentMonth, year: currentYear },
                include: { user: { select: { firstName: true, lastName: true } } },
            });
            expect(result).toHaveLength(2);
            expect(result[0].firstName).toBe('John');
            expect(result[1].firstName).toBe('Jane');
        });

        it('should throw NotFoundException with correct message when user not in a household', async () => {
            mockPrismaService.householdMember.findUnique.mockResolvedValue(null);

            await expect(service.getHouseholdSalaries(mockUserId)).rejects.toThrow(NotFoundException);
            await expect(service.getHouseholdSalaries(mockUserId)).rejects.toThrow('You are not a member of any household');
        });

        it('should return empty array when no salaries set yet', async () => {
            mockPrismaService.householdMember.findUnique.mockResolvedValue({
                userId: mockUserId,
                householdId: mockHouseholdId,
            });
            mockPrismaService.salary.findMany.mockResolvedValue([]);

            const result = await service.getHouseholdSalaries(mockUserId);

            expect(result).toEqual([]);
        });
    });

    describe('getHouseholdSalariesByMonth', () => {
        it('should return salaries for a specific month and year', async () => {
            mockPrismaService.householdMember.findUnique.mockResolvedValue({
                userId: mockUserId,
                householdId: mockHouseholdId,
            });
            mockPrismaService.salary.findMany.mockResolvedValue([mockSalaryRecord]);

            const result = await service.getHouseholdSalariesByMonth(mockUserId, 2026, 3);

            expect(mockPrismaService.salary.findMany).toHaveBeenCalledWith({
                where: { householdId: mockHouseholdId, month: 3, year: 2026 },
                include: { user: { select: { firstName: true, lastName: true } } },
            });
            expect(result).toHaveLength(1);
        });

        it('should throw NotFoundException with correct message when user not in a household', async () => {
            mockPrismaService.householdMember.findUnique.mockResolvedValue(null);

            await expect(service.getHouseholdSalariesByMonth(mockUserId, 2026, 3)).rejects.toThrow(NotFoundException);
            await expect(service.getHouseholdSalariesByMonth(mockUserId, 2026, 3)).rejects.toThrow('You are not a member of any household');
        });

        it('should pass month and year parameters directly to Prisma query', async () => {
            mockPrismaService.householdMember.findUnique.mockResolvedValue({
                userId: mockUserId,
                householdId: mockHouseholdId,
            });
            mockPrismaService.salary.findMany.mockResolvedValue([]);

            await service.getHouseholdSalariesByMonth(mockUserId, 2025, 1);

            expect(mockPrismaService.salary.findMany).toHaveBeenCalledWith({
                where: { householdId: mockHouseholdId, month: 1, year: 2025 },
                include: { user: { select: { firstName: true, lastName: true } } },
            });
        });

        it('should handle boundary month value of 12 (December)', async () => {
            mockPrismaService.householdMember.findUnique.mockResolvedValue({
                userId: mockUserId,
                householdId: mockHouseholdId,
            });
            mockPrismaService.salary.findMany.mockResolvedValue([mockSalaryRecord]);

            const result = await service.getHouseholdSalariesByMonth(mockUserId, 2026, 12);

            expect(mockPrismaService.salary.findMany).toHaveBeenCalledWith({
                where: { householdId: mockHouseholdId, month: 12, year: 2026 },
                include: { user: { select: { firstName: true, lastName: true } } },
            });
            expect(result).toHaveLength(1);
        });

        it('should return empty array for a month with no salary records', async () => {
            mockPrismaService.householdMember.findUnique.mockResolvedValue({
                userId: mockUserId,
                householdId: mockHouseholdId,
            });
            mockPrismaService.salary.findMany.mockResolvedValue([]);

            const result = await service.getHouseholdSalariesByMonth(mockUserId, 2020, 6);

            expect(result).toEqual([]);
        });
    });
});
