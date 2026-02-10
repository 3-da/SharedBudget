import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { DashboardResponseDto } from './dto/dashboard-response.dto';
import { SavingsResponseDto } from './dto/member-savings.dto';
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
                { userId: 'user-alex', firstName: 'Alex', lastName: 'Owner', personalExpensesTotal: 50 },
                { userId: 'user-sam', firstName: 'Sam', lastName: 'Member', personalExpensesTotal: 30 },
            ],
            sharedExpensesTotal: 920,
            totalHouseholdExpenses: 1000,
        },
        savings: {
            members: [
                { userId: 'user-alex', firstName: 'Alex', lastName: 'Owner', defaultSavings: 2990, currentSavings: 2690 },
                { userId: 'user-sam', firstName: 'Sam', lastName: 'Member', defaultSavings: 2010, currentSavings: 2010 },
            ],
            totalDefaultSavings: 5000,
            totalCurrentSavings: 4700,
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
            { userId: 'user-alex', firstName: 'Alex', lastName: 'Owner', defaultSavings: 2990, currentSavings: 2690 },
            { userId: 'user-sam', firstName: 'Sam', lastName: 'Member', defaultSavings: 2010, currentSavings: 2010 },
        ],
        totalDefaultSavings: 5000,
        totalCurrentSavings: 4700,
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

    const mockDashboardService = {
        getOverview: vi.fn(() => Promise.resolve(mockDashboardResponse)),
        getSavings: vi.fn(() => Promise.resolve(mockSavingsResponse)),
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

            expect(dashboardService.getOverview).toHaveBeenCalledWith(mockUserId, 'monthly');
            expect(result.totalDefaultIncome).toBe(6000);
            expect(result.income).toHaveLength(2);
            expect(result.pendingApprovalsCount).toBe(2);
        });

        it('should pass yearly mode when mode query param is yearly', async () => {
            const result = await controller.getOverview(mockUserId, 'yearly');

            expect(dashboardService.getOverview).toHaveBeenCalledWith(mockUserId, 'yearly');
        });

        it('should default to monthly for unknown mode values', async () => {
            await controller.getOverview(mockUserId, 'invalid');

            expect(dashboardService.getOverview).toHaveBeenCalledWith(mockUserId, 'monthly');
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

            expect(dashboardService.getSavings).toHaveBeenCalledWith(mockUserId);
            expect(result.members).toHaveLength(2);
            expect(result.totalDefaultSavings).toBe(5000);
        });

        it('should propagate NotFoundException from service', async () => {
            mockDashboardService.getSavings.mockRejectedValue(new NotFoundException('You must be in a household to manage expenses'));

            await expect(controller.getSavings(mockUserId)).rejects.toThrow(NotFoundException);
            await expect(controller.getSavings(mockUserId)).rejects.toThrow('You must be in a household to manage expenses');
        });
    });

    describe('getSettlement', () => {
        it('should call dashboardService.getSettlement and return settlement', async () => {
            const result = await controller.getSettlement(mockUserId);

            expect(dashboardService.getSettlement).toHaveBeenCalledWith(mockUserId);
            expect(result.amount).toBe(60);
            expect(result.owedByUserId).toBe('user-sam');
            expect(result.message).toBe('Sam owes you €60.00');
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
