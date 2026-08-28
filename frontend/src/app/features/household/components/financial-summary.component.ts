import { ChangeDetectionStrategy, Component, input, computed } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { DashboardOverview } from '../../../shared/models/dashboard.model';
import { CurrencyEurPipe } from '../../../shared/pipes/currency-eur.pipe';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-financial-summary',
  imports: [MatCardModule, MatIconModule, CurrencyEurPipe],
  template: `
    <div class="summary-row">
      <mat-card class="summary-card featured-card">
        <mat-card-content>
          <div class="featured-heading">
            <div class="card-icon" [class]="remainingBudget() >= 0 ? 'positive' : 'negative'">
              <mat-icon aria-hidden="true">{{ remainingBudget() >= 0 ? 'account_balance_wallet' : 'warning' }}</mat-icon>
            </div>
            <span class="trend-label">Available after expenses</span>
          </div>
          <span class="label">Remaining budget</span>
          <span class="featured-value" [class]="remainingBudget() >= 0 ? 'positive' : 'negative'">
            {{ remainingBudget() | currencyEur }}
          </span>
          <span class="featured-support">Across your household for {{ viewMode() === 'yearly' ? 'an average month' : 'this month' }}</span>
        </mat-card-content>
      </mat-card>

      <mat-card class="summary-card">
        <mat-card-content>
          <div class="metric-heading"><span class="label">{{ prefix() }}Income</span><div class="card-icon income"><mat-icon aria-hidden="true">south_west</mat-icon></div></div>
          <span class="value">{{ data().totalCurrentIncome | currencyEur }}</span>
          <span class="metric-support">Total household earnings</span>
        </mat-card-content>
      </mat-card>

      <mat-card class="summary-card">
        <mat-card-content>
          <div class="metric-heading"><span class="label">{{ prefix() }}Expenses</span><div class="card-icon expenses"><mat-icon aria-hidden="true">north_east</mat-icon></div></div>
          <span class="value">{{ data().expenses.totalHouseholdExpenses | currencyEur }}</span>
          <span class="metric-support">Personal and shared</span>
        </mat-card-content>
      </mat-card>

      <mat-card class="summary-card">
        <mat-card-content>
          <div class="metric-heading"><span class="label">Total savings</span><div class="card-icon savings"><mat-icon aria-hidden="true">savings</mat-icon></div></div>
          <span class="value">{{ data().savings.totalSavings | currencyEur }}</span>
          <span class="metric-support">Built together over time</span>
        </mat-card-content>
      </mat-card>

      <mat-card class="summary-card">
        <mat-card-content>
          <div class="metric-heading"><span class="label">Shared savings</span><div class="card-icon shared-savings"><mat-icon aria-hidden="true">diversity_1</mat-icon></div></div>
          <span class="value">{{ data().savings.totalSharedSavings | currencyEur }}</span>
          <span class="metric-support">Your common savings pool</span>
        </mat-card-content>
      </mat-card>

      <mat-card class="summary-card">
        <mat-card-content>
          <div class="metric-heading"><span class="label">Still to pay</span><div class="card-icon remaining-expenses"><mat-icon aria-hidden="true">schedule</mat-icon></div></div>
          <span class="value">{{ data().expenses.remainingHouseholdExpenses | currencyEur }}</span>
          <span class="metric-support">Outstanding this month</span>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .summary-row {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 14px;
    }
    .summary-card mat-card-content {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-height: 126px;
      padding: 18px;
      box-sizing: border-box;
    }
    .featured-card { grid-column: span 2; border: 0; background: linear-gradient(135deg, #1a2a48, #254474); color: white; box-shadow: 0 14px 30px rgba(26, 42, 72, 0.18); }
    .featured-card mat-card-content { min-height: 166px; justify-content: center; padding: 22px 24px; }
    .featured-heading,
    .metric-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .featured-card .label { color: rgba(255, 255, 255, 0.7); }
    .featured-value { color: white !important; font-size: clamp(2rem, 4vw, 2.75rem); font-weight: 700; letter-spacing: -0.055em; line-height: 1; }
    .featured-support,
    .metric-support { color: var(--color-ink-muted); font-size: 0.72rem; }
    .featured-support { color: rgba(255, 255, 255, 0.58); }
    .trend-label { color: rgba(255, 255, 255, 0.72); font-size: 0.7rem; font-weight: 600; }
    .card-icon {
      width: 34px;
      height: 34px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .card-icon mat-icon { width: 18px; height: 18px; font-size: 18px; }
    .featured-card .card-icon { background: rgba(255, 255, 255, 0.12); color: white; }
    .card-icon.income { background: color-mix(in srgb, var(--color-positive) 15%, transparent); color: var(--color-positive); }
    .card-icon.expenses { background: color-mix(in srgb, var(--color-negative) 15%, transparent); color: var(--color-negative); }
    .card-icon.remaining-expenses { background: color-mix(in srgb, var(--mat-sys-tertiary) 15%, transparent); color: var(--mat-sys-tertiary); }
    .card-icon.savings { background: color-mix(in srgb, var(--color-info) 15%, transparent); color: var(--color-info); }
    .card-icon.shared-savings { background: color-mix(in srgb, var(--mat-sys-primary) 15%, transparent); color: var(--mat-sys-primary); }
    .card-icon.positive { background: color-mix(in srgb, var(--color-positive) 15%, transparent); color: var(--color-positive); }
    .card-icon.negative { background: color-mix(in srgb, var(--color-negative) 15%, transparent); color: var(--color-negative); }
    .label { color: var(--color-ink-muted); font-size: 0.72rem; font-weight: 600; }
    .value { color: var(--color-ink); font-size: 1.35rem; font-weight: 700; letter-spacing: -0.04em; }
    .value.positive { color: var(--color-positive); }
    .value.negative { color: var(--color-negative); }
    @media (max-width: 1100px) { .summary-row { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 560px) {
      .summary-row { grid-template-columns: 1fr; }
      .featured-card { grid-column: auto; }
      .summary-card mat-card-content { min-height: 118px; }
    }
  `],
})
export class FinancialSummaryComponent {
  readonly data = input.required<DashboardOverview>();
  readonly viewMode = input<'monthly' | 'yearly'>('monthly');

  readonly prefix = computed(() => this.viewMode() === 'yearly' ? 'Avg. ' : '');

  readonly remainingBudget = computed(() => this.data().savings.totalRemainingBudget);
}
