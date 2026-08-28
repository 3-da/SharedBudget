import { describe, expect, it } from 'vitest';
import { buildDemoMonthPeriods } from './demo-month-periods';
import { buildDemoSavingRows } from './demo-seed-data';

describe('demo seed data', () => {
    const referenceDate = new Date('2026-08-15T12:00:00.000Z');

    it('builds a twelve-month window ending in the reference month', () => {
        const demoMonthPeriods = buildDemoMonthPeriods(referenceDate);

        expect(demoMonthPeriods).toHaveLength(12);
        expect(demoMonthPeriods[0]).toEqual({ month: 9, year: 2025 });
        expect(demoMonthPeriods[11]).toEqual({ month: 8, year: 2026 });
    });

    it('builds personal and shared savings for both household members every month', () => {
        const demoMonthPeriods = buildDemoMonthPeriods(referenceDate);
        const demoSavingRows = buildDemoSavingRows('alex-id', 'sam-id', 'household-id', demoMonthPeriods);

        expect(demoSavingRows).toHaveLength(48);
        expect(demoSavingRows.filter((demoSavingRow) => demoSavingRow.isShared)).toHaveLength(24);
        expect(demoSavingRows.every((demoSavingRow) => demoSavingRow.amount > 0)).toBe(true);
    });
});
