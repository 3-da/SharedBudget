import { ExpenseFrequency, InstallmentFrequency, YearlyPaymentStrategy } from '../models';
import {
  buildInstallmentTimeline,
  buildRecurringTimeline,
  getDefaultInstallmentCount,
  getStepMonths,
  overrideKey,
  TimelineExpense,
  TimelineOverride,
} from './timeline';

describe('timeline utils', () => {
  describe('getStepMonths', () => {
    it('returns 3 for quarterly', () => expect(getStepMonths(InstallmentFrequency.QUARTERLY)).toBe(3));
    it('returns 6 for semi-annual', () => expect(getStepMonths(InstallmentFrequency.SEMI_ANNUAL)).toBe(6));
    it('returns 1 for monthly/default', () => expect(getStepMonths(InstallmentFrequency.MONTHLY)).toBe(1));
  });

  describe('getDefaultInstallmentCount', () => {
    it('returns 4 for quarterly', () => expect(getDefaultInstallmentCount(InstallmentFrequency.QUARTERLY)).toBe(4));
    it('returns 2 for semi-annual', () => expect(getDefaultInstallmentCount(InstallmentFrequency.SEMI_ANNUAL)).toBe(2));
    it('returns 12 by default', () => expect(getDefaultInstallmentCount(null)).toBe(12));
  });

  describe('buildRecurringTimeline', () => {
    const monthly: TimelineExpense = { amount: 50, frequency: ExpenseFrequency.MONTHLY };

    it('produces a 25-month window for a monthly expense', () => {
      const months = buildRecurringTimeline(monthly, 50, 6, 2026);
      expect(months).toHaveLength(25); // -12..+12 inclusive
      expect(months.every(m => m.amount === 50)).toBe(true);
    });

    it('marks the current month and past months', () => {
      const months = buildRecurringTimeline(monthly, 50, 6, 2026);
      const current = months.find(m => m.month === 6 && m.year === 2026);
      expect(current?.isCurrent).toBe(true);
      const earlier = months.find(m => m.month === 5 && m.year === 2026);
      expect(earlier?.isPast).toBe(true);
    });

    it('only emits the payment month for a yearly FULL expense, anchored to paymentMonth not month', () => {
      const yearly: TimelineExpense = {
        amount: 1200,
        frequency: ExpenseFrequency.YEARLY,
        yearlyPaymentStrategy: YearlyPaymentStrategy.FULL,
        paymentMonth: 9,
        month: null, // recurring yearly expenses never set `month` — only paymentMonth
      };
      const months = buildRecurringTimeline(yearly, 1200, 6, 2026);
      expect(months.every(m => m.month === 9)).toBe(true);
    });

    it('defaults a yearly FULL expense with no paymentMonth to January (matches the backend default)', () => {
      const yearly: TimelineExpense = {
        amount: 1200,
        frequency: ExpenseFrequency.YEARLY,
        yearlyPaymentStrategy: YearlyPaymentStrategy.FULL,
      };
      const months = buildRecurringTimeline(yearly, 1200, 6, 2026);
      expect(months.every(m => m.month === 1)).toBe(true);
    });

    it('emits every third month for a yearly QUARTERLY installment expense, anchored to the creation month', () => {
      const yearly: TimelineExpense = {
        amount: 1200,
        frequency: ExpenseFrequency.YEARLY,
        yearlyPaymentStrategy: YearlyPaymentStrategy.INSTALLMENTS,
        installmentFrequency: InstallmentFrequency.QUARTERLY,
        createdAt: '2026-02-15T00:00:00.000Z', // created in February → anchor month 2
      };
      const months = buildRecurringTimeline(yearly, 300, 6, 2026);
      // Anchored to month 2 → only months 2, 5, 8, 11 appear
      expect(months.every(m => [2, 5, 8, 11].includes(m.month))).toBe(true);
    });

    it('applies an override amount and flags the month', () => {
      const overrides = new Map<string, TimelineOverride>([[overrideKey(2026, 6), { amount: 75, skipped: false }]]);
      const months = buildRecurringTimeline(monthly, 50, 6, 2026, overrides);
      const overridden = months.find(m => m.month === 6 && m.year === 2026);
      expect(overridden?.amount).toBe(75);
      expect(overridden?.isOverride).toBe(true);
    });

    it('shows zero for a skipped month override', () => {
      const overrides = new Map<string, TimelineOverride>([[overrideKey(2026, 6), { amount: null, skipped: true }]]);
      const months = buildRecurringTimeline(monthly, 50, 6, 2026, overrides);
      const skipped = months.find(m => m.month === 6 && m.year === 2026);
      expect(skipped?.amount).toBe(0);
      expect(skipped?.isOverride).toBe(true);
    });
  });

  describe('overrideKey', () => {
    it('formats a year and month as a stable map key', () => {
      expect(overrideKey(2026, 6)).toBe('2026-6');
    });
  });

  describe('buildInstallmentTimeline', () => {
    it('spreads the total across the installment count', () => {
      const expense: TimelineExpense = {
        amount: 1200,
        installmentCount: 12,
        installmentFrequency: InstallmentFrequency.MONTHLY,
        month: 1,
        year: 2026,
      };
      const months = buildInstallmentTimeline(expense, 6, 2026);
      expect(months).toHaveLength(12);
      expect(months.every(m => m.amount === 100)).toBe(true);
      expect(months[0]).toMatchObject({ month: 1, year: 2026 });
    });

    it('steps quarterly installments across the year boundary', () => {
      const expense: TimelineExpense = {
        amount: 800,
        installmentCount: 8,
        installmentFrequency: InstallmentFrequency.QUARTERLY,
        month: 11,
        year: 2025,
      };
      const months = buildInstallmentTimeline(expense, 6, 2026);
      expect(months).toHaveLength(8);
      expect(months[0]).toMatchObject({ month: 11, year: 2025 });
      expect(months[1]).toMatchObject({ month: 2, year: 2026 });
      expect(months.every(m => m.amount === 100)).toBe(true);
    });

    it('rounds the per-installment amount to two decimals', () => {
      const expense: TimelineExpense = {
        amount: 100,
        installmentCount: 3,
        installmentFrequency: InstallmentFrequency.MONTHLY,
        month: 1,
        year: 2026,
      };
      const months = buildInstallmentTimeline(expense, 6, 2026);
      expect(months[0].amount).toBe(33.33);
    });
  });
});
