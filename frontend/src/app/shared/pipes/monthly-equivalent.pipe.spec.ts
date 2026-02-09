import { MonthlyEquivalentPipe } from './monthly-equivalent.pipe';
import { ExpenseFrequency } from '../models/enums';

describe('MonthlyEquivalentPipe', () => {
  const pipe = new MonthlyEquivalentPipe();

  it('should divide yearly amount by 12', () => {
    expect(pipe.transform(1200, ExpenseFrequency.YEARLY)).toBe(100);
  });

  it('should return same amount for MONTHLY', () => {
    expect(pipe.transform(500, ExpenseFrequency.MONTHLY)).toBe(500);
  });

  it('should round to 2 decimal places', () => {
    expect(pipe.transform(1000, ExpenseFrequency.YEARLY)).toBe(83.33);
  });

  it('should handle zero amount', () => {
    expect(pipe.transform(0, ExpenseFrequency.YEARLY)).toBe(0);
  });
});
