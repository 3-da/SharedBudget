import { ExpenseFrequency, InstallmentFrequency, YearlyPaymentStrategy } from '../models';
import { roundCurrency } from './round-currency';

export interface TimelineMonth {
  month: number;
  year: number;
  label: string;
  amount: number;
  isOverride?: boolean;
  isPast: boolean;
  isCurrent: boolean;
}

/** The minimal expense shape the timeline builders need. */
export interface TimelineExpense {
  amount: number | string;
  frequency?: ExpenseFrequency | null;
  yearlyPaymentStrategy?: YearlyPaymentStrategy | null;
  installmentFrequency?: InstallmentFrequency | null;
  installmentCount?: number | null;
  paymentMonth?: number | null;
  createdAt?: string | Date | null;
  month?: number | null;
  year?: number | null;
}

/** A per-month override keyed by overrideKey(year, month). */
export interface TimelineOverride {
  amount: number | null;
  skipped: boolean;
}

/** The shared key format for a per-month override map — the single source callers use to build and look up overrides. */
export function overrideKey(year: number, month: number): string {
  return `${year}-${month}`;
}

function formatMonthLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function isPastMonth(month: number, year: number, currentMonth: number, currentYear: number): boolean {
  return year < currentYear || (year === currentYear && month < currentMonth);
}

/**
 * The month a yearly INSTALLMENTS expense's schedule is anchored to. Mirrors
 * the backend's getYearlyInstallmentAmount, which anchors to the expense's
 * creation month rather than a fixed calendar month.
 */
function getInstallmentAnchorMonth(createdAt: TimelineExpense['createdAt']): number {
  return createdAt ? new Date(createdAt).getMonth() + 1 : 1;
}

/**
 * Whether a yearly expense is paid in the given month, based on its payment
 * strategy. Anchors match the backend (dashboard-calculator.service.ts):
 * FULL pays in paymentMonth, INSTALLMENTS anchors to the creation month —
 * not the recurring `month` field, which yearly expenses leave null.
 */
function isYearlyPaymentMonth(expense: TimelineExpense, month: number): boolean {
  if (expense.yearlyPaymentStrategy === YearlyPaymentStrategy.FULL) {
    return month === (expense.paymentMonth ?? 1);
  }
  if (expense.yearlyPaymentStrategy === YearlyPaymentStrategy.INSTALLMENTS) {
    const anchorMonth = getInstallmentAnchorMonth(expense.createdAt);
    const step = getStepMonths(expense.installmentFrequency);
    return (month - anchorMonth + 12) % step === 0;
  }
  return true;
}

/**
 * Builds a -12 to +12 month timeline for a recurring expense.
 * Yearly expenses only emit the months they are actually paid in.
 * When an overrides map is provided, a month's amount and override flag reflect it.
 */
export function buildRecurringTimeline(
  expense: TimelineExpense,
  defaultAmount: number,
  currentMonth: number,
  currentYear: number,
  overrides?: Map<string, TimelineOverride>,
): TimelineMonth[] {
  const isYearly = expense.frequency === ExpenseFrequency.YEARLY;
  const months: TimelineMonth[] = [];

  for (let offset = -12; offset <= 12; offset++) {
    const date = new Date(currentYear, currentMonth - 1 + offset);
    const month = date.getMonth() + 1;
    const year = date.getFullYear();

    if (isYearly && !isYearlyPaymentMonth(expense, month)) continue;

    const override = overrides?.get(overrideKey(year, month));
    months.push({
      month,
      year,
      label: formatMonthLabel(date),
      amount: override?.skipped ? 0 : (override?.amount ?? defaultAmount),
      isOverride: !!override,
      isPast: isPastMonth(month, year, currentMonth, currentYear),
      isCurrent: year === currentYear && month === currentMonth,
    });
  }
  return months;
}

/** Builds the fixed installment schedule for a ONE_TIME expense paid in installments. */
export function buildInstallmentTimeline(
  expense: TimelineExpense,
  currentMonth: number,
  currentYear: number,
): TimelineMonth[] {
  const startMonth = expense.month ?? currentMonth;
  const startYear = expense.year ?? currentYear;
  const count = expense.installmentCount ?? getDefaultInstallmentCount(expense.installmentFrequency);
  const stepMonths = getStepMonths(expense.installmentFrequency);
  const perInstallment = roundCurrency(Number(expense.amount) / count);
  const months: TimelineMonth[] = [];

  for (let i = 0; i < count; i++) {
    const date = new Date(startYear, startMonth - 1 + i * stepMonths);
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    months.push({
      month,
      year,
      label: formatMonthLabel(date),
      amount: perInstallment,
      isOverride: false,
      isPast: isPastMonth(month, year, currentMonth, currentYear),
      isCurrent: year === currentYear && month === currentMonth,
    });
  }
  return months;
}

/** Returns how many installments per year for the given frequency. */
export function getDefaultInstallmentCount(freq: InstallmentFrequency | null | undefined): number {
  switch (freq) {
    case InstallmentFrequency.QUARTERLY: return 4;
    case InstallmentFrequency.SEMI_ANNUAL: return 2;
    case InstallmentFrequency.MONTHLY: default: return 12;
  }
}

/** Returns the number of months between installments for the given frequency. */
export function getStepMonths(freq: InstallmentFrequency | null | undefined): number {
  switch (freq) {
    case InstallmentFrequency.QUARTERLY: return 3;
    case InstallmentFrequency.SEMI_ANNUAL: return 6;
    case InstallmentFrequency.MONTHLY: default: return 1;
  }
}
