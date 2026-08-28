import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MemberExpenseSummary } from '../../../shared/models/dashboard.model';
import { CurrencyEurPipe } from '../../../shared/pipes/currency-eur.pipe';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-expense-summary-card',
  imports: [MatCardModule, CurrencyEurPipe],
  template: `
    <mat-card>
      <mat-card-header><div class="summary-icon expenses"><span aria-hidden="true">−</span></div><mat-card-title>Expenses</mat-card-title><mat-card-subtitle>Monthly outgoings</mat-card-subtitle></mat-card-header>
      <mat-card-content>
        @for (e of personalExpenses(); track e.userId) {
          <div class="row">
            <span>{{ e.firstName }} {{ e.lastName }} (personal)</span>
            <span>{{ e.personalExpensesTotal | currencyEur }}</span>
          </div>
        }
        <div class="row">
          <span>Shared expenses</span>
          <span>{{ sharedTotal() | currencyEur }}</span>
        </div>
        <div class="row total">
          <strong>Grand Total</strong>
          <strong>{{ grandTotal() | currencyEur }}</strong>
        </div>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    mat-card { height: 100%; }
    mat-card-header { align-items: center; }
    .summary-icon { display: grid; width: 38px; height: 38px; margin-right: 12px; place-items: center; border-radius: 11px; font-size: 1.2rem; font-weight: 600; }
    .expenses { background: var(--color-negative-container); color: var(--color-negative); }
    .row { display: flex; justify-content: space-between; padding: 7px 0; color: var(--color-ink-muted); font-size: 0.8rem; }
    .row span:last-child { color: var(--color-ink); font-weight: 600; }
    .total { border-top: 1px solid var(--color-border); margin-top: 8px; padding-top: 12px; }
  `],
})
export class ExpenseSummaryCardComponent {
  readonly personalExpenses = input.required<MemberExpenseSummary[]>();
  readonly sharedTotal = input.required<number>();
  readonly grandTotal = input.required<number>();
}
