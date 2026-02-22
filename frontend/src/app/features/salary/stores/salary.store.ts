import { Injectable, inject, signal, computed } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SalaryResponse } from '../../../shared/models';
import { extractHttpError } from '../../../shared/utils/extract-error';
import { SalaryService } from '../services/salary.service';
import { HouseholdStore } from '../../household/stores/household.store';

@Injectable({ providedIn: 'root' })
export class SalaryStore {
  private readonly salaryService = inject(SalaryService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly householdStore = inject(HouseholdStore);

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

  loadMySalary(): void {
    if (!this.mySalary()) this.loading.set(true);
    this.salaryService.getMine().subscribe({
      next: s => { this.mySalary.set(s); this.loading.set(false); },
      error: () => { this.mySalary.set(null); this.loading.set(false); },
    });
  }

  loadYearlySalaries(year: number): void {
    this.salaryService.getMyYearly(year).subscribe({
      next: s => this.yearlySalaries.set(s),
      error: () => this.yearlySalaries.set([]),
    });
  }

  upsert(dto: { defaultAmount: number; currentAmount: number }): void {
    this.salaryService.upsert(dto).subscribe({
      next: s => {
        this.mySalary.set(s);
        this.loading.set(false);
        this.snackBar.open('Salary saved', '', { duration: 3000 });
        this.loadYearlySalaries(new Date().getFullYear());
        this.householdStore.loadOverview();
      },
      error: err => { this.snackBar.open(extractHttpError(err, 'Failed to save salary')!, '', { duration: 4000 }); this.error.set(extractHttpError(err)); this.loading.set(false); },
    });
  }
}
