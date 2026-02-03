import { describe, expect, it } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreatePersonalExpenseDto } from './create-personal-expense.dto';
import { ExpenseCategory, ExpenseFrequency, InstallmentFrequency, YearlyPaymentStrategy } from '../../generated/prisma/enums';

describe('CreatePersonalExpenseDto', () => {
    const validMonthly = {
        name: 'Gym membership',
        amount: 49.99,
        category: ExpenseCategory.RECURRING,
        frequency: ExpenseFrequency.MONTHLY,
    };

    describe('name', () => {
        it('should accept a valid name', async () => {
            const dto = plainToInstance(CreatePersonalExpenseDto, validMonthly);
            const errors = await validate(dto);
            expect(errors.length).toBe(0);
        });

        it('should reject empty name', async () => {
            const dto = plainToInstance(CreatePersonalExpenseDto, { ...validMonthly, name: '' });
            const errors = await validate(dto);
            const nameError = errors.find((e) => e.property === 'name');
            expect(errors.length).toBeGreaterThan(0);
            expect(nameError).toBeDefined();
        });

        it('should accept name at minimum length (1 character)', async () => {
            const dto = plainToInstance(CreatePersonalExpenseDto, { ...validMonthly, name: 'A' });
            const errors = await validate(dto);
            expect(errors.length).toBe(0);
        });

        it('should accept name at maximum length (100 characters)', async () => {
            const dto = plainToInstance(CreatePersonalExpenseDto, { ...validMonthly, name: 'A'.repeat(100) });
            const errors = await validate(dto);
            expect(errors.length).toBe(0);
        });

        it('should reject name exceeding maximum length (101 characters)', async () => {
            const dto = plainToInstance(CreatePersonalExpenseDto, { ...validMonthly, name: 'A'.repeat(101) });
            const errors = await validate(dto);
            const nameError = errors.find((e) => e.property === 'name');
            expect(nameError).toBeDefined();
            expect(nameError!.constraints).toHaveProperty('maxLength');
        });

        it('should reject non-string name', async () => {
            const dto = plainToInstance(CreatePersonalExpenseDto, { ...validMonthly, name: 12345 });
            const errors = await validate(dto);
            const nameError = errors.find((e) => e.property === 'name');
            expect(nameError).toBeDefined();
        });
    });

    describe('amount', () => {
        it('should accept amount at minimum (1)', async () => {
            const dto = plainToInstance(CreatePersonalExpenseDto, { ...validMonthly, amount: 1 });
            const errors = await validate(dto);
            expect(errors.length).toBe(0);
        });

        it('should reject amount below minimum (0.99)', async () => {
            const dto = plainToInstance(CreatePersonalExpenseDto, { ...validMonthly, amount: 0.99 });
            const errors = await validate(dto);
            const amountError = errors.find((e) => e.property === 'amount');
            expect(amountError).toBeDefined();
            expect(amountError!.constraints).toHaveProperty('min');
        });

        it('should reject non-number amount', async () => {
            const dto = plainToInstance(CreatePersonalExpenseDto, { ...validMonthly, amount: 'fifty' });
            const errors = await validate(dto);
            const amountError = errors.find((e) => e.property === 'amount');
            expect(amountError).toBeDefined();
        });
    });

    describe('category', () => {
        it('should accept valid category RECURRING', async () => {
            const dto = plainToInstance(CreatePersonalExpenseDto, { ...validMonthly, category: ExpenseCategory.RECURRING });
            const errors = await validate(dto);
            expect(errors.length).toBe(0);
        });

        it('should accept valid category ONE_TIME', async () => {
            const dto = plainToInstance(CreatePersonalExpenseDto, {
                ...validMonthly,
                category: ExpenseCategory.ONE_TIME,
                month: 3,
                year: 2026,
            });
            const errors = await validate(dto);
            expect(errors.length).toBe(0);
        });

        it('should reject invalid category', async () => {
            const dto = plainToInstance(CreatePersonalExpenseDto, { ...validMonthly, category: 'INVALID' });
            const errors = await validate(dto);
            const catError = errors.find((e) => e.property === 'category');
            expect(catError).toBeDefined();
            expect(catError!.constraints).toHaveProperty('isEnum');
        });
    });

    describe('frequency', () => {
        it('should reject invalid frequency', async () => {
            const dto = plainToInstance(CreatePersonalExpenseDto, { ...validMonthly, frequency: 'WEEKLY' });
            const errors = await validate(dto);
            const freqError = errors.find((e) => e.property === 'frequency');
            expect(freqError).toBeDefined();
            expect(freqError!.constraints).toHaveProperty('isEnum');
        });
    });

    describe('yearly frequency conditional validation', () => {
        it('should require installmentFrequency when strategy is INSTALLMENTS', async () => {
            const dto = plainToInstance(CreatePersonalExpenseDto, {
                ...validMonthly,
                frequency: ExpenseFrequency.YEARLY,
                yearlyPaymentStrategy: YearlyPaymentStrategy.INSTALLMENTS,
                // installmentFrequency is missing
            });
            const errors = await validate(dto);
            const freqError = errors.find((e) => e.property === 'installmentFrequency');
            expect(freqError).toBeDefined();
            expect(freqError!.constraints).toHaveProperty('isEnum');
        });

        it('should accept valid installmentFrequency when strategy is INSTALLMENTS', async () => {
            const dto = plainToInstance(CreatePersonalExpenseDto, {
                ...validMonthly,
                frequency: ExpenseFrequency.YEARLY,
                yearlyPaymentStrategy: YearlyPaymentStrategy.INSTALLMENTS,
                installmentFrequency: InstallmentFrequency.QUARTERLY,
            });
            const errors = await validate(dto);
            expect(errors.length).toBe(0);
        });

        it('should not require installmentFrequency when strategy is FULL', async () => {
            const dto = plainToInstance(CreatePersonalExpenseDto, {
                ...validMonthly,
                frequency: ExpenseFrequency.YEARLY,
                yearlyPaymentStrategy: YearlyPaymentStrategy.FULL,
                paymentMonth: 6,
                // installmentFrequency is missing — but ValidateIf skips it since strategy is FULL
            });
            const errors = await validate(dto);
            expect(errors.length).toBe(0);
        });

        it('should require yearlyPaymentStrategy when frequency is YEARLY', async () => {
            const dto = plainToInstance(CreatePersonalExpenseDto, {
                ...validMonthly,
                frequency: ExpenseFrequency.YEARLY,
                // yearlyPaymentStrategy is missing
            });
            const errors = await validate(dto);
            const stratError = errors.find((e) => e.property === 'yearlyPaymentStrategy');
            expect(stratError).toBeDefined();
            expect(stratError!.constraints).toHaveProperty('isEnum');
        });

        it('should not require yearlyPaymentStrategy when frequency is MONTHLY', async () => {
            const dto = plainToInstance(CreatePersonalExpenseDto, validMonthly);
            const errors = await validate(dto);
            expect(errors.length).toBe(0);
        });

        it('should require paymentMonth when strategy is FULL', async () => {
            const dto = plainToInstance(CreatePersonalExpenseDto, {
                ...validMonthly,
                frequency: ExpenseFrequency.YEARLY,
                yearlyPaymentStrategy: YearlyPaymentStrategy.FULL,
                // paymentMonth is missing
            });
            const errors = await validate(dto);
            const monthError = errors.find((e) => e.property === 'paymentMonth');
            expect(monthError).toBeDefined();
        });

        it('should accept paymentMonth at boundary min (1)', async () => {
            const dto = plainToInstance(CreatePersonalExpenseDto, {
                ...validMonthly,
                frequency: ExpenseFrequency.YEARLY,
                yearlyPaymentStrategy: YearlyPaymentStrategy.FULL,
                paymentMonth: 1,
            });
            const errors = await validate(dto);
            expect(errors.length).toBe(0);
        });

        it('should accept paymentMonth at boundary max (12)', async () => {
            const dto = plainToInstance(CreatePersonalExpenseDto, {
                ...validMonthly,
                frequency: ExpenseFrequency.YEARLY,
                yearlyPaymentStrategy: YearlyPaymentStrategy.FULL,
                paymentMonth: 12,
            });
            const errors = await validate(dto);
            expect(errors.length).toBe(0);
        });

        it('should reject paymentMonth above max (13)', async () => {
            const dto = plainToInstance(CreatePersonalExpenseDto, {
                ...validMonthly,
                frequency: ExpenseFrequency.YEARLY,
                yearlyPaymentStrategy: YearlyPaymentStrategy.FULL,
                paymentMonth: 13,
            });
            const errors = await validate(dto);
            const monthError = errors.find((e) => e.property === 'paymentMonth');
            expect(monthError).toBeDefined();
            expect(monthError!.constraints).toHaveProperty('max');
        });

        it('should reject paymentMonth below min (0)', async () => {
            const dto = plainToInstance(CreatePersonalExpenseDto, {
                ...validMonthly,
                frequency: ExpenseFrequency.YEARLY,
                yearlyPaymentStrategy: YearlyPaymentStrategy.FULL,
                paymentMonth: 0,
            });
            const errors = await validate(dto);
            const monthError = errors.find((e) => e.property === 'paymentMonth');
            expect(monthError).toBeDefined();
            expect(monthError!.constraints).toHaveProperty('min');
        });
    });

    //#region Conditional validation — ONE_TIME category
    describe('one-time category conditional validation', () => {
        it('should require month and year when category is ONE_TIME', async () => {
            const dto = plainToInstance(CreatePersonalExpenseDto, {
                ...validMonthly,
                category: ExpenseCategory.ONE_TIME,
                // month and year missing
            });
            const errors = await validate(dto);
            const monthError = errors.find((e) => e.property === 'month');
            const yearError = errors.find((e) => e.property === 'year');
            expect(monthError).toBeDefined();
            expect(yearError).toBeDefined();
        });

        it('should not require month and year when category is RECURRING', async () => {
            const dto = plainToInstance(CreatePersonalExpenseDto, validMonthly);
            const errors = await validate(dto);
            expect(errors.length).toBe(0);
        });

        it('should accept month at boundary min (1)', async () => {
            const dto = plainToInstance(CreatePersonalExpenseDto, {
                ...validMonthly,
                category: ExpenseCategory.ONE_TIME,
                month: 1,
                year: 2026,
            });
            const errors = await validate(dto);
            expect(errors.length).toBe(0);
        });

        it('should accept month at boundary max (12)', async () => {
            const dto = plainToInstance(CreatePersonalExpenseDto, {
                ...validMonthly,
                category: ExpenseCategory.ONE_TIME,
                month: 12,
                year: 2026,
            });
            const errors = await validate(dto);
            expect(errors.length).toBe(0);
        });

        it('should reject month above max (13)', async () => {
            const dto = plainToInstance(CreatePersonalExpenseDto, {
                ...validMonthly,
                category: ExpenseCategory.ONE_TIME,
                month: 13,
                year: 2026,
            });
            const errors = await validate(dto);
            const monthError = errors.find((e) => e.property === 'month');
            expect(monthError).toBeDefined();
            expect(monthError!.constraints).toHaveProperty('max');
        });

        it('should reject year below minimum (1999)', async () => {
            const dto = plainToInstance(CreatePersonalExpenseDto, {
                ...validMonthly,
                category: ExpenseCategory.ONE_TIME,
                month: 3,
                year: 1999,
            });
            const errors = await validate(dto);
            const yearError = errors.find((e) => e.property === 'year');
            expect(yearError).toBeDefined();
            expect(yearError!.constraints).toHaveProperty('min');
        });

        it('should accept year at boundary min (2000)', async () => {
            const dto = plainToInstance(CreatePersonalExpenseDto, {
                ...validMonthly,
                category: ExpenseCategory.ONE_TIME,
                month: 3,
                year: 2000,
            });
            const errors = await validate(dto);
            expect(errors.length).toBe(0);
        });
    });
    //#endregion
});
