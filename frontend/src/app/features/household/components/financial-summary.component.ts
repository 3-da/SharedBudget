import { Component, input, computed } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { DashboardOverview } from '../../../shared/models/dashboard.model';
import { CurrencyEurPipe } from '../../../shared/pipes/currency-eur.pipe';

@Component({
  selector: 'app-financial-summary',
  standalone: true,
  imports: [MatCardModule, MatIconModule, CurrencyEurPipe],
  template: `
    <div class="summary-row">
      <mat-card class="summary-card">
        <mat-card-content>
          <div class="card-icon income">
            <mat-icon>trending_up</mat-icon>
          </div>
          <span class="label">{{ prefix() }}Income</span>
          <span class="value">{{ data().totalCurrentIncome | currencyEur }}</span>
        </mat-card-content>
      </mat-card>

      <mat-card class="summary-card">
        <mat-card-content>
          <div class="card-icon expenses">
            <mat-icon>trending_down</mat-icon>
          </div>
          <span class="label">{{ prefix() }}Expenses</span>
          <span class="value">{{ data().expenses.totalHouseholdExpenses | currencyEur }}</span>
        </mat-card-content>
      </mat-card>

      <mat-card class="summary-card">
        <mat-card-content>
          <div class="card-icon remaining-expenses">
            <mat-icon>pending</mat-icon>
          </div>
          <span class="label">Remaining Expenses</span>
          <span class="value">{{ data().expenses.remainingHouseholdExpenses | currencyEur }}</span>
        </mat-card-content>
      </mat-card>

      <mat-card class="summary-card">
        <mat-card-content>
          <div class="card-icon savings">
            <mat-icon>savings</mat-icon>
          </div>
          <span class="label">Total Savings</span>
          <span class="value">{{ data().savings.totalSavings | currencyEur }}</span>
        </mat-card-content>
      </mat-card>

      <mat-card class="summary-card">
        <mat-card-content>
          <div class="card-icon shared-savings">
            <mat-icon>group</mat-icon>
          </div>
          <span class="label">Shared Savings</span>
          <span class="value">{{ data().savings.totalSharedSavings | currencyEur }}</span>
        </mat-card-content>
      </mat-card>

      <mat-card class="summary-card">
        <mat-card-content>
          <div class="card-icon" [class]="remainingBudget() >= 0 ? 'positive' : 'negative'">
            <mat-icon>{{ remainingBudget() >= 0 ? 'account_balance' : 'warning' }}</mat-icon>
          </div>
          <span class="label">Remaining Budget</span>
          <span class="value" [class]="remainingBudget() >= 0 ? 'positive' : 'negative'">
            {{ remainingBudget() | currencyEur }}
          </span>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .summary-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: var(--space-md);
    }
    @media (max-width: 1280px) { .summary-row { grid-template-columns: repeat(3, 1fr); } }
    @media (max-width: 768px) { .summary-row { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 480px) { .summary-row { grid-template-columns: 1fr; } }

    .summary-card mat-card-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: var(--space-xs);
      padding: var(--space-md) var(--space-sm);
    }
    .card-icon {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: var(--space-xs);
    }
    .card-icon.income { background: color-mix(in srgb, var(--color-positive) 15%, transparent); color: var(--color-positive); }
    .card-icon.expenses { background: color-mix(in srgb, var(--color-negative) 15%, transparent); color: var(--color-negative); }
    .card-icon.remaining-expenses { background: color-mix(in srgb, var(--mat-sys-tertiary) 15%, transparent); color: var(--mat-sys-tertiary); }
    .card-icon.savings { background: color-mix(in srgb, var(--color-info) 15%, transparent); color: var(--color-info); }
    .card-icon.shared-savings { background: color-mix(in srgb, var(--mat-sys-primary) 15%, transparent); color: var(--mat-sys-primary); }
    .card-icon.positive { background: color-mix(in srgb, var(--color-positive) 15%, transparent); color: var(--color-positive); }
    .card-icon.negative { background: color-mix(in srgb, var(--color-negative) 15%, transparent); color: var(--color-negative); }
    .label { font: var(--mat-sys-label-medium); color: var(--mat-sys-on-surface-variant); }
    .value { font: var(--mat-sys-title-large); font-weight: 600; }
    .value.positive { color: var(--color-positive); }
    .value.negative { color: var(--color-negative); }
  `],
})
export class FinancialSummaryComponent {
  readonly data = input.required<DashboardOverview>();
  readonly viewMode = input<'monthly' | 'yearly'>('monthly');

  readonly prefix = computed(() => this.viewMode() === 'yearly' ? 'Avg. ' : '');

  readonly remainingBudget = computed(() => this.data().savings.totalRemainingBudget);
}
