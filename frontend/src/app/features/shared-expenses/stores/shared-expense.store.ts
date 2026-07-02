import { Injectable, inject, signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Expense, CreateExpenseRequest, UpdateExpenseRequest, SkipExpenseRequest } from '../../../shared/models';
import { ExpensePayment } from '../../../shared/models/expense-payment.model';
import { extractHttpError } from '../../../shared/utils/extract-error';
import { loadMonthlyExpenses } from '../../../shared/utils/load-monthly-expenses';
import { SharedExpenseService } from '../services/shared-expense.service';
import { ExpensePaymentService } from '../../../shared/services/expense-payment.service';

@Injectable({ providedIn: 'root' })
export class SharedExpenseStore {
  private readonly service = inject(SharedExpenseService);
  private readonly paymentService = inject(ExpensePaymentService);
  private readonly snackBar = inject(MatSnackBar);

  readonly expenses = signal<Expense[]>([]);
  readonly paymentStatuses = signal<Map<string, ExpensePayment>>(new Map());
  readonly skippedExpenseIds = signal<Set<string>>(new Set());
  readonly selectedExpense = signal<Expense | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  // Remembers the last month/year loadExpenses was called with, so reload()
  // can refresh in place without resetting the user's selected month back to "now".
  private lastRequestedMonth?: number;
  private lastRequestedYear?: number;

  reset(): void {
    this.expenses.set([]);
    this.paymentStatuses.set(new Map());
    this.skippedExpenseIds.set(new Set());
    this.selectedExpense.set(null);
    this.loading.set(false);
    this.error.set(null);
  }

  loadExpenses(month?: number, year?: number): void {
    this.lastRequestedMonth = month;
    this.lastRequestedYear = year;
    loadMonthlyExpenses(
      {
        list: (m, y) => this.service.list(m, y),
        getBatchStatuses: (m, y) => this.paymentService.getBatchStatuses(m, y),
        getSkipStatuses: (m, y) => this.service.getSkipStatuses(m, y),
      },
      { expenses: this.expenses, paymentStatuses: this.paymentStatuses, skippedExpenseIds: this.skippedExpenseIds, loading: this.loading, error: this.error },
      month,
      year,
    );
  }

  /**
   * Re-fetches the currently displayed month in place. Safe to call from
   * outside the list page (e.g. after an approval is accepted elsewhere) —
   * unlike calling loadExpenses() with no arguments, this won't reset the
   * view to the current month if the user has navigated to a different one.
   */
  reload(): void {
    this.loadExpenses(this.lastRequestedMonth, this.lastRequestedYear);
  }

  loadExpense(id: string): void {
    this.loading.set(true);
    this.service.get(id).subscribe({
      next: e => { this.selectedExpense.set(e); this.loading.set(false); },
      error: err => { this.error.set(extractHttpError(err) ?? null); this.loading.set(false); },
    });
  }

  proposeCreate(dto: CreateExpenseRequest, month?: number, year?: number, onSuccess?: () => void): void {
    this.service.proposeCreate(dto).subscribe({
      next: () => {
        this.snackBar.open('Proposal submitted for approval', '', { duration: 3000 });
        this.loadExpenses(month, year);
        onSuccess?.();
      },
      error: err => { this.error.set(extractHttpError(err) ?? null); },
    });
  }

  proposeUpdate(id: string, dto: UpdateExpenseRequest, month?: number, year?: number, onSuccess?: () => void): void {
    this.service.proposeUpdate(id, dto).subscribe({
      next: () => {
        this.snackBar.open('Update proposal submitted', '', { duration: 3000 });
        this.loadExpenses(month, year);
        onSuccess?.();
      },
      error: err => { this.error.set(extractHttpError(err) ?? null); },
    });
  }

  proposeSkip(id: string, dto: SkipExpenseRequest): void {
    this.service.proposeSkip(id, dto).subscribe({
      next: () => this.snackBar.open('Skip request submitted for approval', '', { duration: 3000 }),
      error: err => this.snackBar.open(extractHttpError(err) ?? 'Failed to submit skip request', '', { duration: 4000 }),
    });
  }

  proposeUnskip(id: string, dto: SkipExpenseRequest): void {
    this.service.proposeUnskip(id, dto).subscribe({
      next: () => this.snackBar.open('Unskip request submitted for approval', '', { duration: 3000 }),
      error: err => this.snackBar.open(extractHttpError(err) ?? 'Failed to submit unskip request', '', { duration: 4000 }),
    });
  }

  proposeDelete(id: string, month?: number, year?: number): void {
    this.service.proposeDelete(id).subscribe({
      next: () => {
        this.snackBar.open('Delete proposal submitted', '', { duration: 3000 });
        this.loadExpenses(month, year);
      },
      error: err => { this.error.set(extractHttpError(err) ?? null); },
    });
  }

  markPaid(expenseId: string, month: number, year: number, paidAmount?: number): void {
    this.paymentService.markPaid(expenseId, { month, year, paidAmount }).subscribe({
      next: p => { this.updatePaymentMap(expenseId, p); this.snackBar.open('Marked as paid', '', { duration: 2000 }); },
      error: err => this.snackBar.open(extractHttpError(err) ?? 'Failed', '', { duration: 4000 }),
    });
  }

  undoPaid(expenseId: string, month: number, year: number): void {
    this.paymentService.undoPaid(expenseId, { month, year }).subscribe({
      next: p => { this.updatePaymentMap(expenseId, p); this.snackBar.open('Set back to pending', '', { duration: 2000 }); },
      error: err => this.snackBar.open(extractHttpError(err) ?? 'Failed', '', { duration: 4000 }),
    });
  }

  private updatePaymentMap(expenseId: string, payment: ExpensePayment): void {
    this.paymentStatuses.update(m => {
      const next = new Map(m);
      next.set(expenseId, payment);
      return next;
    });
  }
}
