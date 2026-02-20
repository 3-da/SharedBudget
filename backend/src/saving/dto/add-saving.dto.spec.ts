import { describe, expect, it } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { AddSavingDto } from './add-saving.dto';

describe('AddSavingDto', () => {
    const validData = { amount: 50.0 };

    it('should accept valid data with only required fields', async () => {
        const dto = plainToInstance(AddSavingDto, validData);
        const errors = await validate(dto);

        expect(errors.length).toBe(0);
    });

    it('should accept valid data with all fields', async () => {
        const dto = plainToInstance(AddSavingDto, { amount: 100.5, month: 6, year: 2026 });
        const errors = await validate(dto);

        expect(errors.length).toBe(0);
    });

    describe('amount', () => {
        it('should accept amount at minimum (boundary: 0.01)', async () => {
            const dto = plainToInstance(AddSavingDto, { amount: 0.01 });
            const errors = await validate(dto);

            expect(errors.length).toBe(0);
        });

        it('should reject amount below minimum (boundary: 0)', async () => {
            const dto = plainToInstance(AddSavingDto, { amount: 0 });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            const amountError = errors.find((e) => e.property === 'amount');
            expect(amountError).toBeDefined();
            expect(amountError!.constraints).toHaveProperty('min');
        });

        it('should reject negative amount', async () => {
            const dto = plainToInstance(AddSavingDto, { amount: -5 });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            const amountError = errors.find((e) => e.property === 'amount');
            expect(amountError).toBeDefined();
            expect(amountError!.constraints).toHaveProperty('min');
        });

        it('should reject non-number amount', async () => {
            const dto = plainToInstance(AddSavingDto, { amount: 'abc' });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            const amountError = errors.find((e) => e.property === 'amount');
            expect(amountError).toBeDefined();
            expect(amountError!.constraints).toHaveProperty('isNumber');
        });

        it('should reject missing amount', async () => {
            const dto = plainToInstance(AddSavingDto, {});
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            const amountError = errors.find((e) => e.property === 'amount');
            expect(amountError).toBeDefined();
        });
    });

    describe('month', () => {
        it('should accept month at minimum (boundary: 1)', async () => {
            const dto = plainToInstance(AddSavingDto, { ...validData, month: 1 });
            const errors = await validate(dto);

            expect(errors.length).toBe(0);
        });

        it('should reject month below minimum (boundary: 0)', async () => {
            const dto = plainToInstance(AddSavingDto, { ...validData, month: 0 });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            const monthError = errors.find((e) => e.property === 'month');
            expect(monthError).toBeDefined();
            expect(monthError!.constraints).toHaveProperty('min');
        });

        it('should accept month at maximum (boundary: 12)', async () => {
            const dto = plainToInstance(AddSavingDto, { ...validData, month: 12 });
            const errors = await validate(dto);

            expect(errors.length).toBe(0);
        });

        it('should reject month above maximum (boundary: 13)', async () => {
            const dto = plainToInstance(AddSavingDto, { ...validData, month: 13 });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            const monthError = errors.find((e) => e.property === 'month');
            expect(monthError).toBeDefined();
            expect(monthError!.constraints).toHaveProperty('max');
        });

        it('should reject non-integer month', async () => {
            const dto = plainToInstance(AddSavingDto, { ...validData, month: 6.5 });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            const monthError = errors.find((e) => e.property === 'month');
            expect(monthError).toBeDefined();
            expect(monthError!.constraints).toHaveProperty('isInt');
        });

        it('should accept missing month (optional)', async () => {
            const dto = plainToInstance(AddSavingDto, { amount: 50 });
            const errors = await validate(dto);

            expect(errors.length).toBe(0);
        });
    });

    describe('year', () => {
        it('should accept year at minimum (boundary: 2020)', async () => {
            const dto = plainToInstance(AddSavingDto, { ...validData, year: 2020 });
            const errors = await validate(dto);

            expect(errors.length).toBe(0);
        });

        it('should reject year below minimum (boundary: 2019)', async () => {
            const dto = plainToInstance(AddSavingDto, { ...validData, year: 2019 });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            const yearError = errors.find((e) => e.property === 'year');
            expect(yearError).toBeDefined();
            expect(yearError!.constraints).toHaveProperty('min');
        });

        it('should accept year at maximum (boundary: 2099)', async () => {
            const dto = plainToInstance(AddSavingDto, { ...validData, year: 2099 });
            const errors = await validate(dto);

            expect(errors.length).toBe(0);
        });

        it('should reject year above maximum (boundary: 2100)', async () => {
            const dto = plainToInstance(AddSavingDto, { ...validData, year: 2100 });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            const yearError = errors.find((e) => e.property === 'year');
            expect(yearError).toBeDefined();
            expect(yearError!.constraints).toHaveProperty('max');
        });

        it('should reject non-integer year', async () => {
            const dto = plainToInstance(AddSavingDto, { ...validData, year: 2026.5 });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            const yearError = errors.find((e) => e.property === 'year');
            expect(yearError).toBeDefined();
            expect(yearError!.constraints).toHaveProperty('isInt');
        });

        it('should accept missing year (optional)', async () => {
            const dto = plainToInstance(AddSavingDto, { amount: 50 });
            const errors = await validate(dto);

            expect(errors.length).toBe(0);
        });
    });
});
