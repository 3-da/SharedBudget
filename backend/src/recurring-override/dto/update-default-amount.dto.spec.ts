import { describe, expect, it } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateDefaultAmountDto } from './update-default-amount.dto';

describe('UpdateDefaultAmountDto', () => {
    it('should accept valid amount', async () => {
        const dto = plainToInstance(UpdateDefaultAmountDto, { amount: 500.0 });
        const errors = await validate(dto);

        expect(errors.length).toBe(0);
    });

    describe('amount', () => {
        it('should accept amount at minimum (boundary: 1)', async () => {
            const dto = plainToInstance(UpdateDefaultAmountDto, { amount: 1 });
            const errors = await validate(dto);

            expect(errors.length).toBe(0);
        });

        it('should reject amount below minimum (boundary: 0.99)', async () => {
            const dto = plainToInstance(UpdateDefaultAmountDto, { amount: 0.99 });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].property).toBe('amount');
            expect(errors[0].constraints).toHaveProperty('min');
        });

        it('should reject amount of zero (boundary: 0)', async () => {
            const dto = plainToInstance(UpdateDefaultAmountDto, { amount: 0 });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].property).toBe('amount');
            expect(errors[0].constraints).toHaveProperty('min');
        });

        it('should reject negative amount', async () => {
            const dto = plainToInstance(UpdateDefaultAmountDto, { amount: -10 });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].property).toBe('amount');
            expect(errors[0].constraints).toHaveProperty('min');
        });

        it('should accept decimal amount above minimum', async () => {
            const dto = plainToInstance(UpdateDefaultAmountDto, { amount: 1.01 });
            const errors = await validate(dto);

            expect(errors.length).toBe(0);
        });

        it('should reject non-number amount', async () => {
            const dto = plainToInstance(UpdateDefaultAmountDto, { amount: 'abc' });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].property).toBe('amount');
            expect(errors[0].constraints).toHaveProperty('isNumber');
        });

        it('should reject missing amount', async () => {
            const dto = plainToInstance(UpdateDefaultAmountDto, {});
            const errors = await validate(dto);

            expect(errors.length).toBe(1);
            expect(errors[0].property).toBe('amount');
        });
    });
});
