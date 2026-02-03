import { describe, expect, it } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ListSharedExpensesQueryDto } from './list-shared-expenses-query.dto';
import { ExpenseCategory, ExpenseFrequency } from '../../generated/prisma/enums';

describe('ListSharedExpensesQueryDto', () => {
    it('should accept an empty query (no filters)', async () => {
        const dto = plainToInstance(ListSharedExpensesQueryDto, {});
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
    });

    it('should accept valid category filter', async () => {
        const dto = plainToInstance(ListSharedExpensesQueryDto, { category: ExpenseCategory.RECURRING });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
    });

    it('should accept valid frequency filter', async () => {
        const dto = plainToInstance(ListSharedExpensesQueryDto, { frequency: ExpenseFrequency.MONTHLY });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
    });

    it('should accept both filters', async () => {
        const dto = plainToInstance(ListSharedExpensesQueryDto, {
            category: ExpenseCategory.ONE_TIME,
            frequency: ExpenseFrequency.YEARLY,
        });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
    });

    it('should reject invalid category', async () => {
        const dto = plainToInstance(ListSharedExpensesQueryDto, { category: 'INVALID' });
        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].constraints).toHaveProperty('isEnum');
    });

    it('should reject invalid frequency', async () => {
        const dto = plainToInstance(ListSharedExpensesQueryDto, { frequency: 'WEEKLY' });
        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].constraints).toHaveProperty('isEnum');
    });
});
