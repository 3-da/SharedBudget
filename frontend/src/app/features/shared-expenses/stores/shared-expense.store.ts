import { Injectable, inject, signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { forkJoin } from 'rxjs';
import { Expense, CreateExpenseRequest, UpdateExpenseRequest, SkipExpenseRequest, PaymentStatus } from '../../../shared/models';
import { extractHttpError } from '../../../shared/utils/extract-error';
import { SharedExpenseService } from '../services/shared-expense.service';
import { ExpensePaymentService } from '../../personal-expenses/services/expense-payment.service';

@Injectable({ providedIn: 'root' })
export class SharedExpenseStore {
  private readonly service = inject(SharedExpenseService);
  private readonly paymentService = inject(ExpensePaymentService);
  private readonly snackBar = inject(MatSnackBar);

  readonly expenses = signal<Expense[]>([]);
  readonly paymentStatuses = signal<Map<string, PaymentStatus>>(new Map());
  readonly skippedExpenseIds = signal<Set<string>>(new Set());
  readonly selectedExpense = signal<Expense | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

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
      error: err => {
        this.error.set(extractHttpError(err) ?? 'Failed to load expenses');
        this.expenses.set([]);
        this.loading.set(false);
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

  markPaid(expenseId: string, month: number, year: number): void {
    this.paymentService.markPaid(expenseId, { month, year }).subscribe({
      next: p => { this.updatePaymentMap(expenseId, p.status); this.snackBar.open('Marked as paid', '', { duration: 2000 }); },
      error: err => this.snackBar.open(extractHttpError(err) ?? 'Failed', '', { duration: 4000 }),
    });
  }

  undoPaid(expenseId: string, month: number, year: number): void {
    this.paymentService.undoPaid(expenseId, { month, year }).subscribe({
      next: p => { this.updatePaymentMap(expenseId, p.status); this.snackBar.open('Set back to pending', '', { duration: 2000 }); },
      error: err => this.snackBar.open(extractHttpError(err) ?? 'Failed', '', { duration: 4000 }),
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
