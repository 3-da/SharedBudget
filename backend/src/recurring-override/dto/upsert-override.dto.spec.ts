import { describe, expect, it } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpsertOverrideDto } from './upsert-override.dto';

describe('UpsertOverrideDto', () => {
    const validData = { amount: 450.0 };

    it('should accept valid data with only required fields', async () => {
        const dto = plainToInstance(UpsertOverrideDto, validData);
        const errors = await validate(dto);

        expect(errors.length).toBe(0);
    });

    it('should accept valid data with all fields', async () => {
        const dto = plainToInstance(UpsertOverrideDto, { amount: 300.0, skipped: true });
        const errors = await validate(dto);

        expect(errors.length).toBe(0);
    });

    describe('amount', () => {
        it('should accept amount at minimum (boundary: 0)', async () => {
            const dto = plainToInstance(UpsertOverrideDto, { ...validData, amount: 0 });
            const errors = await validate(dto);

            expect(errors.length).toBe(0);
        });

        it('should reject amount below minimum (boundary: -0.01)', async () => {
            const dto = plainToInstance(UpsertOverrideDto, { ...validData, amount: -0.01 });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            const amountError = errors.find((e) => e.property === 'amount');
            expect(amountError).toBeDefined();
            expect(amountError!.constraints).toHaveProperty('min');
        });

        it('should accept decimal amount', async () => {
            const dto = plainToInstance(UpsertOverrideDto, { ...validData, amount: 99.99 });
            const errors = await validate(dto);

            expect(errors.length).toBe(0);
        });

        it('should reject non-number amount', async () => {
            const dto = plainToInstance(UpsertOverrideDto, { ...validData, amount: 'abc' });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            const amountError = errors.find((e) => e.property === 'amount');
            expect(amountError).toBeDefined();
            expect(amountError!.constraints).toHaveProperty('isNumber');
        });

        it('should reject missing amount', async () => {
            const dto = plainToInstance(UpsertOverrideDto, {});
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            const amountError = errors.find((e) => e.property === 'amount');
            expect(amountError).toBeDefined();
        });
    });

    describe('skipped', () => {
        it('should accept skipped as true', async () => {
            const dto = plainToInstance(UpsertOverrideDto, { ...validData, skipped: true });
            const errors = await validate(dto);

            expect(errors.length).toBe(0);
        });

        it('should accept skipped as false', async () => {
            const dto = plainToInstance(UpsertOverrideDto, { ...validData, skipped: false });
            const errors = await validate(dto);

            expect(errors.length).toBe(0);
        });

        it('should accept missing skipped (optional)', async () => {
            const dto = plainToInstance(UpsertOverrideDto, { amount: 100 });
            const errors = await validate(dto);

            expect(errors.length).toBe(0);
        });

        it('should reject non-boolean skipped', async () => {
            const dto = plainToInstance(UpsertOverrideDto, { ...validData, skipped: 'yes' });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            const skippedError = errors.find((e) => e.property === 'skipped');
            expect(skippedError).toBeDefined();
            expect(skippedError!.constraints).toHaveProperty('isBoolean');
        });

        it('should reject numeric value for skipped', async () => {
            const dto = plainToInstance(UpsertOverrideDto, { ...validData, skipped: 1 });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            const skippedError = errors.find((e) => e.property === 'skipped');
            expect(skippedError).toBeDefined();
            expect(skippedError!.constraints).toHaveProperty('isBoolean');
        });
    });
});
