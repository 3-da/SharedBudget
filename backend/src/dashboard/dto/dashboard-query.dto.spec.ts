import { describe, expect, it } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { DashboardQueryDto } from './dashboard-query.dto';

describe('DashboardQueryDto', () => {
    it('should accept empty object (no params)', async () => {
        const dto = plainToInstance(DashboardQueryDto, {});
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
    });

    it('should accept valid month and year', async () => {
        const dto = plainToInstance(DashboardQueryDto, { month: 6, year: 2026 });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
    });

    it('should accept month only', async () => {
        const dto = plainToInstance(DashboardQueryDto, { month: 3 });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
    });

    it('should accept year only', async () => {
        const dto = plainToInstance(DashboardQueryDto, { year: 2025 });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
    });

    describe('month', () => {
        it('should accept month at boundary min (1)', async () => {
            const dto = plainToInstance(DashboardQueryDto, { month: 1 });
            const errors = await validate(dto);
            expect(errors.length).toBe(0);
        });

        it('should accept month at boundary max (12)', async () => {
            const dto = plainToInstance(DashboardQueryDto, { month: 12 });
            const errors = await validate(dto);
            expect(errors.length).toBe(0);
        });

        it('should reject month below min (0)', async () => {
            const dto = plainToInstance(DashboardQueryDto, { month: 0 });
            const errors = await validate(dto);
            const monthError = errors.find((e) => e.property === 'month');
            expect(monthError).toBeDefined();
            expect(monthError!.constraints).toHaveProperty('min');
        });

        it('should reject month above max (13)', async () => {
            const dto = plainToInstance(DashboardQueryDto, { month: 13 });
            const errors = await validate(dto);
            const monthError = errors.find((e) => e.property === 'month');
            expect(monthError).toBeDefined();
            expect(monthError!.constraints).toHaveProperty('max');
        });

        it('should reject non-integer month (1.5)', async () => {
            const dto = plainToInstance(DashboardQueryDto, { month: 1.5 });
            const errors = await validate(dto);
            const monthError = errors.find((e) => e.property === 'month');
            expect(monthError).toBeDefined();
            expect(monthError!.constraints).toHaveProperty('isInt');
        });

        it('should transform string month to number', async () => {
            const dto = plainToInstance(DashboardQueryDto, { month: '6' });
            const errors = await validate(dto);
            expect(errors.length).toBe(0);
            expect(dto.month).toBe(6);
        });
    });

    describe('year', () => {
        it('should accept year at boundary min (2000)', async () => {
            const dto = plainToInstance(DashboardQueryDto, { year: 2000 });
            const errors = await validate(dto);
            expect(errors.length).toBe(0);
        });

        it('should reject year below min (1999)', async () => {
            const dto = plainToInstance(DashboardQueryDto, { year: 1999 });
            const errors = await validate(dto);
            const yearError = errors.find((e) => e.property === 'year');
            expect(yearError).toBeDefined();
            expect(yearError!.constraints).toHaveProperty('min');
        });

        it('should reject non-integer year (2026.5)', async () => {
            const dto = plainToInstance(DashboardQueryDto, { year: 2026.5 });
            const errors = await validate(dto);
            const yearError = errors.find((e) => e.property === 'year');
            expect(yearError).toBeDefined();
            expect(yearError!.constraints).toHaveProperty('isInt');
        });

        it('should transform string year to number', async () => {
            const dto = plainToInstance(DashboardQueryDto, { year: '2026' });
            const errors = await validate(dto);
            expect(errors.length).toBe(0);
            expect(dto.year).toBe(2026);
        });
    });
});
