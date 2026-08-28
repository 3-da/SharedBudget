import { ChangeDetectionStrategy, Component, input, computed } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MemberIncome, MemberExpenseSummary, MemberSavings } from '../../../shared/models/dashboard.model';
import { CurrencyEurPipe } from '../../../shared/pipes/currency-eur.pipe';
import { HouseholdRole } from '../../../shared/models/enums';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-member-finance-card',
  imports: [MatCardModule, MatIconModule, CurrencyEurPipe],
  template: `
    <mat-card>
      <mat-card-header>
        <div matCardAvatar class="member-avatar" aria-hidden="true">{{ income().firstName[0] }}{{ income().lastName[0] }}</div>
        <mat-card-title>{{ income().firstName }} {{ income().lastName }}</mat-card-title>
        <mat-card-subtitle>{{ role() === 'OWNER' ? 'Owner' : 'Member' }}</mat-card-subtitle>
      </mat-card-header>
      <mat-card-content>
        <div class="stat-row">
          <span class="stat-label">Salary</span>
          <span class="stat-value">{{ income().currentSalary | currencyEur }}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Personal Expenses</span>
          <span class="stat-value">{{ personalTotal() | currencyEur }}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Shared Expenses</span>
          <span class="stat-value">{{ sharedExpensesShare() | currencyEur }}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Personal Savings</span>
          <span class="stat-value">{{ personalSavingsAmount() | currencyEur }}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Shared Savings</span>
          <span class="stat-value">{{ sharedSavingsAmount() | currencyEur }}</span>
        </div>
        <div class="stat-row budget-row">
          <span class="stat-label">Remaining Budget</span>
          <span class="stat-value" [class]="budgetAmount() >= 0 ? 'positive' : 'negative'">
            {{ budgetAmount() | currencyEur }}
          </span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Member Expenses</span>
          <span class="stat-value warning">{{ totalMemberExpenses() | currencyEur }}</span>
        </div>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    mat-card { height: 100%; }
    .member-avatar { display: grid; width: 42px; height: 42px; place-items: center; border-radius: 12px; background: var(--color-brand-soft); color: var(--color-brand-strong); font-size: 0.75rem; font-weight: 700; }
    .stat-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
    }
    .budget-row {
      border-top: 1px solid var(--color-border);
      margin-top: 6px;
      padding-top: 13px;
      font-weight: 600;
    }
    .stat-label { color: var(--color-ink-muted); font-size: 0.78rem; }
    .stat-value { color: var(--color-ink); font-size: 0.82rem; font-weight: 600; }
    .positive { color: var(--color-positive); }
    .negative { color: var(--color-negative); }
    .warning { color: var(--color-warning); }
  `],
})
export class MemberFinanceCardComponent {
  readonly income = input.required<MemberIncome>();
  readonly expenses = input<MemberExpenseSummary | null>(null);
  readonly savings = input<MemberSavings | null>(null);
  readonly sharedExpensesShare = input(0);
  readonly role = input<HouseholdRole | null>(null);

  readonly personalTotal = computed(() => this.expenses()?.personalExpensesTotal ?? 0);
  readonly personalSavingsAmount = computed(() => this.savings()?.personalSavings ?? 0);
  readonly sharedSavingsAmount = computed(() => this.savings()?.sharedSavings ?? 0);
  readonly budgetAmount = computed(() => this.savings()?.remainingBudget ?? 0);
  readonly totalMemberExpenses = computed(() => this.personalTotal() + this.sharedExpensesShare());
}
