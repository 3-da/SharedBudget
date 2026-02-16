import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import {MatCardModule} from '@angular/material/card';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {SalaryStore} from '../stores/salary.store';
import {SalaryFormComponent} from '../components/salary-form.component';
import {SalaryChartComponent} from '../components/salary-chart.component';
import {LoadingSpinnerComponent} from '../../../shared/components/loading-spinner.component';
import {PageHeaderComponent} from '../../../shared/components/page-header.component';
import {CurrencyEurPipe} from '../../../shared/pipes/currency-eur.pipe';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-salary-overview',
  standalone: true,
  imports: [MatCardModule, MatButtonModule, MatIconModule, SalaryFormComponent, SalaryChartComponent, LoadingSpinnerComponent, PageHeaderComponent, CurrencyEurPipe],
  template: `
    <app-page-header title="Salary" subtitle="Manage your monthly income" />

    @if (store.loading()) {
      <app-loading-spinner />
    } @else {
      <div class="salary-layout">
        <mat-card>
          <mat-card-header><mat-card-title>My Salary</mat-card-title></mat-card-header>
          <mat-card-content>
            <app-salary-form
              [salary]="store.mySalary()"
              [loading]="store.loading()"
              (save)="onSave($event)" />
          </mat-card-content>
        </mat-card>

        <mat-card>
          <mat-card-header>
            <mat-card-title>
              <div class="year-nav">
                <button mat-icon-button (click)="prevYear()" aria-label="Previous year"><mat-icon aria-hidden="true">chevron_left</mat-icon></button>
                <span>{{ currentYear() }}</span>
                <button mat-icon-button (click)="nextYear()" aria-label="Next year"><mat-icon aria-hidden="true">chevron_right</mat-icon></button>
              </div>
            </mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="stats-row">
              <div class="stat"><span class="stat-label">Yearly Total</span><strong>{{ store.yearlyTotal() | currencyEur }}</strong></div>
              <div class="stat"><span class="stat-label">Monthly Avg</span><strong>{{ store.yearlyAverage() | currencyEur }}</strong></div>
            </div>
            <app-salary-chart [salaries]="store.yearlySalaries()" />
          </mat-card-content>
        </mat-card>
      </div>
    }
  `,
  styles: [`
    .salary-layout { display: grid; grid-template-columns: 1fr 2fr; gap: var(--space-md); max-width: 1100px; margin: 0 auto; align-items: start; }
    .year-nav { display: flex; align-items: center; gap: var(--space-sm); }
    .stats-row { display: flex; gap: var(--space-lg); margin-bottom: var(--space-sm); }
    .stat { display: flex; flex-direction: column; }
    .stat-label { font-size: 0.85rem; color: var(--mat-sys-on-surface-variant); }
    @media (max-width: 768px) { .salary-layout { grid-template-columns: 1fr; } }
  `],
})
export class SalaryOverviewComponent implements OnInit {
  readonly store = inject(SalaryStore);
  readonly currentYear = signal(new Date().getFullYear());

  ngOnInit(): void {
    this.store.loadMySalary();
    this.store.loadYearlySalaries(this.currentYear());
  }

  prevYear(): void {
    this.currentYear.update(y => y - 1);
    this.store.loadYearlySalaries(this.currentYear());
  }

  nextYear(): void {
    this.currentYear.update(y => y + 1);
    this.store.loadYearlySalaries(this.currentYear());
  }

  onSave(dto: { defaultAmount: number; currentAmount: number }): void {
    this.store.upsert(dto);
  }
}
