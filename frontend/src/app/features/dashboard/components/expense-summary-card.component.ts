import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MemberExpenseSummary } from '../../../shared/models/dashboard.model';
import { CurrencyEurPipe } from '../../../shared/pipes/currency-eur.pipe';

@Component({
  selector: 'app-expense-summary-card',
  standalone: true,
  imports: [MatCardModule, CurrencyEurPipe],
  template: `
    <mat-card>
      <mat-card-header><mat-card-title>Expenses</mat-card-title></mat-card-header>
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
    .row { display: flex; justify-content: space-between; padding: 6px 0; }
    .total { border-top: 1px solid var(--mat-sys-outline-variant); margin-top: 8px; padding-top: 8px; }
  `],
})
export class ExpenseSummaryCardComponent {
  readonly personalExpenses = input.required<MemberExpenseSummary[]>();
  readonly sharedTotal = input.required<number>();
  readonly grandTotal = input.required<number>();
}
