import { describe, expect, it } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateSharedExpenseDto } from './create-shared-expense.dto';
import { ExpenseCategory, ExpenseFrequency, InstallmentFrequency, YearlyPaymentStrategy } from '../../generated/prisma/enums';

describe('CreateSharedExpenseDto', () => {
    const validDto = {
        name: 'Monthly Rent',
        amount: 800,
        category: ExpenseCategory.RECURRING,
        frequency: ExpenseFrequency.MONTHLY,
    };

    it('should accept a valid monthly recurring expense', async () => {
        const dto = plainToInstance(CreateSharedExpenseDto, validDto);
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
    });

    it('should accept a valid expense with paidByUserId', async () => {
        const dto = plainToInstance(CreateSharedExpenseDto, {
            ...validDto,
            paidByUserId: '550e8400-e29b-41d4-a716-446655440000',
        });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
    });

    //#region name validation
    it('should reject when name is empty', async () => {
        const dto = plainToInstance(CreateSharedExpenseDto, { ...validDto, name: '' });
        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].constraints).toHaveProperty('minLength');
    });

    it('should accept name at minimum length (1 char)', async () => {
        const dto = plainToInstance(CreateSharedExpenseDto, { ...validDto, name: 'A' });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
    });

    it('should accept name at maximum length (100 chars)', async () => {
        const dto = plainToInstance(CreateSharedExpenseDto, { ...validDto, name: 'A'.repeat(100) });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
    });

    it('should reject name exceeding maximum length (101 chars)', async () => {
        const dto = plainToInstance(CreateSharedExpenseDto, { ...validDto, name: 'A'.repeat(101) });
        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].constraints).toHaveProperty('maxLength');
    });

    it('should reject when name is not a string', async () => {
        const dto = plainToInstance(CreateSharedExpenseDto, { ...validDto, name: 123 });
        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
    });
    //#endregion

    //#region amount validation
    it('should reject when amount is less than 1', async () => {
        const dto = plainToInstance(CreateSharedExpenseDto, { ...validDto, amount: 0 });
        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].constraints).toHaveProperty('min');
    });

    it('should accept amount at minimum (1)', async () => {
        const dto = plainToInstance(CreateSharedExpenseDto, { ...validDto, amount: 1 });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
    });

    it('should reject when amount is not a number', async () => {
        const dto = plainToInstance(CreateSharedExpenseDto, { ...validDto, amount: 'abc' });
        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
    });
    //#endregion

    //#region category validation
    it('should reject invalid category', async () => {
        const dto = plainToInstance(CreateSharedExpenseDto, { ...validDto, category: 'INVALID' });
        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].constraints).toHaveProperty('isEnum');
    });
    //#endregion

    //#region frequency validation
    it('should reject invalid frequency', async () => {
        const dto = plainToInstance(CreateSharedExpenseDto, { ...validDto, frequency: 'WEEKLY' });
        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].constraints).toHaveProperty('isEnum');
    });
    //#endregion

    //#region paidByUserId validation
    it('should reject invalid UUID for paidByUserId', async () => {
        const dto = plainToInstance(CreateSharedExpenseDto, { ...validDto, paidByUserId: 'not-a-uuid' });
        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].constraints).toHaveProperty('isUuid');
    });
    //#endregion

    //#region yearly fields validation
    it('should accept a yearly expense with FULL strategy and paymentMonth', async () => {
        const dto = plainToInstance(CreateSharedExpenseDto, {
            ...validDto,
            frequency: ExpenseFrequency.YEARLY,
            yearlyPaymentStrategy: YearlyPaymentStrategy.FULL,
            paymentMonth: 6,
        });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
    });

    it('should accept a yearly expense with INSTALLMENTS strategy', async () => {
        const dto = plainToInstance(CreateSharedExpenseDto, {
            ...validDto,
            frequency: ExpenseFrequency.YEARLY,
            yearlyPaymentStrategy: YearlyPaymentStrategy.INSTALLMENTS,
            installmentFrequency: InstallmentFrequency.QUARTERLY,
        });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
    });

    it('should reject paymentMonth below 1', async () => {
        const dto = plainToInstance(CreateSharedExpenseDto, {
            ...validDto,
            frequency: ExpenseFrequency.YEARLY,
            yearlyPaymentStrategy: YearlyPaymentStrategy.FULL,
            paymentMonth: 0,
        });
        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject paymentMonth above 12', async () => {
        const dto = plainToInstance(CreateSharedExpenseDto, {
            ...validDto,
            frequency: ExpenseFrequency.YEARLY,
            yearlyPaymentStrategy: YearlyPaymentStrategy.FULL,
            paymentMonth: 13,
        });
        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
    });
    //#endregion

    //#region one-time fields validation
    it('should accept a one-time expense with month and year', async () => {
        const dto = plainToInstance(CreateSharedExpenseDto, {
            ...validDto,
            category: ExpenseCategory.ONE_TIME,
            month: 3,
            year: 2026,
        });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
    });

    it('should reject month below 1 for one-time expense', async () => {
        const dto = plainToInstance(CreateSharedExpenseDto, {
            ...validDto,
            category: ExpenseCategory.ONE_TIME,
            month: 0,
            year: 2026,
        });
        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject month above 12 for one-time expense', async () => {
        const dto = plainToInstance(CreateSharedExpenseDto, {
            ...validDto,
            category: ExpenseCategory.ONE_TIME,
            month: 13,
            year: 2026,
        });
        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
    });
    //#endregion
});
