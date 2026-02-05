import { describe, expect, it } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpsertSalaryDto } from './upsert-salary.dto';

describe('UpsertSalaryDto', () => {
    const validDto = { defaultAmount: 3500, currentAmount: 3200 };

    describe('valid inputs', () => {
        it('should accept valid salary amounts', async () => {
            const dto = plainToInstance(UpsertSalaryDto, validDto);
            const errors = await validate(dto);

            expect(errors.length).toBe(0);
        });

        it('should accept zero as a valid amount (boundary: minimum valid)', async () => {
            const dto = plainToInstance(UpsertSalaryDto, { defaultAmount: 0, currentAmount: 0 });
            const errors = await validate(dto);

            expect(errors.length).toBe(0);
        });

        it('should accept decimal amounts', async () => {
            const dto = plainToInstance(UpsertSalaryDto, { defaultAmount: 3500.5, currentAmount: 3200.99 });
            const errors = await validate(dto);

            expect(errors.length).toBe(0);
        });

        it('should accept very large amounts', async () => {
            const dto = plainToInstance(UpsertSalaryDto, { defaultAmount: 9999999999.99, currentAmount: 9999999999.99 });
            const errors = await validate(dto);

            expect(errors.length).toBe(0);
        });
    });

    describe('defaultAmount validation', () => {
        it('should reject negative defaultAmount (boundary: one below minimum)', async () => {
            const dto = plainToInstance(UpsertSalaryDto, { defaultAmount: -1, currentAmount: 3200 });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].property).toBe('defaultAmount');
            expect(errors[0].constraints).toHaveProperty('min');
        });

        it('should reject negative fractional defaultAmount', async () => {
            const dto = plainToInstance(UpsertSalaryDto, { defaultAmount: -0.01, currentAmount: 3200 });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].property).toBe('defaultAmount');
            expect(errors[0].constraints).toHaveProperty('min');
        });

        it('should reject non-numeric defaultAmount', async () => {
            const dto = plainToInstance(UpsertSalaryDto, { defaultAmount: 'abc', currentAmount: 3200 });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].property).toBe('defaultAmount');
        });

        it('should reject missing defaultAmount', async () => {
            const dto = plainToInstance(UpsertSalaryDto, { currentAmount: 3200 });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            expect(errors.some((e) => e.property === 'defaultAmount')).toBe(true);
        });
    });

    describe('currentAmount validation', () => {
        it('should reject negative currentAmount (boundary: one below minimum)', async () => {
            const dto = plainToInstance(UpsertSalaryDto, { defaultAmount: 3500, currentAmount: -1 });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].property).toBe('currentAmount');
            expect(errors[0].constraints).toHaveProperty('min');
        });

        it('should reject negative fractional currentAmount', async () => {
            const dto = plainToInstance(UpsertSalaryDto, { defaultAmount: 3500, currentAmount: -0.01 });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].property).toBe('currentAmount');
            expect(errors[0].constraints).toHaveProperty('min');
        });

        it('should reject non-numeric currentAmount', async () => {
            const dto = plainToInstance(UpsertSalaryDto, { defaultAmount: 3500, currentAmount: 'abc' });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            expect(errors.some((e) => e.property === 'currentAmount')).toBe(true);
        });

        it('should reject missing currentAmount', async () => {
            const dto = plainToInstance(UpsertSalaryDto, { defaultAmount: 3500 });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            expect(errors.some((e) => e.property === 'currentAmount')).toBe(true);
        });
    });

    describe('both fields missing', () => {
        it('should reject empty object', async () => {
            const dto = plainToInstance(UpsertSalaryDto, {});
            const errors = await validate(dto);

            expect(errors.length).toBe(2);
            expect(errors.map((e) => e.property).sort()).toEqual(['currentAmount', 'defaultAmount']);
        });
    });
});
