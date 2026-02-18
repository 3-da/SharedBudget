import { describe, expect, it } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { MarkPaidDto } from './mark-paid.dto';

describe('MarkPaidDto', () => {
    const validData = { month: 6, year: 2026 };

    it('should accept valid data', async () => {
        const dto = plainToInstance(MarkPaidDto, validData);
        const errors = await validate(dto);

        expect(errors.length).toBe(0);
    });

    describe('month', () => {
        it('should accept month at minimum (boundary: 1)', async () => {
            const dto = plainToInstance(MarkPaidDto, { ...validData, month: 1 });
            const errors = await validate(dto);

            expect(errors.length).toBe(0);
        });

        it('should reject month below minimum (boundary: 0)', async () => {
            const dto = plainToInstance(MarkPaidDto, { ...validData, month: 0 });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            const monthError = errors.find((e) => e.property === 'month');
            expect(monthError).toBeDefined();
            expect(monthError!.constraints).toHaveProperty('min');
        });

        it('should accept month at maximum (boundary: 12)', async () => {
            const dto = plainToInstance(MarkPaidDto, { ...validData, month: 12 });
            const errors = await validate(dto);

            expect(errors.length).toBe(0);
        });

        it('should reject month above maximum (boundary: 13)', async () => {
            const dto = plainToInstance(MarkPaidDto, { ...validData, month: 13 });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            const monthError = errors.find((e) => e.property === 'month');
            expect(monthError).toBeDefined();
            expect(monthError!.constraints).toHaveProperty('max');
        });

        it('should reject non-integer month (boundary: 6.5)', async () => {
            const dto = plainToInstance(MarkPaidDto, { ...validData, month: 6.5 });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            const monthError = errors.find((e) => e.property === 'month');
            expect(monthError).toBeDefined();
            expect(monthError!.constraints).toHaveProperty('isInt');
        });

        it('should reject missing month', async () => {
            const dto = plainToInstance(MarkPaidDto, { year: 2026 });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            const monthError = errors.find((e) => e.property === 'month');
            expect(monthError).toBeDefined();
        });
    });

    describe('year', () => {
        it('should accept year at minimum (boundary: 2020)', async () => {
            const dto = plainToInstance(MarkPaidDto, { ...validData, year: 2020 });
            const errors = await validate(dto);

            expect(errors.length).toBe(0);
        });

        it('should reject year below minimum (boundary: 2019)', async () => {
            const dto = plainToInstance(MarkPaidDto, { ...validData, year: 2019 });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            const yearError = errors.find((e) => e.property === 'year');
            expect(yearError).toBeDefined();
            expect(yearError!.constraints).toHaveProperty('min');
        });

        it('should accept year at maximum (boundary: 2099)', async () => {
            const dto = plainToInstance(MarkPaidDto, { ...validData, year: 2099 });
            const errors = await validate(dto);

            expect(errors.length).toBe(0);
        });

        it('should reject year above maximum (boundary: 2100)', async () => {
            const dto = plainToInstance(MarkPaidDto, { ...validData, year: 2100 });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            const yearError = errors.find((e) => e.property === 'year');
            expect(yearError).toBeDefined();
            expect(yearError!.constraints).toHaveProperty('max');
        });

        it('should reject non-integer year (boundary: 2026.5)', async () => {
            const dto = plainToInstance(MarkPaidDto, { ...validData, year: 2026.5 });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            const yearError = errors.find((e) => e.property === 'year');
            expect(yearError).toBeDefined();
            expect(yearError!.constraints).toHaveProperty('isInt');
        });

        it('should reject missing year', async () => {
            const dto = plainToInstance(MarkPaidDto, { month: 6 });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            const yearError = errors.find((e) => e.property === 'year');
            expect(yearError).toBeDefined();
        });
    });

    it('should reject empty object with errors for both fields', async () => {
        const dto = plainToInstance(MarkPaidDto, {});
        const errors = await validate(dto);

        expect(errors.length).toBe(2);
        expect(errors.map((e) => e.property).sort()).toEqual(['month', 'year']);
    });
});
