import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { Approval } from '../../../shared/models/approval.model';
import { ApprovalService } from '../services/approval.service';
import { SharedExpenseStore } from '../../shared-expenses/stores/shared-expense.store';
import { DashboardStore } from '../../dashboard/stores/dashboard.store';
import { NotificationStore } from '../../../core/stores/notification.store';

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
    effect(() => {
      this.notificationStore.setPendingApprovalsCount(this.pendingCount());
    });
  }

  loadPending(): void {
    this.loading.set(true);
    this.service.getPending().subscribe({
      next: a => { this.pending.set(a); this.loading.set(false); },
      error: () => { this.pending.set([]); this.loading.set(false); },
    });
  }

  loadHistory(): void {
    this.service.getHistory().subscribe({
      next: a => this.history.set(a),
      error: () => this.history.set([]),
    });
  }

  accept(id: string, message?: string): void {
    this.loading.set(true);
    // Optimistically remove from pending list immediately
    this.pending.update(list => list.filter(a => a.id !== id));
    this.service.accept(id, message ? { message } : undefined).subscribe({
      next: () => {
        this.loading.set(false);
        this.loadPending();
        this.loadHistory();
        this.invalidateRelatedStores();
      },
      error: err => {
        this.error.set(err.error?.message);
        this.loading.set(false);
        this.loadPending(); // Reload to restore if optimistic update was wrong
      },
    });
  }

  reject(id: string, message: string): void {
    this.loading.set(true);
    this.service.reject(id, { message }).subscribe({
      next: () => {
        this.loading.set(false);
        this.loadPending();
        this.loadHistory();
        this.invalidateRelatedStores();
      },
      error: err => { this.error.set(err.error?.message); this.loading.set(false); },
    });
  }

  cancel(id: string): void {
    this.loading.set(true);
    this.pending.update(list => list.filter(a => a.id !== id));
    this.service.cancel(id).subscribe({
      next: () => {
        this.loading.set(false);
        this.loadPending();
        this.loadHistory();
        this.invalidateRelatedStores();
      },
      error: err => {
        this.error.set(err.error?.message);
        this.loading.set(false);
        this.loadPending();
      },
    });
  }

  private invalidateRelatedStores(): void {
    this.sharedExpenseStore.loadExpenses();
    this.dashboardStore.loadAll();
  }
}
