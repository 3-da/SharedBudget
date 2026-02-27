import { Injectable, inject, signal, computed } from '@angular/core';
import { Saving, AddSavingRequest, WithdrawSavingRequest } from '../../../shared/models/saving.model';
import { SavingsHistoryItem } from '../../../shared/models';
import { extractHttpError } from '../../../shared/utils/extract-error';
import { SavingService } from '../services/saving.service';
import { DashboardService } from '../../dashboard/services/dashboard.service';
import { ToastService } from '../../../core/services/toast.service';
import { StoreResetService } from '../../../core/stores/store-reset.service';

@Injectable({ providedIn: 'root' })
export class SavingStore {
  private readonly service = inject(SavingService);
  private readonly dashboardService = inject(DashboardService);
  private readonly toast = inject(ToastService);

  constructor() {
    inject(StoreResetService).register(() => this.reset());
  }

  readonly mySavings = signal<Saving[]>([]);
  readonly householdSavings = signal<Saving[]>([]);
  readonly savingsHistory = signal<SavingsHistoryItem[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly personalSaving = computed(() => this.mySavings().find(s => !s.isShared) ?? null);
  readonly sharedSaving = computed(() => this.mySavings().find(s => s.isShared) ?? null);
  readonly totalPersonal = computed(() => this.personalSaving()?.amount ?? 0);
  readonly totalShared = computed(() => this.sharedSaving()?.amount ?? 0);
  readonly totalHousehold = computed(() => this.householdSavings().reduce((sum, s) => sum + s.amount, 0));
  readonly totalHouseholdShared = computed(() =>
    this.householdSavings().filter(s => s.isShared).reduce((sum, s) => sum + s.amount, 0),
  );

  reset(): void {
    this.mySavings.set([]);
    this.householdSavings.set([]);
    this.savingsHistory.set([]);
    this.loading.set(false);
    this.error.set(null);
  }

  loadMySavings(month?: number, year?: number, onFinish?: () => void): void {
    const showSpinner = this.mySavings().length === 0;
    if (showSpinner) this.loading.set(true);
    this.service.getMine(month, year).subscribe({
      next: s => { this.mySavings.set(s); this.loading.set(false); onFinish?.(); },
      error: () => { this.mySavings.set([]); this.loading.set(false); onFinish?.(); },
    });
  }

  loadHouseholdSavings(month?: number, year?: number, onFinish?: () => void): void {
    this.service.getHousehold(month, year).subscribe({
      next: s => { this.householdSavings.set(s); onFinish?.(); },
      error: () => { this.householdSavings.set([]); onFinish?.(); },
    });
  }

  loadSavingsHistory(): void {
    this.dashboardService.getSavingsHistory().subscribe({
      next: items => this.savingsHistory.set(items),
      error: () => this.savingsHistory.set([]),
    });
  }

  addPersonal(dto: AddSavingRequest, onSuccess?: () => void): void {
    this.service.addPersonal(dto).subscribe({
      next: () => { this.toast.showSuccess('Savings added'); this.loadMySavings(dto.month, dto.year); this.loadHouseholdSavings(dto.month, dto.year); this.loadSavingsHistory(); onSuccess?.(); },
      error: err => { this.toast.showError(extractHttpError(err, 'Failed')!); this.error.set(extractHttpError(err)); },
    });
  }

  withdrawPersonal(dto: WithdrawSavingRequest, onSuccess?: () => void): void {
    this.service.withdrawPersonal(dto).subscribe({
      next: () => { this.toast.showSuccess('Savings withdrawn'); this.loadMySavings(dto.month, dto.year); this.loadHouseholdSavings(dto.month, dto.year); this.loadSavingsHistory(); onSuccess?.(); },
      error: err => { this.toast.showError(extractHttpError(err, 'Failed')!); this.error.set(extractHttpError(err)); },
    });
  }

  addShared(dto: AddSavingRequest, onSuccess?: () => void): void {
    this.service.addShared(dto).subscribe({
      next: () => { this.toast.showSuccess('Shared savings added'); this.loadMySavings(dto.month, dto.year); this.loadHouseholdSavings(dto.month, dto.year); this.loadSavingsHistory(); onSuccess?.(); },
      error: err => { this.toast.showError(extractHttpError(err, 'Failed')!); this.error.set(extractHttpError(err)); },
    });
  }

  withdrawShared(dto: WithdrawSavingRequest, onSuccess?: () => void): void {
    this.service.withdrawShared(dto).subscribe({
      next: () => { this.toast.showSuccess('Withdrawal request submitted for approval'); this.loadMySavings(dto.month, dto.year); this.loadHouseholdSavings(dto.month, dto.year); onSuccess?.(); },
      error: err => { this.toast.showError(extractHttpError(err, 'Failed')!); this.error.set(extractHttpError(err)); },
    });
  }
}
