import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { Approval } from '../../../shared/models';
import { ApprovalService } from '../services/approval.service';
import { extractHttpError } from '../../../shared/utils/extract-error';
import { SharedExpenseStore } from '../../shared-expenses/stores/shared-expense.store';
import { DashboardStore } from '../../dashboard/stores/dashboard.store';
import { NotificationStore } from '../../../core/stores/notification.store';
import { StoreResetService } from '../../../core/stores/store-reset.service';

@Injectable({ providedIn: 'root' })
export class ApprovalStore {
  readonly pending = signal<Approval[]>([]);
  readonly history = signal<Approval[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly pendingCount = computed(() => this.pending().length);
  readonly pendingExpenseIds = computed(() =>
    new Set(this.pending().filter(a => a.expenseId).map(a => a.expenseId!))
  );
  private readonly service = inject(ApprovalService);
  private readonly sharedExpenseStore = inject(SharedExpenseStore);
  private readonly dashboardStore = inject(DashboardStore);
  private readonly notificationStore = inject(NotificationStore);

  constructor() {
    inject(StoreResetService).register(() => this.reset());
    effect(() => {
      this.notificationStore.setPendingApprovalsCount(this.pendingCount());
    });
  }

  loadPending(onFinish?: () => void): void {
    const showSpinner = this.pending().length === 0 && this.history().length === 0;
    if (showSpinner) this.loading.set(true);
    this.service.getPending().subscribe({
      next: a => { this.pending.set(a); this.loading.set(false); onFinish?.(); },
      error: () => { this.pending.set([]); this.loading.set(false); onFinish?.(); },
    });
  }

  loadHistory(onFinish?: () => void): void {
    this.service.getHistory().subscribe({
      next: a => { this.history.set(a); onFinish?.(); },
      error: () => { this.history.set([]); onFinish?.(); },
    });
  }

  accept(id: string, message?: string): void {
    this.error.set(null);
    // Optimistically remove from pending list immediately
    this.pending.update(list => list.filter(a => a.id !== id));
    this.service.accept(id, message ? { message } : undefined).subscribe({
      next: () => {
        this.loadPending();
        this.loadHistory();
        this.invalidateRelatedStores();
      },
      error: err => {
        this.error.set(extractHttpError(err));
        this.loadPending(); // Reload to restore if optimistic update was wrong
      },
    });
  }

  reject(id: string, message: string): void {
    this.error.set(null);
    this.pending.update(list => list.filter(a => a.id !== id));
    this.service.reject(id, { message }).subscribe({
      next: () => {
        this.loadPending();
        this.loadHistory();
        this.invalidateRelatedStores();
      },
      error: err => { this.error.set(extractHttpError(err)); this.loadPending(); },
    });
  }

  cancel(id: string): void {
    this.error.set(null);
    this.pending.update(list => list.filter(a => a.id !== id));
    this.service.cancel(id).subscribe({
      next: () => {
        this.loadPending();
        this.loadHistory();
        this.invalidateRelatedStores();
      },
      error: err => {
        this.error.set(extractHttpError(err));
        this.loadPending();
      },
    });
  }

  reset(): void {
    this.pending.set([]);
    this.history.set([]);
    this.loading.set(false);
    this.error.set(null);
  }

  private invalidateRelatedStores(): void {
    this.sharedExpenseStore.loadExpenses();
    this.dashboardStore.loadAll();
  }
}
