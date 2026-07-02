import { describe, expect, it } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { IsCurrencyAmount } from './is-currency-amount.decorator';

class RequiredAmountDto {
    @IsCurrencyAmount({ example: 50, min: 1 })
    amount!: number;
}

class OptionalAmountDto {
    @IsCurrencyAmount({ example: 50, min: 0.01, optional: true })
    amount?: number;
}

describe('IsCurrencyAmount', () => {
    describe('required field', () => {
        it('should accept a value with exactly 2 decimal places', async () => {
            const dto = plainToInstance(RequiredAmountDto, { amount: 49.99 });
            const errors = await validate(dto);
            expect(errors.length).toBe(0);
        });

        it('should accept a whole number', async () => {
            const dto = plainToInstance(RequiredAmountDto, { amount: 50 });
            const errors = await validate(dto);
            expect(errors.length).toBe(0);
        });

        it('should reject a value with more than 2 decimal places', async () => {
            const dto = plainToInstance(RequiredAmountDto, { amount: 49.995 });
            const errors = await validate(dto);
            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].constraints).toHaveProperty('isNumber');
        });

        it('should reject a value below the configured minimum', async () => {
            const dto = plainToInstance(RequiredAmountDto, { amount: 0.5 });
            const errors = await validate(dto);
            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].constraints).toHaveProperty('min');
        });

        it('should reject a missing value', async () => {
            const dto = plainToInstance(RequiredAmountDto, {});
            const errors = await validate(dto);
            expect(errors.length).toBeGreaterThan(0);
        });
    });

    describe('optional field', () => {
        it('should accept a missing value', async () => {
            const dto = plainToInstance(OptionalAmountDto, {});
            const errors = await validate(dto);
            expect(errors.length).toBe(0);
        });

        it('should still reject a provided value with more than 2 decimal places', async () => {
            const dto = plainToInstance(OptionalAmountDto, { amount: 49.995 });
            const errors = await validate(dto);
            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].constraints).toHaveProperty('isNumber');
        });

        it('should still reject a provided value below the configured minimum', async () => {
            const dto = plainToInstance(OptionalAmountDto, { amount: 0 });
            const errors = await validate(dto);
            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].constraints).toHaveProperty('min');
        });
    });
});
