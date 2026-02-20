import { describe, expect, it } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { BatchUpsertOverrideDto, BatchOverrideItemDto } from './batch-upsert-override.dto';

describe('BatchOverrideItemDto', () => {
    const validItem = { year: 2026, month: 6, amount: 450.0 };

    describe('valid inputs', () => {
        it('should accept valid override item', async () => {
            const dto = plainToInstance(BatchOverrideItemDto, validItem);
            const errors = await validate(dto);

            expect(errors.length).toBe(0);
        });

        it('should accept zero amount (boundary: minimum valid)', async () => {
            const dto = plainToInstance(BatchOverrideItemDto, { ...validItem, amount: 0 });
            const errors = await validate(dto);

            expect(errors.length).toBe(0);
        });

        it('should accept month 1 (boundary: minimum valid)', async () => {
            const dto = plainToInstance(BatchOverrideItemDto, { ...validItem, month: 1 });
            const errors = await validate(dto);

            expect(errors.length).toBe(0);
        });

        it('should accept month 12 (boundary: maximum valid)', async () => {
            const dto = plainToInstance(BatchOverrideItemDto, { ...validItem, month: 12 });
            const errors = await validate(dto);

            expect(errors.length).toBe(0);
        });

        it('should accept year 2020 (boundary: minimum valid)', async () => {
            const dto = plainToInstance(BatchOverrideItemDto, { ...validItem, year: 2020 });
            const errors = await validate(dto);

            expect(errors.length).toBe(0);
        });

        it('should accept year 2100 (boundary: maximum valid)', async () => {
            const dto = plainToInstance(BatchOverrideItemDto, { ...validItem, year: 2100 });
            const errors = await validate(dto);

            expect(errors.length).toBe(0);
        });

        it('should accept optional skipped=true', async () => {
            const dto = plainToInstance(BatchOverrideItemDto, { ...validItem, skipped: true });
            const errors = await validate(dto);

            expect(errors.length).toBe(0);
        });

        it('should accept optional skipped=false', async () => {
            const dto = plainToInstance(BatchOverrideItemDto, { ...validItem, skipped: false });
            const errors = await validate(dto);

            expect(errors.length).toBe(0);
        });

        it('should accept without skipped field', async () => {
            const dto = plainToInstance(BatchOverrideItemDto, validItem);
            const errors = await validate(dto);

            expect(errors.length).toBe(0);
        });
    });

    describe('year validation', () => {
        it('should reject year below 2020 (boundary: one below minimum)', async () => {
            const dto = plainToInstance(BatchOverrideItemDto, { ...validItem, year: 2019 });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].property).toBe('year');
            expect(errors[0].constraints).toHaveProperty('min');
        });

        it('should reject year above 2100 (boundary: one above maximum)', async () => {
            const dto = plainToInstance(BatchOverrideItemDto, { ...validItem, year: 2101 });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].property).toBe('year');
            expect(errors[0].constraints).toHaveProperty('max');
        });

        it('should reject non-integer year', async () => {
            const dto = plainToInstance(BatchOverrideItemDto, { ...validItem, year: 2026.5 });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].property).toBe('year');
        });
    });

    describe('month validation', () => {
        it('should reject month 0 (boundary: one below minimum)', async () => {
            const dto = plainToInstance(BatchOverrideItemDto, { ...validItem, month: 0 });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].property).toBe('month');
            expect(errors[0].constraints).toHaveProperty('min');
        });

        it('should reject month 13 (boundary: one above maximum)', async () => {
            const dto = plainToInstance(BatchOverrideItemDto, { ...validItem, month: 13 });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].property).toBe('month');
            expect(errors[0].constraints).toHaveProperty('max');
        });

        it('should reject non-integer month', async () => {
            const dto = plainToInstance(BatchOverrideItemDto, { ...validItem, month: 6.5 });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].property).toBe('month');
        });
    });

    describe('amount validation', () => {
        it('should reject negative amount (boundary: one below minimum)', async () => {
            const dto = plainToInstance(BatchOverrideItemDto, { ...validItem, amount: -0.01 });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].property).toBe('amount');
            expect(errors[0].constraints).toHaveProperty('min');
        });

        it('should reject non-numeric amount', async () => {
            const dto = plainToInstance(BatchOverrideItemDto, { ...validItem, amount: 'abc' });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].property).toBe('amount');
        });
    });
});

describe('BatchUpsertOverrideDto', () => {
    it('should accept valid overrides array', async () => {
        const dto = plainToInstance(BatchUpsertOverrideDto, {
            overrides: [
                { year: 2026, month: 7, amount: 55.0 },
                { year: 2026, month: 8, amount: 55.0, skipped: false },
            ],
        });
        const errors = await validate(dto);

        expect(errors.length).toBe(0);
    });

    it('should accept empty overrides array', async () => {
        const dto = plainToInstance(BatchUpsertOverrideDto, { overrides: [] });
        const errors = await validate(dto);

        expect(errors.length).toBe(0);
    });

    it('should reject missing overrides field', async () => {
        const dto = plainToInstance(BatchUpsertOverrideDto, {});
        const errors = await validate(dto);

        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].property).toBe('overrides');
    });

    it('should reject non-array overrides', async () => {
        const dto = plainToInstance(BatchUpsertOverrideDto, { overrides: 'not-array' });
        const errors = await validate(dto);

        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].property).toBe('overrides');
    });

    it('should reject invalid items within overrides array', async () => {
        const dto = plainToInstance(BatchUpsertOverrideDto, {
            overrides: [{ year: 2026, month: 13, amount: -1 }],
        });
        const errors = await validate(dto);

        expect(errors.length).toBeGreaterThan(0);
    });
});
