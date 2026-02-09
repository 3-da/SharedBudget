import { Component, input, computed } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { MemberIncome, MemberExpenseSummary, MemberSavings } from '../../../shared/models/dashboard.model';
import { CurrencyEurPipe } from '../../../shared/pipes/currency-eur.pipe';

@Component({
  selector: 'app-member-finance-card',
  standalone: true,
  imports: [MatCardModule, MatIconModule, MatButtonModule, RouterLink, CurrencyEurPipe],
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
          <span class="stat-label">Savings</span>
          <span class="stat-value" [class]="savingsAmount() >= 0 ? 'positive' : 'negative'">
            {{ savingsAmount() | currencyEur }}
          </span>
        </div>
      </mat-card-content>
      @if (!isSelf()) {
        <mat-card-actions align="end">
          <a mat-button [routerLink]="['/household/members', income().userId]">
            <mat-icon>visibility</mat-icon> Details
          </a>
        </mat-card-actions>
      }
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
    .stat-label { color: var(--mat-sys-on-surface-variant); }
    .stat-value { font-weight: 500; }
    .positive { color: var(--color-positive); }
    .negative { color: var(--color-negative); }
  `],
})
export class MemberFinanceCardComponent {
  readonly income = input.required<MemberIncome>();
  readonly expenses = input<MemberExpenseSummary | null>(null);
  readonly savings = input<MemberSavings | null>(null);
  readonly isSelf = input(false);

  readonly personalTotal = computed(() => this.expenses()?.personalExpensesTotal ?? 0);
  readonly savingsAmount = computed(() => this.savings()?.currentSavings ?? 0);
}
