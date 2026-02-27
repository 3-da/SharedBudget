import { Injectable, inject, signal, computed } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { forkJoin } from 'rxjs';
import { Expense, CreateExpenseRequest, UpdateExpenseRequest, PaymentStatus } from '../../../shared/models';
import { extractHttpError } from '../../../shared/utils/extract-error';
import { PersonalExpenseService } from '../services/personal-expense.service';
import { ExpensePaymentService } from '../services/expense-payment.service';
import { RecurringOverrideService } from '../services/recurring-override.service';

@Injectable({ providedIn: 'root' })
export class PersonalExpenseStore {
  private readonly service = inject(PersonalExpenseService);
  private readonly paymentService = inject(ExpensePaymentService);
  private readonly overrideService = inject(RecurringOverrideService);
  private readonly snackBar = inject(MatSnackBar);

  readonly expenses = signal<Expense[]>([]);
  readonly paymentStatuses = signal<Map<string, PaymentStatus>>(new Map());
  readonly skippedExpenseIds = signal<Set<string>>(new Set());
  readonly selectedExpense = signal<Expense | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly totalMonthly = computed(() =>
    this.expenses().reduce((sum, e) => sum + e.amount, 0),
  );

  readonly paidTotal = computed(() => {
    const statuses = this.paymentStatuses();
    return this.expenses()
      .filter(e => statuses.get(e.id) === PaymentStatus.PAID)
      .reduce((sum, e) => sum + e.amount, 0);
  });

  readonly remainingBudget = computed(() => this.totalMonthly() - this.paidTotal());

  reset(): void {
    this.expenses.set([]);
    this.paymentStatuses.set(new Map());
    this.skippedExpenseIds.set(new Set());
    this.selectedExpense.set(null);
    this.loading.set(false);
    this.error.set(null);
  }

  loadExpenses(month?: number, year?: number): void {
    const showSpinner = this.expenses().length === 0;
    if (showSpinner) this.loading.set(true);
    const now = new Date();
    const m = month ?? now.getMonth() + 1;
    const y = year ?? now.getFullYear();
    forkJoin({
      expenses: this.service.list(m, y),
      statuses: this.paymentService.getBatchStatuses(m, y),
      skipped: this.service.getSkipStatuses(m, y),
    }).subscribe({
      next: ({ expenses, statuses, skipped }) => {
        this.expenses.set(expenses);
        const map = new Map<string, PaymentStatus>();
        for (const s of statuses) map.set(s.expenseId, s.status);
        this.paymentStatuses.set(map);
        this.skippedExpenseIds.set(new Set(skipped));
        this.loading.set(false);
      },
      error: () => { this.expenses.set([]); this.loading.set(false); },
    });
  }

  loadExpense(id: string): void {
    this.loading.set(true);
    this.service.get(id).subscribe({
      next: e => { this.selectedExpense.set(e); this.loading.set(false); },
      error: err => { this.error.set(extractHttpError(err) ?? null); this.loading.set(false); },
    });
  }

  createExpense(dto: CreateExpenseRequest, month?: number, year?: number, onSuccess?: () => void): void {
    this.service.create(dto).subscribe({
      next: () => { this.snackBar.open('Expense created', '', { duration: 3000 }); this.loadExpenses(month, year); onSuccess?.(); },
      error: err => { this.snackBar.open(extractHttpError(err) ?? 'Failed to create', '', { duration: 4000 }); this.error.set(extractHttpError(err) ?? null); },
    });
  }

  updateExpense(id: string, dto: UpdateExpenseRequest, month?: number, year?: number, onSuccess?: () => void): void {
    this.service.update(id, dto).subscribe({
      next: () => { this.snackBar.open('Expense updated', '', { duration: 3000 }); this.loadExpenses(month, year); onSuccess?.(); },
      error: err => { this.snackBar.open(extractHttpError(err) ?? 'Failed to update', '', { duration: 4000 }); this.error.set(extractHttpError(err) ?? null); },
    });
  }

  deleteExpense(id: string, month?: number, year?: number): void {
    this.service.delete(id).subscribe({
      next: () => { this.snackBar.open('Expense deleted', '', { duration: 3000 }); this.loadExpenses(month, year); },
      error: err => { this.snackBar.open(extractHttpError(err) ?? 'Failed to delete', '', { duration: 4000 }); this.error.set(extractHttpError(err)); },
    });
  }

  markPaid(expenseId: string, month: number, year: number): void {
    this.paymentService.markPaid(expenseId, { month, year }).subscribe({
      next: p => { this.updatePaymentMap(expenseId, p.status); this.snackBar.open('Marked as paid', '', { duration: 2000 }); },
      error: err => this.snackBar.open(err.error?.message ?? 'Failed', '', { duration: 4000 }),
    });
  }

  undoPaid(expenseId: string, month: number, year: number): void {
    this.paymentService.undoPaid(expenseId, { month, year }).subscribe({
      next: p => { this.updatePaymentMap(expenseId, p.status); this.snackBar.open('Set back to pending', '', { duration: 2000 }); },
      error: err => this.snackBar.open(err.error?.message ?? 'Failed', '', { duration: 4000 }),
    });
  }

  skipExpense(expenseId: string, month: number, year: number): void {
    const expense = this.expenses().find(e => e.id === expenseId);
    this.overrideService.upsertOverride(expenseId, year, month, { amount: expense?.amount ?? 0, skipped: true }).subscribe({
      next: () => { this.snackBar.open('Expense skipped for this month', '', { duration: 3000 }); this.skippedExpenseIds.update(s => new Set([...s, expenseId])); },
      error: err => this.snackBar.open(extractHttpError(err) ?? 'Failed to skip', '', { duration: 4000 }),
    });
  }

  unskipExpense(expenseId: string, month: number, year: number): void {
    this.overrideService.deleteOverride(expenseId, year, month).subscribe({
      next: () => { this.snackBar.open('Expense skip removed', '', { duration: 3000 }); this.skippedExpenseIds.update(s => { const next = new Set(s); next.delete(expenseId); return next; }); },
      error: err => this.snackBar.open(extractHttpError(err) ?? 'Failed to unskip', '', { duration: 4000 }),
    });
  }

  private updatePaymentMap(expenseId: string, status: PaymentStatus): void {
    this.paymentStatuses.update(m => {
      const next = new Map(m);
      next.set(expenseId, status);
      return next;
    });
  }
}
