import { signal } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { loadMonthlyExpenses, MonthlyExpenseSignals, MonthlyExpenseSources } from './load-monthly-expenses';

describe('loadMonthlyExpenses', () => {
  function createSignals(): MonthlyExpenseSignals {
    return {
      expenses: signal([]),
      paymentStatuses: signal(new Map()),
      skippedExpenseIds: signal(new Set()),
      loading: signal(false),
      error: signal(null),
    };
  }

  const mockExpense = { id: 'e-1' } as any;
  const mockPayment = { expenseId: 'e-1', status: 'PAID' } as any;

  it('populates expenses, payment statuses, and skip statuses on success', () => {
    const sources: MonthlyExpenseSources = {
      list: () => of([mockExpense]),
      getBatchStatuses: () => of([mockPayment]),
      getSkipStatuses: () => of(['e-2']),
    };
    const signals = createSignals();

    loadMonthlyExpenses(sources, signals, 6, 2026);

    expect(signals.expenses()).toEqual([mockExpense]);
    expect(signals.paymentStatuses().get('e-1')).toEqual(mockPayment);
    expect(signals.skippedExpenseIds()).toEqual(new Set(['e-2']));
    expect(signals.loading()).toBe(false);
    expect(signals.error()).toBeNull();
  });

  it('defaults to the current month/year when none are provided', () => {
    const now = new Date();
    let calledWith: [number, number] | null = null;
    const sources: MonthlyExpenseSources = {
      list: (m, y) => { calledWith = [m, y]; return of([]); },
      getBatchStatuses: () => of([]),
      getSkipStatuses: () => of([]),
    };

    loadMonthlyExpenses(sources, createSignals());

    expect(calledWith).toEqual([now.getMonth() + 1, now.getFullYear()]);
  });

  it('shows the spinner immediately, even before the previous month\'s data was replaced', () => {
    const sources: MonthlyExpenseSources = {
      list: () => new Observable(() => {}), // never completes
      getBatchStatuses: () => of([]),
      getSkipStatuses: () => of([]),
    };
    const signals = createSignals();

    loadMonthlyExpenses(sources, signals, 6, 2026);

    expect(signals.loading()).toBe(true);
  });

  it('clears expenses and sets the error message on failure', () => {
    const sources: MonthlyExpenseSources = {
      list: () => throwError(() => ({ error: { message: 'Server down' } })),
      getBatchStatuses: () => of([]),
      getSkipStatuses: () => of([]),
    };
    const signals = createSignals();
    signals.expenses.set([mockExpense]);

    loadMonthlyExpenses(sources, signals, 6, 2026);

    expect(signals.expenses()).toEqual([]);
    expect(signals.error()).toBe('Server down');
    expect(signals.loading()).toBe(false);
  });

  it('falls back to a default error message when the error has no detail', () => {
    const sources: MonthlyExpenseSources = {
      list: () => throwError(() => new Error()),
      getBatchStatuses: () => of([]),
      getSkipStatuses: () => of([]),
    };
    const signals = createSignals();

    loadMonthlyExpenses(sources, signals, 6, 2026);

    expect(signals.error()).toBe('Failed to load expenses');
  });
});
