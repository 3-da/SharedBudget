import { Injectable, inject, signal, computed } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Saving, UpsertSavingRequest } from '../../../shared/models/saving.model';
import { SavingsHistoryItem } from '../../../shared/models/dashboard.model';
import { SavingService } from '../services/saving.service';
import { DashboardService } from '../../dashboard/services/dashboard.service';

@Injectable({ providedIn: 'root' })
export class SavingStore {
  private readonly service = inject(SavingService);
  private readonly dashboardService = inject(DashboardService);
  private readonly snackBar = inject(MatSnackBar);

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

  reset(): void {
    this.mySavings.set([]);
    this.householdSavings.set([]);
    this.savingsHistory.set([]);
    this.loading.set(false);
    this.error.set(null);
  }

  loadMySavings(month?: number, year?: number): void {
    const showSpinner = this.mySavings().length === 0;
    if (showSpinner) this.loading.set(true);
    this.service.getMine(month, year).subscribe({
      next: s => { this.mySavings.set(s); this.loading.set(false); },
      error: () => { this.mySavings.set([]); this.loading.set(false); },
    });
  }

  loadHouseholdSavings(month?: number, year?: number): void {
    this.service.getHousehold(month, year).subscribe({
      next: s => this.householdSavings.set(s),
      error: () => this.householdSavings.set([]),
    });
  }

  loadSavingsHistory(): void {
    this.dashboardService.getSavingsHistory().subscribe({
      next: items => this.savingsHistory.set(items),
      error: () => this.savingsHistory.set([]),
    });
  }

  upsertPersonal(dto: UpsertSavingRequest, onSuccess?: () => void): void {
    this.service.upsertPersonal(dto).subscribe({
      next: () => { this.snackBar.open('Personal savings updated', '', { duration: 3000 }); this.loadMySavings(dto.month, dto.year); this.loadHouseholdSavings(dto.month, dto.year); this.loadSavingsHistory(); onSuccess?.(); },
      error: err => { this.snackBar.open(err.error?.message ?? 'Failed', '', { duration: 4000 }); this.error.set(err.error?.message); },
    });
  }

  upsertShared(dto: UpsertSavingRequest, onSuccess?: () => void): void {
    this.service.upsertShared(dto).subscribe({
      next: () => { this.snackBar.open('Shared savings updated', '', { duration: 3000 }); this.loadMySavings(dto.month, dto.year); this.loadHouseholdSavings(dto.month, dto.year); this.loadSavingsHistory(); onSuccess?.(); },
      error: err => { this.snackBar.open(err.error?.message ?? 'Failed', '', { duration: 4000 }); this.error.set(err.error?.message); },
    });
  }
}
