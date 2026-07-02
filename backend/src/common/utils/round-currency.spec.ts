import { describe, expect, it } from 'vitest';
import { roundCurrency } from './round-currency';

describe('roundCurrency', () => {
    it('should round to two decimal places', () => {
        expect(roundCurrency(33.333333)).toBe(33.33);
    });

    it('should round up when the third decimal is 5 or more', () => {
        expect(roundCurrency(10.567)).toBe(10.57);
    });

    it('should round down when the third decimal is below 5', () => {
        expect(roundCurrency(10.561)).toBe(10.56);
    });

    it('should leave already-rounded values unchanged', () => {
        expect(roundCurrency(49.99)).toBe(49.99);
    });
});
