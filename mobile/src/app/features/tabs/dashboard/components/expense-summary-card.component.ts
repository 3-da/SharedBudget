import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IonCard, IonCardHeader, IonCardTitle, IonCardContent } from '@ionic/angular/standalone';
import { MemberExpenseSummary } from '../../../../shared/models/dashboard.model';
import { CurrencyEurPipe } from '../../../../shared/pipes/currency-eur.pipe';

@Component({
  selector: 'app-expense-summary-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonCard, IonCardHeader, IonCardTitle, IonCardContent, CurrencyEurPipe],
  template: `
    <ion-card>
      <ion-card-header>
        <ion-card-title>Expenses</ion-card-title>
      </ion-card-header>
      <ion-card-content>
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
      </ion-card-content>
    </ion-card>
  `,
  styles: [`
    .row { display: flex; justify-content: space-between; padding: 6px 0; }
    .total { border-top: 1px solid var(--ion-color-step-200); margin-top: 8px; padding-top: 8px; }
  `],
})
export class ExpenseSummaryCardComponent {
  readonly personalExpenses = input.required<MemberExpenseSummary[]>();
  readonly sharedTotal = input.required<number>();
  readonly grandTotal = input.required<number>();
}
