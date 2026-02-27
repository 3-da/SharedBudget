import { Injectable, inject, signal, computed } from '@angular/core';
import { SalaryResponse } from '../../../shared/models';
import { extractHttpError } from '../../../shared/utils/extract-error';
import { SalaryService } from '../services/salary.service';
import { HouseholdStore } from '../../household/stores/household.store';
import { ToastService } from '../../../core/services/toast.service';
import { StoreResetService } from '../../../core/stores/store-reset.service';

@Injectable({ providedIn: 'root' })
export class SalaryStore {
  private readonly salaryService = inject(SalaryService);
  private readonly toast = inject(ToastService);
  private readonly householdStore = inject(HouseholdStore);

  constructor() {
    inject(StoreResetService).register(() => this.reset());
  }

  readonly mySalary = signal<SalaryResponse | null>(null);
  readonly yearlySalaries = signal<SalaryResponse[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly yearlyTotal = computed(() =>
    this.yearlySalaries().reduce((sum, s) => sum + s.currentAmount, 0),
  );

  readonly yearlyAverage = computed(() => {
    const salaries = this.yearlySalaries();
    return salaries.length > 0 ? this.yearlyTotal() / salaries.length : 0;
  });

  reset(): void {
    this.mySalary.set(null);
    this.yearlySalaries.set([]);
    this.loading.set(false);
    this.error.set(null);
  }

  loadMySalary(onFinish?: () => void): void {
    if (!this.mySalary()) this.loading.set(true);
    this.salaryService.getMine().subscribe({
      next: s => { this.mySalary.set(s); this.loading.set(false); onFinish?.(); },
      error: () => { this.mySalary.set(null); this.loading.set(false); onFinish?.(); },
    });
  }

  loadYearlySalaries(year: number, onFinish?: () => void): void {
    this.salaryService.getMyYearly(year).subscribe({
      next: s => { this.yearlySalaries.set(s); onFinish?.(); },
      error: () => { this.yearlySalaries.set([]); onFinish?.(); },
    });
  }

  upsert(dto: { defaultAmount: number; currentAmount: number }): void {
    this.salaryService.upsert(dto).subscribe({
      next: s => {
        this.mySalary.set(s);
        this.loading.set(false);
        this.toast.showSuccess('Salary saved');
        this.loadYearlySalaries(new Date().getFullYear());
        this.householdStore.loadOverview();
      },
      error: err => { this.toast.showError(extractHttpError(err, 'Failed to save salary')!); this.error.set(extractHttpError(err)); this.loading.set(false); },
    });
  }
}
