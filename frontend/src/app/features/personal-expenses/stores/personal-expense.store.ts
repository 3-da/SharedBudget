import { Injectable, inject, signal, computed } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Expense, CreateExpenseRequest, UpdateExpenseRequest } from '../../../shared/models/expense.model';
import { ExpensePayment } from '../../../shared/models/expense-payment.model';
import { PaymentStatus } from '../../../shared/models/enums';
import { PersonalExpenseService } from '../services/personal-expense.service';
import { ExpensePaymentService } from '../services/expense-payment.service';

@Injectable({ providedIn: 'root' })
export class PersonalExpenseStore {
  private readonly service = inject(PersonalExpenseService);
  private readonly paymentService = inject(ExpensePaymentService);
  private readonly snackBar = inject(MatSnackBar);

  readonly expenses = signal<Expense[]>([]);
  readonly paymentStatuses = signal<Map<string, PaymentStatus>>(new Map());
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
    this.service.list(m, y).subscribe({
      next: e => {
        this.expenses.set(e);
        this.loading.set(false);
        this.loadBatchPaymentStatuses(m, y);
      },
      error: () => { this.expenses.set([]); this.loading.set(false); },
    });
  }

  loadExpense(id: string): void {
    this.loading.set(true);
    this.service.get(id).subscribe({
      next: e => { this.selectedExpense.set(e); this.loading.set(false); },
      error: err => { this.error.set(this.extractError(err) ?? null); this.loading.set(false); },
    });
  }

  createExpense(dto: CreateExpenseRequest, month?: number, year?: number, onSuccess?: () => void): void {
    this.service.create(dto).subscribe({
      next: () => { this.snackBar.open('Expense created', '', { duration: 3000 }); this.loadExpenses(month, year); onSuccess?.(); },
      error: err => { this.snackBar.open(this.extractError(err) ?? 'Failed to create', '', { duration: 4000 }); this.error.set(this.extractError(err) ?? null); },
    });
  }

  updateExpense(id: string, dto: UpdateExpenseRequest, month?: number, year?: number, onSuccess?: () => void): void {
    this.service.update(id, dto).subscribe({
      next: () => { this.snackBar.open('Expense updated', '', { duration: 3000 }); this.loadExpenses(month, year); onSuccess?.(); },
      error: err => { this.snackBar.open(this.extractError(err) ?? 'Failed to update', '', { duration: 4000 }); this.error.set(this.extractError(err) ?? null); },
    });
  }

  deleteExpense(id: string, month?: number, year?: number): void {
    this.service.delete(id).subscribe({
      next: () => { this.snackBar.open('Expense deleted', '', { duration: 3000 }); this.loadExpenses(month, year); },
      error: err => { this.snackBar.open(this.extractError(err) ?? 'Failed to delete', '', { duration: 4000 }); this.error.set(this.extractError(err)); },
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

  private loadBatchPaymentStatuses(month: number, year: number): void {
    this.paymentService.getBatchStatuses(month, year).subscribe({
      next: statuses => {
        const map = new Map<string, PaymentStatus>();
        for (const s of statuses) {
          map.set(s.expenseId, s.status);
        }
        this.paymentStatuses.set(map);
      },
      error: () => {},
    });
  }

  private extractError(err: any): string | null {
    const msg = err?.error?.message;
    if (!msg) return null;
    return Array.isArray(msg) ? msg.join(', ') : msg;
  }

  private updatePaymentMap(expenseId: string, status: PaymentStatus): void {
    this.paymentStatuses.update(m => {
      const next = new Map(m);
      next.set(expenseId, status);
      return next;
    });
  }
}
