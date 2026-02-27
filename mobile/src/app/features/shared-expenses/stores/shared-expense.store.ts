import { Injectable, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { Expense, CreateExpenseRequest, UpdateExpenseRequest, PaymentStatus } from '../../../shared/models';
import { extractHttpError } from '../../../shared/utils/extract-error';
import { SharedExpenseService } from '../services/shared-expense.service';
import { ExpensePaymentService } from '../../personal-expenses/services/expense-payment.service';
import { ToastService } from '../../../core/services/toast.service';
import { StoreResetService } from '../../../core/stores/store-reset.service';

@Injectable({ providedIn: 'root' })
export class SharedExpenseStore {
  private readonly service = inject(SharedExpenseService);
  private readonly paymentService = inject(ExpensePaymentService);
  private readonly toast = inject(ToastService);

  constructor() {
    inject(StoreResetService).register(() => this.reset());
  }

  readonly expenses = signal<Expense[]>([]);
  readonly paymentStatuses = signal<Map<string, PaymentStatus>>(new Map());
  readonly selectedExpense = signal<Expense | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  reset(): void {
    this.expenses.set([]);
    this.paymentStatuses.set(new Map());
    this.selectedExpense.set(null);
    this.loading.set(false);
    this.error.set(null);
  }

  loadExpenses(month?: number, year?: number, onFinish?: () => void): void {
    const showSpinner = this.expenses().length === 0;
    if (showSpinner) this.loading.set(true);
    const now = new Date();
    const m = month ?? now.getMonth() + 1;
    const y = year ?? now.getFullYear();
    forkJoin({
      expenses: this.service.list(m, y),
      statuses: this.paymentService.getBatchStatuses(m, y),
    }).subscribe({
      next: ({ expenses, statuses }) => {
        this.expenses.set(expenses);
        const map = new Map<string, PaymentStatus>();
        for (const s of statuses) map.set(s.expenseId, s.status);
        this.paymentStatuses.set(map);
        this.loading.set(false);
        onFinish?.();
      },
      error: err => {
        this.error.set(extractHttpError(err) ?? 'Failed to load expenses');
        this.expenses.set([]);
        this.loading.set(false);
        onFinish?.();
      },
    });
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
        this.toast.showSuccess('Proposal submitted for approval');
        this.loadExpenses(month, year);
        onSuccess?.();
      },
      error: err => { this.error.set(extractHttpError(err) ?? null); },
    });
  }

  proposeUpdate(id: string, dto: UpdateExpenseRequest, month?: number, year?: number, onSuccess?: () => void): void {
    this.service.proposeUpdate(id, dto).subscribe({
      next: () => {
        this.toast.showSuccess('Update proposal submitted');
        this.loadExpenses(month, year);
        onSuccess?.();
      },
      error: err => { this.error.set(extractHttpError(err) ?? null); },
    });
  }

  proposeDelete(id: string, month?: number, year?: number): void {
    this.service.proposeDelete(id).subscribe({
      next: () => {
        this.toast.showSuccess('Delete proposal submitted');
        this.loadExpenses(month, year);
      },
      error: err => { this.error.set(extractHttpError(err) ?? null); },
    });
  }

  markPaid(expenseId: string, month: number, year: number): void {
    this.paymentService.markPaid(expenseId, { month, year }).subscribe({
      next: p => { this.updatePaymentMap(expenseId, p.status); this.toast.showSuccess('Marked as paid'); },
      error: err => this.toast.showError(extractHttpError(err) ?? 'Failed'),
    });
  }

  undoPaid(expenseId: string, month: number, year: number): void {
    this.paymentService.undoPaid(expenseId, { month, year }).subscribe({
      next: p => { this.updatePaymentMap(expenseId, p.status); this.toast.showInfo('Set back to pending'); },
      error: err => this.toast.showError(extractHttpError(err) ?? 'Failed'),
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
