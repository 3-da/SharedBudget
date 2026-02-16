import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { DashboardResponseDto } from './dto/dashboard-response.dto';
import { SavingsResponseDto } from './dto/member-savings.dto';
import { SavingsHistoryItemDto } from './dto/savings-history.dto';
import { SettlementResponseDto } from './dto/settlement-response.dto';
import { MarkSettlementPaidResponseDto } from './dto/mark-settlement-paid-response.dto';

describe('DashboardController', () => {
    let controller: DashboardController;
    let dashboardService: DashboardService;

    const mockUserId = 'user-alex';
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const mockDashboardResponse: DashboardResponseDto = {
        income: [
            { userId: 'user-alex', firstName: 'Alex', lastName: 'Owner', defaultSalary: 3500, currentSalary: 3200 },
            { userId: 'user-sam', firstName: 'Sam', lastName: 'Member', defaultSalary: 2500, currentSalary: 2500 },
        ],
        totalDefaultIncome: 6000,
        totalCurrentIncome: 5700,
        expenses: {
            personalExpenses: [
                { userId: 'user-alex', firstName: 'Alex', lastName: 'Owner', personalExpensesTotal: 50, remainingExpenses: 20 },
                { userId: 'user-sam', firstName: 'Sam', lastName: 'Member', personalExpensesTotal: 30, remainingExpenses: 10 },
            ],
            sharedExpensesTotal: 920,
            totalHouseholdExpenses: 1000,
            remainingHouseholdExpenses: 500,
        },
        savings: {
            members: [
                { userId: 'user-alex', firstName: 'Alex', lastName: 'Owner', personalSavings: 500, sharedSavings: 200, remainingBudget: 1990 },
                { userId: 'user-sam', firstName: 'Sam', lastName: 'Member', personalSavings: 300, sharedSavings: 100, remainingBudget: 1610 },
            ],
            totalPersonalSavings: 800,
            totalSharedSavings: 300,
            totalSavings: 1100,
            totalRemainingBudget: 3600,
        },
        settlement: {
            amount: 60,
            owedByUserId: 'user-sam',
            owedByFirstName: 'Sam',
            owedToUserId: 'user-alex',
            owedToFirstName: 'Alex',
            message: 'Sam owes you €60.00',
            isSettled: false,
            month: currentMonth,
            year: currentYear,
        },
        pendingApprovalsCount: 2,
        month: currentMonth,
        year: currentYear,
    };

    const mockSavingsResponse: SavingsResponseDto = {
        members: [
            { userId: 'user-alex', firstName: 'Alex', lastName: 'Owner', personalSavings: 500, sharedSavings: 200, remainingBudget: 1990 },
            { userId: 'user-sam', firstName: 'Sam', lastName: 'Member', personalSavings: 300, sharedSavings: 100, remainingBudget: 1610 },
        ],
        totalPersonalSavings: 800,
        totalSharedSavings: 300,
        totalSavings: 1100,
        totalRemainingBudget: 3600,
    };

    const mockSettlementResponse: SettlementResponseDto = {
        amount: 60,
        owedByUserId: 'user-sam',
        owedByFirstName: 'Sam',
        owedToUserId: 'user-alex',
        owedToFirstName: 'Alex',
        message: 'Sam owes you €60.00',
        isSettled: false,
        month: currentMonth,
        year: currentYear,
    };

    const mockMarkPaidResponse: MarkSettlementPaidResponseDto = {
        id: 'settlement-1',
        householdId: 'household-456',
        month: currentMonth,
        year: currentYear,
        amount: 60,
        paidByUserId: 'user-sam',
        paidToUserId: 'user-alex',
        paidAt: now,
    };

    const mockSavingsHistoryResponse: SavingsHistoryItemDto[] = [
        { month: currentMonth, year: currentYear, personalSavings: 800, sharedSavings: 350 },
    ];

    const mockDashboardService = {
        getOverview: vi.fn(() => Promise.resolve(mockDashboardResponse)),
        getSavings: vi.fn(() => Promise.resolve(mockSavingsResponse)),
        getSavingsHistory: vi.fn(() => Promise.resolve(mockSavingsHistoryResponse)),
        getSettlement: vi.fn(() => Promise.resolve(mockSettlementResponse)),
        markSettlementPaid: vi.fn(() => Promise.resolve(mockMarkPaidResponse)),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [DashboardController],
            providers: [{ provide: DashboardService, useValue: mockDashboardService }],
        }).compile();

        controller = module.get<DashboardController>(DashboardController);
        dashboardService = module.get<DashboardService>(DashboardService);

        vi.clearAllMocks();
    });

    describe('getOverview', () => {
        it('should call dashboardService.getOverview and return dashboard', async () => {
            const result = await controller.getOverview(mockUserId);

            expect(dashboardService.getOverview).toHaveBeenCalledWith(mockUserId, 'monthly', undefined, undefined);
            expect(result.totalDefaultIncome).toBe(6000);
            expect(result.income).toHaveLength(2);
            expect(result.pendingApprovalsCount).toBe(2);
        });

        it('should pass yearly mode when mode query param is yearly', async () => {
            await controller.getOverview(mockUserId, 'yearly');

            expect(dashboardService.getOverview).toHaveBeenCalledWith(mockUserId, 'yearly', undefined, undefined);
        });

        it('should default to monthly for unknown mode values', async () => {
            await controller.getOverview(mockUserId, 'invalid');

            expect(dashboardService.getOverview).toHaveBeenCalledWith(mockUserId, 'monthly', undefined, undefined);
        });

        it('should pass month and year query params to service', async () => {
            await controller.getOverview(mockUserId, undefined, { month: 3, year: 2025 });

            expect(dashboardService.getOverview).toHaveBeenCalledWith(mockUserId, 'monthly', 3, 2025);
        });

        it('should pass only month when year is not provided', async () => {
            await controller.getOverview(mockUserId, undefined, { month: 6 });

            expect(dashboardService.getOverview).toHaveBeenCalledWith(mockUserId, 'monthly', 6, undefined);
        });

        it('should propagate NotFoundException from service', async () => {
            mockDashboardService.getOverview.mockRejectedValue(new NotFoundException('You must be in a household to manage expenses'));

            await expect(controller.getOverview(mockUserId)).rejects.toThrow(NotFoundException);
            await expect(controller.getOverview(mockUserId)).rejects.toThrow('You must be in a household to manage expenses');
        });
    });

    describe('getSavings', () => {
        it('should call dashboardService.getSavings and return savings', async () => {
            const result = await controller.getSavings(mockUserId);

            expect(dashboardService.getSavings).toHaveBeenCalledWith(mockUserId, undefined, undefined);
            expect(result.members).toHaveLength(2);
            expect(result.totalSavings).toBe(1100);
        });

        it('should pass month and year query params to service', async () => {
            await controller.getSavings(mockUserId, { month: 1, year: 2025 });

            expect(dashboardService.getSavings).toHaveBeenCalledWith(mockUserId, 1, 2025);
        });

        it('should propagate NotFoundException from service', async () => {
            mockDashboardService.getSavings.mockRejectedValue(new NotFoundException('You must be in a household to manage expenses'));

            await expect(controller.getSavings(mockUserId)).rejects.toThrow(NotFoundException);
            await expect(controller.getSavings(mockUserId)).rejects.toThrow('You must be in a household to manage expenses');
        });
    });

    describe('getSavingsHistory', () => {
        it('should call dashboardService.getSavingsHistory and return savings history', async () => {
            const result = await controller.getSavingsHistory(mockUserId);

            expect(dashboardService.getSavingsHistory).toHaveBeenCalledWith(mockUserId);
            expect(result).toHaveLength(1);
            expect(result[0].personalSavings).toBe(800);
            expect(result[0].sharedSavings).toBe(350);
        });

        it('should propagate NotFoundException from service', async () => {
            mockDashboardService.getSavingsHistory.mockRejectedValue(new NotFoundException('You must be in a household to manage expenses'));

            await expect(controller.getSavingsHistory(mockUserId)).rejects.toThrow(NotFoundException);
            await expect(controller.getSavingsHistory(mockUserId)).rejects.toThrow('You must be in a household to manage expenses');
        });
    });

    describe('getSettlement', () => {
        it('should call dashboardService.getSettlement and return settlement', async () => {
            const result = await controller.getSettlement(mockUserId);

            expect(dashboardService.getSettlement).toHaveBeenCalledWith(mockUserId, undefined, undefined);
            expect(result.amount).toBe(60);
            expect(result.owedByUserId).toBe('user-sam');
            expect(result.message).toBe('Sam owes you €60.00');
        });

        it('should pass month and year query params to service', async () => {
            await controller.getSettlement(mockUserId, { month: 11, year: 2025 });

            expect(dashboardService.getSettlement).toHaveBeenCalledWith(mockUserId, 11, 2025);
        });

        it('should propagate NotFoundException from service', async () => {
            mockDashboardService.getSettlement.mockRejectedValue(new NotFoundException('You must be in a household to manage expenses'));

            await expect(controller.getSettlement(mockUserId)).rejects.toThrow(NotFoundException);
            await expect(controller.getSettlement(mockUserId)).rejects.toThrow('You must be in a household to manage expenses');
        });
    });

    describe('markSettlementPaid', () => {
        it('should call dashboardService.markSettlementPaid and return result', async () => {
            const result = await controller.markSettlementPaid(mockUserId);

            expect(dashboardService.markSettlementPaid).toHaveBeenCalledWith(mockUserId);
            expect(result.id).toBe('settlement-1');
            expect(result.amount).toBe(60);
        });

        it('should propagate ConflictException from service', async () => {
            mockDashboardService.markSettlementPaid.mockRejectedValue(new ConflictException('Settlement has already been marked as paid for this month'));

            await expect(controller.markSettlementPaid(mockUserId)).rejects.toThrow(ConflictException);
            await expect(controller.markSettlementPaid(mockUserId)).rejects.toThrow('Settlement has already been marked as paid for this month');
        });

        it('should propagate BadRequestException from service', async () => {
            mockDashboardService.markSettlementPaid.mockRejectedValue(new BadRequestException('No settlement needed — shared expenses are balanced'));

            await expect(controller.markSettlementPaid(mockUserId)).rejects.toThrow(BadRequestException);
            await expect(controller.markSettlementPaid(mockUserId)).rejects.toThrow('No settlement needed — shared expenses are balanced');
        });

        it('should propagate NotFoundException from service', async () => {
            mockDashboardService.markSettlementPaid.mockRejectedValue(new NotFoundException('You must be in a household to manage expenses'));

            await expect(controller.markSettlementPaid(mockUserId)).rejects.toThrow(NotFoundException);
            await expect(controller.markSettlementPaid(mockUserId)).rejects.toThrow('You must be in a household to manage expenses');
        });
    });
});
