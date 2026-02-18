import { Injectable, inject, signal, computed } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SalaryResponse } from '../../../shared/models/salary.model';
import { SalaryService } from '../services/salary.service';

@Injectable({ providedIn: 'root' })
export class SalaryStore {
  private readonly salaryService = inject(SalaryService);
  private readonly snackBar = inject(MatSnackBar);

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
      },
      error: err => { this.snackBar.open(err.error?.message ?? 'Failed to save salary', '', { duration: 4000 }); this.error.set(err.error?.message); this.loading.set(false); },
    });
  }
}
