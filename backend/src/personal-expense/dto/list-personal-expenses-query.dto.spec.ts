import { describe, expect, it } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ListPersonalExpensesQueryDto } from './list-personal-expenses-query.dto';
import { ExpenseCategory, ExpenseFrequency } from '../../generated/prisma/enums';

describe('ListPersonalExpensesQueryDto', () => {
    it('should accept empty object (no filters)', async () => {
        const dto = plainToInstance(ListPersonalExpensesQueryDto, {});
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
    });

    it('should accept valid category filter', async () => {
        const dto = plainToInstance(ListPersonalExpensesQueryDto, { category: ExpenseCategory.RECURRING });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
    });

    it('should accept valid frequency filter', async () => {
        const dto = plainToInstance(ListPersonalExpensesQueryDto, { frequency: ExpenseFrequency.YEARLY });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
    });

    it('should accept both filters combined', async () => {
        const dto = plainToInstance(ListPersonalExpensesQueryDto, { category: ExpenseCategory.ONE_TIME, frequency: ExpenseFrequency.MONTHLY });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
    });

    it('should reject invalid category value', async () => {
        const dto = plainToInstance(ListPersonalExpensesQueryDto, { category: 'INVALID' });
        const errors = await validate(dto);
        const catError = errors.find((e) => e.property === 'category');
        expect(catError).toBeDefined();
        expect(catError!.constraints).toHaveProperty('isEnum');
    });

    it('should reject invalid frequency value', async () => {
        const dto = plainToInstance(ListPersonalExpensesQueryDto, { frequency: 'DAILY' });
        const errors = await validate(dto);
        const freqError = errors.find((e) => e.property === 'frequency');
        expect(freqError).toBeDefined();
        expect(freqError!.constraints).toHaveProperty('isEnum');
    });
});
