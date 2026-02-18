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

    describe('month', () => {
        it('should accept month at minimum (boundary: 1)', async () => {
            const dto = plainToInstance(ListPersonalExpensesQueryDto, { month: 1 });
            const errors = await validate(dto);
            expect(errors.length).toBe(0);
        });

        it('should accept month at maximum (boundary: 12)', async () => {
            const dto = plainToInstance(ListPersonalExpensesQueryDto, { month: 12 });
            const errors = await validate(dto);
            expect(errors.length).toBe(0);
        });

        it('should reject month below minimum (boundary: 0)', async () => {
            const dto = plainToInstance(ListPersonalExpensesQueryDto, { month: 0 });
            const errors = await validate(dto);
            const monthError = errors.find((e) => e.property === 'month');
            expect(monthError).toBeDefined();
            expect(monthError!.constraints).toHaveProperty('min');
        });

        it('should reject month above maximum (boundary: 13)', async () => {
            const dto = plainToInstance(ListPersonalExpensesQueryDto, { month: 13 });
            const errors = await validate(dto);
            const monthError = errors.find((e) => e.property === 'month');
            expect(monthError).toBeDefined();
            expect(monthError!.constraints).toHaveProperty('max');
        });

        it('should reject non-integer month', async () => {
            const dto = plainToInstance(ListPersonalExpensesQueryDto, { month: 6.5 });
            const errors = await validate(dto);
            const monthError = errors.find((e) => e.property === 'month');
            expect(monthError).toBeDefined();
            expect(monthError!.constraints).toHaveProperty('isInt');
        });

        it('should transform string month to number via @Type', async () => {
            const dto = plainToInstance(ListPersonalExpensesQueryDto, { month: '6' });
            const errors = await validate(dto);
            expect(errors.length).toBe(0);
            expect(dto.month).toBe(6);
        });
    });

    describe('year', () => {
        it('should accept year at minimum (boundary: 2000)', async () => {
            const dto = plainToInstance(ListPersonalExpensesQueryDto, { year: 2000 });
            const errors = await validate(dto);
            expect(errors.length).toBe(0);
        });

        it('should reject year below minimum (boundary: 1999)', async () => {
            const dto = plainToInstance(ListPersonalExpensesQueryDto, { year: 1999 });
            const errors = await validate(dto);
            const yearError = errors.find((e) => e.property === 'year');
            expect(yearError).toBeDefined();
            expect(yearError!.constraints).toHaveProperty('min');
        });

        it('should reject non-integer year', async () => {
            const dto = plainToInstance(ListPersonalExpensesQueryDto, { year: 2026.5 });
            const errors = await validate(dto);
            const yearError = errors.find((e) => e.property === 'year');
            expect(yearError).toBeDefined();
            expect(yearError!.constraints).toHaveProperty('isInt');
        });

        it('should transform string year to number via @Type', async () => {
            const dto = plainToInstance(ListPersonalExpensesQueryDto, { year: '2026' });
            const errors = await validate(dto);
            expect(errors.length).toBe(0);
            expect(dto.year).toBe(2026);
        });
    });

    it('should accept all filters combined with month and year', async () => {
        const dto = plainToInstance(ListPersonalExpensesQueryDto, {
            category: ExpenseCategory.RECURRING,
            frequency: ExpenseFrequency.MONTHLY,
            month: 6,
            year: 2026,
        });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
    });
});
