import { Component, input, computed } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MemberIncome, MemberExpenseSummary, MemberSavings } from '../../../shared/models/dashboard.model';
import { CurrencyEurPipe } from '../../../shared/pipes/currency-eur.pipe';

@Component({
  selector: 'app-member-finance-card',
  standalone: true,
  imports: [MatCardModule, MatIconModule, CurrencyEurPipe],
  template: `
    <mat-card>
      <mat-card-header>
        <mat-icon matCardAvatar>person</mat-icon>
        <mat-card-title>{{ income().firstName }} {{ income().lastName }}</mat-card-title>
        <mat-card-subtitle>Member</mat-card-subtitle>
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
    mat-icon[matCardAvatar] {
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
      border-radius: 50%;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
    }
    .stat-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
    }
    .budget-row {
      border-top: 1px solid var(--mat-sys-outline-variant);
      margin-top: 4px;
      padding-top: 10px;
      font-weight: 500;
    }
    .stat-label { color: var(--mat-sys-on-surface-variant); }
    .stat-value { font-weight: 500; }
    .positive { color: var(--color-positive); }
    .negative { color: var(--color-negative); }
    .warning { color: var(--mat-sys-tertiary); }
  `],
})
export class MemberFinanceCardComponent {
  readonly income = input.required<MemberIncome>();
  readonly expenses = input<MemberExpenseSummary | null>(null);
  readonly savings = input<MemberSavings | null>(null);
  readonly sharedExpensesShare = input(0);

  readonly personalTotal = computed(() => this.expenses()?.personalExpensesTotal ?? 0);
  readonly personalSavingsAmount = computed(() => this.savings()?.personalSavings ?? 0);
  readonly sharedSavingsAmount = computed(() => this.savings()?.sharedSavings ?? 0);
  readonly budgetAmount = computed(() => this.savings()?.remainingBudget ?? 0);
  readonly totalMemberExpenses = computed(() => this.personalTotal() + this.sharedExpensesShare());
}
