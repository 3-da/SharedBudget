/**
 * Rounds a monetary value to two decimal places (cents).
 * Centralizes the currency rounding idiom so every calculation rounds the
 * same way instead of repeating `Math.round(x * 100) / 100` at each call site.
 */
export function roundCurrency(value: number): number {
    return Math.round(value * 100) / 100;
}
