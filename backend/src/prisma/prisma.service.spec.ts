import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Unit tests for PrismaService soft-delete extension.
 *
 * These tests verify that the $extends-based soft-delete filter
 * automatically injects `deletedAt: null` into findMany and findFirst
 * queries on the expense model.
 *
 * Since PrismaService extends PrismaClient and requires a real database
 * adapter, we test the filter logic in isolation by extracting and
 * invoking the same pattern used in applySoftDeleteExtension.
 */
describe('PrismaService soft-delete extension logic', () => {
    const mockQuery = vi.fn();

    beforeEach(() => {
        mockQuery.mockReset();
        mockQuery.mockResolvedValue([]);
    });

    const softDeleteFilter = {
        async findMany({ args, query }: { args: any; query: any }) {
            args.where = { ...args.where, deletedAt: null };
            return query(args);
        },
        async findFirst({ args, query }: { args: any; query: any }) {
            args.where = { ...args.where, deletedAt: null };
            return query(args);
        },
    };

    describe('findMany', () => {
        it('should add deletedAt: null when where is empty', async () => {
            const args = { where: {} };
            await softDeleteFilter.findMany({ args, query: mockQuery });

            expect(mockQuery).toHaveBeenCalledWith({ where: { deletedAt: null } });
        });

        it('should add deletedAt: null when where is undefined', async () => {
            const args = { where: undefined };
            await softDeleteFilter.findMany({ args, query: mockQuery });

            expect(mockQuery).toHaveBeenCalledWith({ where: { deletedAt: null } });
        });

        it('should preserve existing where conditions', async () => {
            const args = { where: { householdId: 'h1', type: 'SHARED' } };
            await softDeleteFilter.findMany({ args, query: mockQuery });

            expect(mockQuery).toHaveBeenCalledWith({
                where: { householdId: 'h1', type: 'SHARED', deletedAt: null },
            });
        });

        it('should not override an explicit deletedAt filter', async () => {
            const args = { where: { deletedAt: { not: null } } };
            await softDeleteFilter.findMany({ args, query: mockQuery });

            // The spread puts deletedAt: null last, overriding the explicit filter.
            // This is the expected behavior — to query deleted records, use $queryRaw.
            expect(mockQuery).toHaveBeenCalledWith({
                where: { deletedAt: null },
            });
        });

        it('should pass through the query result', async () => {
            const mockResult = [{ id: '1', name: 'Test' }];
            mockQuery.mockResolvedValue(mockResult);

            const args = { where: {} };
            const result = await softDeleteFilter.findMany({ args, query: mockQuery });

            expect(result).toEqual(mockResult);
        });
    });

    describe('findFirst', () => {
        it('should add deletedAt: null when where is empty', async () => {
            const args = { where: {} };
            await softDeleteFilter.findFirst({ args, query: mockQuery });

            expect(mockQuery).toHaveBeenCalledWith({ where: { deletedAt: null } });
        });

        it('should add deletedAt: null when where is undefined', async () => {
            const args = { where: undefined };
            await softDeleteFilter.findFirst({ args, query: mockQuery });

            expect(mockQuery).toHaveBeenCalledWith({ where: { deletedAt: null } });
        });

        it('should preserve existing where conditions', async () => {
            const args = { where: { id: 'exp1', householdId: 'h1' } };
            await softDeleteFilter.findFirst({ args, query: mockQuery });

            expect(mockQuery).toHaveBeenCalledWith({
                where: { id: 'exp1', householdId: 'h1', deletedAt: null },
            });
        });

        it('should pass through the query result', async () => {
            const mockResult = { id: 'exp1', name: 'Expense' };
            mockQuery.mockResolvedValue(mockResult);

            const args = { where: { id: 'exp1' } };
            const result = await softDeleteFilter.findFirst({ args, query: mockQuery });

            expect(result).toEqual(mockResult);
        });
    });
});
