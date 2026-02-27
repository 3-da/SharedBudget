import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SavingService } from './saving.service';
import { PrismaService } from '../prisma/prisma.service';
import { ExpenseHelperService } from '../common/expense/expense-helper.service';
import { CacheService } from '../common/cache/cache.service';

describe('SavingService', () => {
    let service: SavingService;

    const mockUserId = 'user-123';
    const mockHouseholdId = 'household-456';

    const mockMembership = {
        userId: mockUserId,
        householdId: mockHouseholdId,
        role: 'MEMBER',
    };

    const mockPersonalSaving = {
        id: 'saving-001',
        userId: mockUserId,
        householdId: mockHouseholdId,
        amount: 200,
        month: 6,
        year: 2026,
        isShared: false,
        reducesFromSalary: true,
        createdAt: new Date('2026-06-01T10:00:00.000Z'),
        updatedAt: new Date('2026-06-01T10:00:00.000Z'),
    };

    const mockSharedSaving = {
        ...mockPersonalSaving,
        id: 'saving-002',
        amount: 100,
        isShared: true,
    };

    const mockPrismaService = {
        saving: {
            findMany: vi.fn(),
            findUnique: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
        },
        expenseApproval: {
            create: vi.fn(),
        },
    };

    const mockExpenseHelper = {
        requireMembership: vi.fn(),
    };

    const mockCacheService = {
        invalidateSavings: vi.fn(),
        invalidateDashboard: vi.fn(),
        invalidateApprovals: vi.fn(),
        savingsKey: vi.fn().mockReturnValue('cache:savings:household-456:2026:6'),
        summaryTTL: 120,
        getOrSet: vi.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                SavingService,
                { provide: PrismaService, useValue: mockPrismaService },
                { provide: ExpenseHelperService, useValue: mockExpenseHelper },
                { provide: CacheService, useValue: mockCacheService },
            ],
        }).compile();

        service = module.get<SavingService>(SavingService);

        vi.clearAllMocks();
    });

    //#region getMySavings
    describe('getMySavings', () => {
        it('should return personal and shared savings for the current month', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.saving.findMany.mockResolvedValue([mockPersonalSaving, mockSharedSaving]);

            const result = await service.getMySavings(mockUserId);

            expect(mockExpenseHelper.requireMembership).toHaveBeenCalledWith(mockUserId);
            expect(mockPrismaService.saving.findMany).toHaveBeenCalledWith({
                where: {
                    userId: mockUserId,
                    month: expect.any(Number),
                    year: expect.any(Number),
                },
                orderBy: { isShared: 'asc' },
            });
            expect(result).toHaveLength(2);
            expect(result[0].isShared).toBe(false);
            expect(result[1].isShared).toBe(true);
        });

        it('should return empty array when no savings exist for the month', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.saving.findMany.mockResolvedValue([]);

            const result = await service.getMySavings(mockUserId);

            expect(result).toEqual([]);
        });

        it('should throw NotFoundException if user is not in a household', async () => {
            mockExpenseHelper.requireMembership.mockRejectedValue(new NotFoundException('You must be in a household to manage expenses'));

            await expect(service.getMySavings(mockUserId)).rejects.toThrow(NotFoundException);
            await expect(service.getMySavings(mockUserId)).rejects.toThrow('You must be in a household to manage expenses');
            expect(mockPrismaService.saving.findMany).not.toHaveBeenCalled();
        });

        it('should map Decimal amounts to numbers in response', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.saving.findMany.mockResolvedValue([mockPersonalSaving]);

            const result = await service.getMySavings(mockUserId);

            expect(typeof result[0].amount).toBe('number');
            expect(result[0].amount).toBe(200);
        });

        it('should map all fields correctly in response', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.saving.findMany.mockResolvedValue([mockPersonalSaving]);

            const result = await service.getMySavings(mockUserId);

            expect(result[0]).toEqual({
                id: 'saving-001',
                userId: mockUserId,
                householdId: mockHouseholdId,
                amount: 200,
                month: 6,
                year: 2026,
                isShared: false,
                reducesFromSalary: true,
                createdAt: mockPersonalSaving.createdAt,
                updatedAt: mockPersonalSaving.updatedAt,
            });
        });
    });
    //#endregion

    //#region addPersonalSaving
    describe('addPersonalSaving', () => {
        const dto = { amount: 50 };

        it('should create a new personal saving when none exists', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.saving.findUnique.mockResolvedValue(null);
            mockPrismaService.saving.create.mockResolvedValue({ ...mockPersonalSaving, amount: 50 });

            const result = await service.addPersonalSaving(mockUserId, dto);

            expect(mockPrismaService.saving.findUnique).toHaveBeenCalledWith({
                where: { userId_month_year_isShared: { userId: mockUserId, month: expect.any(Number), year: expect.any(Number), isShared: false } },
            });
            expect(mockPrismaService.saving.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    userId: mockUserId,
                    householdId: mockHouseholdId,
                    amount: 50,
                    isShared: false,
                }),
            });
            expect(result.amount).toBe(50);
        });

        it('should add to existing personal saving (incremental)', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.saving.findUnique.mockResolvedValue(mockPersonalSaving); // amount: 200
            mockPrismaService.saving.update.mockResolvedValue({ ...mockPersonalSaving, amount: 250 });

            const result = await service.addPersonalSaving(mockUserId, dto); // +50

            expect(mockPrismaService.saving.update).toHaveBeenCalledWith({
                where: { id: 'saving-001' },
                data: expect.objectContaining({ amount: 250 }),
            });
            expect(result.amount).toBe(250);
        });

        it('should use provided month and year when specified', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.saving.findUnique.mockResolvedValue(null);
            mockPrismaService.saving.create.mockResolvedValue({ ...mockPersonalSaving, month: 3, year: 2026, amount: 50 });

            await service.addPersonalSaving(mockUserId, { amount: 50, month: 3, year: 2026 });

            expect(mockPrismaService.saving.findUnique).toHaveBeenCalledWith({
                where: { userId_month_year_isShared: { userId: mockUserId, month: 3, year: 2026, isShared: false } },
            });
        });

        it('should invalidate savings and dashboard cache', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.saving.findUnique.mockResolvedValue(null);
            mockPrismaService.saving.create.mockResolvedValue({ ...mockPersonalSaving, amount: 50 });

            await service.addPersonalSaving(mockUserId, dto);

            expect(mockCacheService.invalidateSavings).toHaveBeenCalledWith(mockHouseholdId);
            expect(mockCacheService.invalidateDashboard).toHaveBeenCalledWith(mockHouseholdId);
        });

        it('should throw NotFoundException if user is not in a household', async () => {
            mockExpenseHelper.requireMembership.mockRejectedValue(new NotFoundException('You must be in a household to manage expenses'));

            await expect(service.addPersonalSaving(mockUserId, dto)).rejects.toThrow(NotFoundException);
            await expect(service.addPersonalSaving(mockUserId, dto)).rejects.toThrow('You must be in a household to manage expenses');
            expect(mockPrismaService.saving.findUnique).not.toHaveBeenCalled();
        });

        it('should handle boundary month value 1 (January)', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.saving.findUnique.mockResolvedValue(null);
            mockPrismaService.saving.create.mockResolvedValue({ ...mockPersonalSaving, month: 1, amount: 50 });

            const result = await service.addPersonalSaving(mockUserId, { amount: 50, month: 1, year: 2026 });

            expect(result.month).toBe(1);
        });

        it('should handle boundary month value 12 (December)', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.saving.findUnique.mockResolvedValue(null);
            mockPrismaService.saving.create.mockResolvedValue({ ...mockPersonalSaving, month: 12, amount: 50 });

            const result = await service.addPersonalSaving(mockUserId, { amount: 50, month: 12, year: 2026 });

            expect(result.month).toBe(12);
        });

        it('should pass reducesFromSalary=false to create when explicitly set', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.saving.findUnique.mockResolvedValue(null);
            mockPrismaService.saving.create.mockResolvedValue({ ...mockPersonalSaving, amount: 50, reducesFromSalary: false });

            await service.addPersonalSaving(mockUserId, { amount: 50, reducesFromSalary: false });

            expect(mockPrismaService.saving.create).toHaveBeenCalledWith({
                data: expect.objectContaining({ reducesFromSalary: false }),
            });
        });

        it('should default reducesFromSalary=true when not provided on create', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.saving.findUnique.mockResolvedValue(null);
            mockPrismaService.saving.create.mockResolvedValue({ ...mockPersonalSaving, amount: 50 });

            await service.addPersonalSaving(mockUserId, { amount: 50 });

            expect(mockPrismaService.saving.create).toHaveBeenCalledWith({
                data: expect.objectContaining({ reducesFromSalary: true }),
            });
        });

        it('should preserve existing reducesFromSalary on update when not provided', async () => {
            const existingWithFalse = { ...mockPersonalSaving, reducesFromSalary: false };
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.saving.findUnique.mockResolvedValue(existingWithFalse);
            mockPrismaService.saving.update.mockResolvedValue({ ...existingWithFalse, amount: 250 });

            await service.addPersonalSaving(mockUserId, { amount: 50 });

            expect(mockPrismaService.saving.update).toHaveBeenCalledWith({
                where: { id: 'saving-001' },
                data: expect.objectContaining({ reducesFromSalary: false }),
            });
        });

        it('should override reducesFromSalary on update when explicitly provided', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.saving.findUnique.mockResolvedValue(mockPersonalSaving); // reducesFromSalary: true
            mockPrismaService.saving.update.mockResolvedValue({ ...mockPersonalSaving, amount: 250, reducesFromSalary: false });

            await service.addPersonalSaving(mockUserId, { amount: 50, reducesFromSalary: false });

            expect(mockPrismaService.saving.update).toHaveBeenCalledWith({
                where: { id: 'saving-001' },
                data: expect.objectContaining({ reducesFromSalary: false }),
            });
        });
    });
    //#endregion

    //#region withdrawPersonalSaving
    describe('withdrawPersonalSaving', () => {
        const dto = { amount: 50 };

        it('should subtract amount from existing personal saving', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.saving.findUnique.mockResolvedValue(mockPersonalSaving); // amount: 200
            mockPrismaService.saving.update.mockResolvedValue({ ...mockPersonalSaving, amount: 150 });

            const result = await service.withdrawPersonalSaving(mockUserId, dto); // -50

            expect(mockPrismaService.saving.update).toHaveBeenCalledWith({
                where: { id: 'saving-001' },
                data: { amount: 150 },
            });
            expect(result.amount).toBe(150);
        });

        it('should allow withdrawal of exact current amount (balance becomes 0)', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.saving.findUnique.mockResolvedValue(mockPersonalSaving); // amount: 200
            mockPrismaService.saving.update.mockResolvedValue({ ...mockPersonalSaving, amount: 0 });

            const result = await service.withdrawPersonalSaving(mockUserId, { amount: 200 });

            expect(mockPrismaService.saving.update).toHaveBeenCalledWith({
                where: { id: 'saving-001' },
                data: { amount: 0 },
            });
            expect(result.amount).toBe(0);
        });

        it('should throw BadRequestException if withdrawal exceeds current savings', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.saving.findUnique.mockResolvedValue(mockPersonalSaving); // amount: 200

            await expect(service.withdrawPersonalSaving(mockUserId, { amount: 201 })).rejects.toThrow(BadRequestException);
            await expect(service.withdrawPersonalSaving(mockUserId, { amount: 201 })).rejects.toThrow('Withdrawal amount (201) exceeds current savings (200)');
            expect(mockPrismaService.saving.update).not.toHaveBeenCalled();
        });

        it('should throw NotFoundException if no personal saving exists', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.saving.findUnique.mockResolvedValue(null);

            await expect(service.withdrawPersonalSaving(mockUserId, dto)).rejects.toThrow(NotFoundException);
            await expect(service.withdrawPersonalSaving(mockUserId, dto)).rejects.toThrow('No personal savings found for this month');
        });

        it('should throw NotFoundException if user is not in a household', async () => {
            mockExpenseHelper.requireMembership.mockRejectedValue(new NotFoundException('You must be in a household to manage expenses'));

            await expect(service.withdrawPersonalSaving(mockUserId, dto)).rejects.toThrow(NotFoundException);
            await expect(service.withdrawPersonalSaving(mockUserId, dto)).rejects.toThrow('You must be in a household to manage expenses');
        });

        it('should invalidate savings and dashboard cache after withdrawal', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.saving.findUnique.mockResolvedValue(mockPersonalSaving);
            mockPrismaService.saving.update.mockResolvedValue({ ...mockPersonalSaving, amount: 150 });

            await service.withdrawPersonalSaving(mockUserId, dto);

            expect(mockCacheService.invalidateSavings).toHaveBeenCalledWith(mockHouseholdId);
            expect(mockCacheService.invalidateDashboard).toHaveBeenCalledWith(mockHouseholdId);
        });
    });
    //#endregion

    //#region getHouseholdSavings
    describe('getHouseholdSavings', () => {
        it('should return cached household savings using getOrSet', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            const mappedSavings = [
                {
                    id: 'saving-001',
                    userId: mockUserId,
                    householdId: mockHouseholdId,
                    amount: 200,
                    month: 6,
                    year: 2026,
                    isShared: false,
                    createdAt: mockPersonalSaving.createdAt,
                    updatedAt: mockPersonalSaving.updatedAt,
                },
            ];
            mockCacheService.getOrSet.mockResolvedValue(mappedSavings);

            const result = await service.getHouseholdSavings(mockUserId);

            expect(mockExpenseHelper.requireMembership).toHaveBeenCalledWith(mockUserId);
            expect(mockCacheService.savingsKey).toHaveBeenCalledWith(mockHouseholdId, expect.any(Number), expect.any(Number));
            expect(mockCacheService.getOrSet).toHaveBeenCalledWith('cache:savings:household-456:2026:6', 120, expect.any(Function));
            expect(result).toEqual(mappedSavings);
        });

        it('should throw NotFoundException if user is not in a household', async () => {
            mockExpenseHelper.requireMembership.mockRejectedValue(new NotFoundException('You must be in a household to manage expenses'));

            await expect(service.getHouseholdSavings(mockUserId)).rejects.toThrow(NotFoundException);
            await expect(service.getHouseholdSavings(mockUserId)).rejects.toThrow('You must be in a household to manage expenses');
            expect(mockCacheService.getOrSet).not.toHaveBeenCalled();
        });

        it('should execute the fetch function when cache misses', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockCacheService.getOrSet.mockImplementation(async (_key, _ttl, fetchFn) => {
                return fetchFn();
            });
            mockPrismaService.saving.findMany.mockResolvedValue([mockPersonalSaving]);

            const result = await service.getHouseholdSavings(mockUserId);

            expect(mockPrismaService.saving.findMany).toHaveBeenCalledWith({
                where: {
                    householdId: mockHouseholdId,
                    month: expect.any(Number),
                    year: expect.any(Number),
                },
                orderBy: [{ userId: 'asc' }, { isShared: 'asc' }],
            });
            expect(result).toHaveLength(1);
            expect(result[0].amount).toBe(200);
        });
    });
    //#endregion

    //#region addSharedSaving
    describe('addSharedSaving', () => {
        const dto = { amount: 50 };

        it('should create a new shared saving when none exists', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.saving.findUnique.mockResolvedValue(null);
            mockPrismaService.saving.create.mockResolvedValue({ ...mockSharedSaving, amount: 50 });

            const result = await service.addSharedSaving(mockUserId, dto);

            expect(mockPrismaService.saving.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    userId: mockUserId,
                    householdId: mockHouseholdId,
                    amount: 50,
                    isShared: true,
                }),
            });
            expect(result.amount).toBe(50);
            expect(result.isShared).toBe(true);
        });

        it('should add to existing shared saving (incremental)', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.saving.findUnique.mockResolvedValue(mockSharedSaving); // amount: 100
            mockPrismaService.saving.update.mockResolvedValue({ ...mockSharedSaving, amount: 150 });

            const result = await service.addSharedSaving(mockUserId, dto); // +50

            expect(mockPrismaService.saving.update).toHaveBeenCalledWith({
                where: { id: 'saving-002' },
                data: expect.objectContaining({ amount: 150 }),
            });
            expect(result.amount).toBe(150);
        });

        it('should invalidate savings and dashboard cache', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.saving.findUnique.mockResolvedValue(null);
            mockPrismaService.saving.create.mockResolvedValue({ ...mockSharedSaving, amount: 50 });

            await service.addSharedSaving(mockUserId, dto);

            expect(mockCacheService.invalidateSavings).toHaveBeenCalledWith(mockHouseholdId);
            expect(mockCacheService.invalidateDashboard).toHaveBeenCalledWith(mockHouseholdId);
        });

        it('should throw NotFoundException if user is not in a household', async () => {
            mockExpenseHelper.requireMembership.mockRejectedValue(new NotFoundException('You must be in a household to manage expenses'));

            await expect(service.addSharedSaving(mockUserId, dto)).rejects.toThrow(NotFoundException);
            await expect(service.addSharedSaving(mockUserId, dto)).rejects.toThrow('You must be in a household to manage expenses');
        });
    });
    //#endregion

    //#region requestSharedWithdrawal
    describe('requestSharedWithdrawal', () => {
        const dto = { amount: 50 };
        // Household pool: user-123 contributed 100, another member contributed 200 → total 300
        const mockHouseholdSharedSavings = [
            { ...mockSharedSaving, amount: 100 },
            { ...mockSharedSaving, id: 'saving-003', userId: 'user-456', amount: 200 },
        ];

        it('should create an approval request for shared withdrawal from household pool', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.saving.findMany.mockResolvedValue(mockHouseholdSharedSavings); // total: 300
            mockPrismaService.expenseApproval.create.mockResolvedValue({ id: 'approval-001' });

            const result = await service.requestSharedWithdrawal(mockUserId, dto);

            expect(mockPrismaService.expenseApproval.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    householdId: mockHouseholdId,
                    action: 'WITHDRAW_SAVINGS',
                    status: 'PENDING',
                    requestedById: mockUserId,
                    proposedData: expect.objectContaining({
                        amount: 50,
                        month: expect.any(Number),
                        year: expect.any(Number),
                    }),
                }),
            });
            expect(result.approvalId).toBe('approval-001');
            expect(result.message).toBe('Withdrawal request submitted for approval');
        });

        it('should allow withdrawal even if requester has no personal contribution', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            // Requester has no savings, but another member has 200 → total 200
            mockPrismaService.saving.findMany.mockResolvedValue([{ ...mockSharedSaving, id: 'saving-003', userId: 'user-456', amount: 200 }]);
            mockPrismaService.expenseApproval.create.mockResolvedValue({ id: 'approval-001' });

            const result = await service.requestSharedWithdrawal(mockUserId, { amount: 100 });

            expect(result.approvalId).toBe('approval-001');
        });

        it('should throw NotFoundException if household has no shared savings', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.saving.findMany.mockResolvedValue([]);

            await expect(service.requestSharedWithdrawal(mockUserId, dto)).rejects.toThrow(NotFoundException);
            await expect(service.requestSharedWithdrawal(mockUserId, dto)).rejects.toThrow('No shared savings found for this month');
        });

        it('should throw BadRequestException if withdrawal exceeds total household shared savings', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.saving.findMany.mockResolvedValue([{ ...mockSharedSaving, amount: 100 }]); // total: 100

            await expect(service.requestSharedWithdrawal(mockUserId, { amount: 101 })).rejects.toThrow(BadRequestException);
            await expect(service.requestSharedWithdrawal(mockUserId, { amount: 101 })).rejects.toThrow(
                'Withdrawal amount (101) exceeds total household shared savings (100)',
            );
        });

        it('should allow withdrawal of exact total pool amount', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.saving.findMany.mockResolvedValue(mockHouseholdSharedSavings); // total: 300
            mockPrismaService.expenseApproval.create.mockResolvedValue({ id: 'approval-002' });

            const result = await service.requestSharedWithdrawal(mockUserId, { amount: 300 });

            expect(result.approvalId).toBe('approval-002');
        });

        it('should invalidate approval caches', async () => {
            mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
            mockPrismaService.saving.findMany.mockResolvedValue(mockHouseholdSharedSavings);
            mockPrismaService.expenseApproval.create.mockResolvedValue({ id: 'approval-001' });

            await service.requestSharedWithdrawal(mockUserId, dto);

            expect(mockCacheService.invalidateApprovals).toHaveBeenCalledWith(mockHouseholdId);
        });

        it('should throw NotFoundException if user is not in a household', async () => {
            mockExpenseHelper.requireMembership.mockRejectedValue(new NotFoundException('You must be in a household to manage expenses'));

            await expect(service.requestSharedWithdrawal(mockUserId, dto)).rejects.toThrow(NotFoundException);
            await expect(service.requestSharedWithdrawal(mockUserId, dto)).rejects.toThrow('You must be in a household to manage expenses');
        });
    });
    //#endregion

    //#region executeSharedWithdrawal
    describe('executeSharedWithdrawal', () => {
        const mockTx = {
            saving: {
                findMany: vi.fn(),
                update: vi.fn(),
            },
        };

        beforeEach(() => {
            mockTx.saving.findMany.mockReset();
            mockTx.saving.update.mockReset();
        });

        it('should subtract the approved amount from a single member proportionally', async () => {
            mockTx.saving.findMany.mockResolvedValue([{ ...mockSharedSaving, amount: 100 }]);
            mockTx.saving.update.mockResolvedValue({ ...mockSharedSaving, amount: 50 });

            await service.executeSharedWithdrawal(mockUserId, mockHouseholdId, 50, 6, 2026, mockTx);

            expect(mockTx.saving.update).toHaveBeenCalledWith({
                where: { id: 'saving-002' },
                data: { amount: 50 },
            });
        });

        it('should proportionally deduct from multiple members', async () => {
            // Member A: 200, Member B: 100 → total 300, withdraw 150
            // Member A deduction: 200/300 * 150 = 100 → new 100
            // Member B deduction (last, takes remainder): 50 → new 50
            const memberA = { ...mockSharedSaving, id: 'saving-A', userId: 'user-A', amount: 200 };
            const memberB = { ...mockSharedSaving, id: 'saving-B', userId: 'user-B', amount: 100 };
            mockTx.saving.findMany.mockResolvedValue([memberA, memberB]);
            mockTx.saving.update.mockResolvedValue({});

            await service.executeSharedWithdrawal(mockUserId, mockHouseholdId, 150, 6, 2026, mockTx);

            expect(mockTx.saving.update).toHaveBeenCalledTimes(2);
            expect(mockTx.saving.update).toHaveBeenNthCalledWith(1, { where: { id: 'saving-A' }, data: { amount: 100 } });
            expect(mockTx.saving.update).toHaveBeenNthCalledWith(2, { where: { id: 'saving-B' }, data: { amount: 50 } });
        });

        it('should throw NotFoundException if no shared savings exist at execution time', async () => {
            mockTx.saving.findMany.mockResolvedValue([]);

            await expect(service.executeSharedWithdrawal(mockUserId, mockHouseholdId, 50, 6, 2026, mockTx)).rejects.toThrow(NotFoundException);
            await expect(service.executeSharedWithdrawal(mockUserId, mockHouseholdId, 50, 6, 2026, mockTx)).rejects.toThrow(
                'Shared savings no longer exist for this month',
            );
        });

        it('should throw BadRequestException if withdrawal exceeds total at execution time', async () => {
            mockTx.saving.findMany.mockResolvedValue([{ ...mockSharedSaving, amount: 30 }]);

            await expect(service.executeSharedWithdrawal(mockUserId, mockHouseholdId, 50, 6, 2026, mockTx)).rejects.toThrow(BadRequestException);
        });
    });
    //#endregion
});
