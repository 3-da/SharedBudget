import {ChangeDetectionStrategy, Component, inject, OnInit, signal} from '@angular/core';
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
  imports: [MatCardModule, MatButtonModule, MatIconModule, SalaryFormComponent, SalaryChartComponent, LoadingSpinnerComponent, PageHeaderComponent, CurrencyEurPipe],
  template: `
    <app-page-header title="Income" subtitle="Keep your household plan grounded in real earnings" />

    @if (store.loading()) {
      <app-loading-spinner />
    } @else {
      <div class="salary-layout">
        <mat-card>
          <mat-card-header><mat-card-title>Monthly salary</mat-card-title><mat-card-subtitle>Set your default and current income</mat-card-subtitle></mat-card-header>
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
            <div class="salary-chart-frame">
              <app-salary-chart [salaries]="store.yearlySalaries()" />
            </div>
          </mat-card-content>
        </mat-card>
      </div>
    }
  `,
  styles: [`
    .salary-layout { display: grid; grid-template-columns: minmax(280px, 0.8fr) minmax(0, 1.7fr); gap: 14px; max-width: 1120px; align-items: stretch; }
    .salary-layout > mat-card { min-width: 0; }
    .salary-layout mat-card-header { margin-bottom: 4px; }
    .year-nav { display: flex; align-items: center; gap: var(--space-sm); }
    .stats-row { display: flex; gap: 10px; margin-bottom: 14px; }
    .stat { display: flex; min-width: 130px; flex-direction: column; gap: 4px; padding: 12px 14px; border-radius: 11px; background: var(--color-panel-subtle); }
    .stat strong { color: var(--color-ink); font-size: 1rem; }
    .stat-label { color: var(--color-ink-muted); font-size: 0.7rem; }
    .salary-chart-frame { height: 360px; min-height: 0; }
    .salary-chart-frame app-salary-chart { display: block; height: 100%; }
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
