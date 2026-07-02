import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CurrencyEurPipe } from '../pipes/currency-eur.pipe';

/**
 * Shows what's been paid and, for a flexible expense with money still owed
 * this month, what remains. Both amounts come from the backend (which knows
 * about recurring overrides) rather than being recomputed from the expense's
 * base amount, so this always agrees with the dashboard's totals.
 */
@Component({
  selector: 'app-payment-breakdown',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyEurPipe],
  template: `
    <div class="payment-breakdown">
      <span class="paid-info">Paid {{ paidAmount() | currencyEur }}</span>
      @if ((remainingAmount() ?? 0) > 0) {
        <span class="remaining-info">{{ remainingAmount() | currencyEur }} remaining</span>
      }
    </div>
  `,
  styles: [`
    .payment-breakdown { display: flex; align-items: center; gap: 10px; margin-top: 6px; flex-wrap: wrap; }
    .paid-info { font-size: 13px; font-weight: 500; color: var(--mat-sys-primary); }
    .remaining-info { font-size: 13px; color: var(--mat-sys-error); }
    .remaining-info::before { content: '·'; margin-right: 10px; color: var(--mat-sys-on-surface-variant); }
  `],
})
export class PaymentBreakdownComponent {
  readonly paidAmount = input.required<number>();
  readonly remainingAmount = input<number | null>(null);
}
