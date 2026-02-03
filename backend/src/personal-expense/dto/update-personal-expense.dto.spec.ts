import { describe, expect, it } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdatePersonalExpenseDto } from './update-personal-expense.dto';
import { ExpenseCategory } from '../../generated/prisma/enums';

describe('UpdatePersonalExpenseDto', () => {
    it('should accept empty object (no fields updated)', async () => {
        const dto = plainToInstance(UpdatePersonalExpenseDto, {});
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
    });

    it('should accept a single field update', async () => {
        const dto = plainToInstance(UpdatePersonalExpenseDto, { name: 'Updated name' });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
    });

    it('should accept multiple field updates', async () => {
        const dto = plainToInstance(UpdatePersonalExpenseDto, {
            name: 'Updated name',
            amount: 99.99,
            category: ExpenseCategory.ONE_TIME,
        });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
    });

    describe('name', () => {
        it('should accept name at minimum length (1)', async () => {
            const dto = plainToInstance(UpdatePersonalExpenseDto, { name: 'A' });
            const errors = await validate(dto);
            expect(errors.length).toBe(0);
        });

        it('should accept name at maximum length (100)', async () => {
            const dto = plainToInstance(UpdatePersonalExpenseDto, { name: 'B'.repeat(100) });
            const errors = await validate(dto);
            expect(errors.length).toBe(0);
        });

        it('should reject name exceeding maximum length (101)', async () => {
            const dto = plainToInstance(UpdatePersonalExpenseDto, { name: 'B'.repeat(101) });
            const errors = await validate(dto);
            const nameError = errors.find((e) => e.property === 'name');
            expect(nameError).toBeDefined();
            expect(nameError!.constraints).toHaveProperty('maxLength');
        });

        it('should reject empty string name', async () => {
            const dto = plainToInstance(UpdatePersonalExpenseDto, { name: '' });
            const errors = await validate(dto);
            const nameError = errors.find((e) => e.property === 'name');
            expect(nameError).toBeDefined();
        });
    });

    describe('amount', () => {
        it('should accept amount at minimum (0)', async () => {
            const dto = plainToInstance(UpdatePersonalExpenseDto, { amount: 0 });
            const errors = await validate(dto);
            expect(errors.length).toBe(0);
        });

        it('should reject negative amount', async () => {
            const dto = plainToInstance(UpdatePersonalExpenseDto, { amount: -1 });
            const errors = await validate(dto);
            const amountError = errors.find((e) => e.property === 'amount');
            expect(amountError).toBeDefined();
            expect(amountError!.constraints).toHaveProperty('min');
        });
    });

    //#region enums
    describe('category', () => {
        it('should reject invalid category', async () => {
            const dto = plainToInstance(UpdatePersonalExpenseDto, { category: 'INVALID' });
            const errors = await validate(dto);
            const catError = errors.find((e) => e.property === 'category');
            expect(catError).toBeDefined();
            expect(catError!.constraints).toHaveProperty('isEnum');
        });
    });

    describe('frequency', () => {
        it('should reject invalid frequency', async () => {
            const dto = plainToInstance(UpdatePersonalExpenseDto, { frequency: 'WEEKLY' });
            const errors = await validate(dto);
            const freqError = errors.find((e) => e.property === 'frequency');
            expect(freqError).toBeDefined();
            expect(freqError!.constraints).toHaveProperty('isEnum');
        });
    });
    //#endregion

    describe('paymentMonth', () => {
        it('should accept paymentMonth at min (1)', async () => {
            const dto = plainToInstance(UpdatePersonalExpenseDto, { paymentMonth: 1 });
            const errors = await validate(dto);
            expect(errors.length).toBe(0);
        });

        it('should accept paymentMonth at max (12)', async () => {
            const dto = plainToInstance(UpdatePersonalExpenseDto, { paymentMonth: 12 });
            const errors = await validate(dto);
            expect(errors.length).toBe(0);
        });

        it('should reject paymentMonth above max (13)', async () => {
            const dto = plainToInstance(UpdatePersonalExpenseDto, { paymentMonth: 13 });
            const errors = await validate(dto);
            const error = errors.find((e) => e.property === 'paymentMonth');
            expect(error).toBeDefined();
            expect(error!.constraints).toHaveProperty('max');
        });

        it('should reject paymentMonth below min (0)', async () => {
            const dto = plainToInstance(UpdatePersonalExpenseDto, { paymentMonth: 0 });
            const errors = await validate(dto);
            const error = errors.find((e) => e.property === 'paymentMonth');
            expect(error).toBeDefined();
            expect(error!.constraints).toHaveProperty('min');
        });
    });

    describe('month', () => {
        it('should reject month above max (13)', async () => {
            const dto = plainToInstance(UpdatePersonalExpenseDto, { month: 13 });
            const errors = await validate(dto);
            const error = errors.find((e) => e.property === 'month');
            expect(error).toBeDefined();
            expect(error!.constraints).toHaveProperty('max');
        });

        it('should reject month below min (0)', async () => {
            const dto = plainToInstance(UpdatePersonalExpenseDto, { month: 0 });
            const errors = await validate(dto);
            const error = errors.find((e) => e.property === 'month');
            expect(error).toBeDefined();
            expect(error!.constraints).toHaveProperty('min');
        });
    });

    describe('year', () => {
        it('should accept year at min (2000)', async () => {
            const dto = plainToInstance(UpdatePersonalExpenseDto, { year: 2000 });
            const errors = await validate(dto);
            expect(errors.length).toBe(0);
        });

        it('should reject year below min (1999)', async () => {
            const dto = plainToInstance(UpdatePersonalExpenseDto, { year: 1999 });
            const errors = await validate(dto);
            const error = errors.find((e) => e.property === 'year');
            expect(error).toBeDefined();
            expect(error!.constraints).toHaveProperty('min');
        });
    });
});
