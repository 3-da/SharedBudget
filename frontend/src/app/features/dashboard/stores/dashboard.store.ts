import { Injectable, inject, signal, computed } from '@angular/core';
import { DashboardOverview } from '../../../shared/models/dashboard.model';
import { DashboardService } from '../services/dashboard.service';

@Injectable({ providedIn: 'root' })
export class DashboardStore {
  private readonly service = inject(DashboardService);

  readonly overview = signal<DashboardOverview | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly income = computed(() => this.overview()?.income ?? []);
  readonly totalCurrentIncome = computed(() => this.overview()?.totalCurrentIncome ?? 0);
  readonly expenses = computed(() => this.overview()?.expenses ?? null);
  readonly savings = computed(() => this.overview()?.savings ?? null);
  readonly settlement = computed(() => this.overview()?.settlement ?? null);
  readonly pendingApprovalsCount = computed(() => this.overview()?.pendingApprovalsCount ?? 0);

  reset(): void {
    this.overview.set(null);
    this.loading.set(false);
    this.error.set(null);
  }

  loadAll(): void {
    if (!this.overview()) this.loading.set(true);
    this.error.set(null);
    this.service.getOverview().subscribe({
      next: o => { this.overview.set(o); this.loading.set(false); },
      error: () => { this.overview.set(null); this.loading.set(false); },
    });
  }

  markPaid(): void {
    this.service.markSettlementPaid().subscribe({
      next: () => this.loadAll(),
      error: err => this.error.set(err.error?.message),
    });
  }
}
