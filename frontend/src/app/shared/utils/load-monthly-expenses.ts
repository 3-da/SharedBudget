import { WritableSignal } from '@angular/core';
import { Observable, forkJoin } from 'rxjs';
import { Expense } from '../models';
import { ExpensePayment } from '../models/expense-payment.model';
import { extractHttpError } from './extract-error';

export interface MonthlyExpenseSources {
  list: (month: number, year: number) => Observable<Expense[]>;
  getBatchStatuses: (month: number, year: number) => Observable<ExpensePayment[]>;
  getSkipStatuses: (month: number, year: number) => Observable<string[]>;
}

export interface MonthlyExpenseSignals {
  expenses: WritableSignal<Expense[]>;
  paymentStatuses: WritableSignal<Map<string, ExpensePayment>>;
  skippedExpenseIds: WritableSignal<Set<string>>;
  loading: WritableSignal<boolean>;
  error: WritableSignal<string | null>;
}

/**
 * Loads a month's expenses, payment statuses, and skip statuses in parallel
 * and writes the results into the given signals. Shared by PersonalExpenseStore
 * and SharedExpenseStore, whose loadExpenses only differ in which service
 * backs `list`/`getSkipStatuses` — the fetch shape, loading/error handling,
 * and payment-status map building are otherwise identical.
 */
export function loadMonthlyExpenses(sources: MonthlyExpenseSources, signals: MonthlyExpenseSignals, month?: number, year?: number): void {
  // Always show the spinner — the user should never interact with cards from the previous month while a new month loads
  signals.loading.set(true);
  signals.error.set(null);
  const now = new Date();
  const m = month ?? now.getMonth() + 1;
  const y = year ?? now.getFullYear();

  forkJoin({
    expenses: sources.list(m, y),
    statuses: sources.getBatchStatuses(m, y),
    skipped: sources.getSkipStatuses(m, y),
  }).subscribe({
    next: ({ expenses, statuses, skipped }) => {
      signals.expenses.set(expenses);
      const map = new Map<string, ExpensePayment>();
      for (const s of statuses) map.set(s.expenseId, s);
      signals.paymentStatuses.set(map);
      signals.skippedExpenseIds.set(new Set(skipped));
      signals.loading.set(false);
    },
    error: err => {
      signals.error.set(extractHttpError(err) ?? 'Failed to load expenses');
      signals.expenses.set([]);
      signals.loading.set(false);
    },
  });
}
