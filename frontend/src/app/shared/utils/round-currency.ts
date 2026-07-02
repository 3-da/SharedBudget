/**
 * Rounds a monetary value to two decimal places (cents).
 * Mirrors the backend's roundCurrency so amounts computed on both sides round
 * the same way, instead of repeating `Math.round(x * 100) / 100` at each call site.
 */
export function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}
