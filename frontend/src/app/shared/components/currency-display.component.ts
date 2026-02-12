import { ChangeDetectionStrategy, Component, input, computed } from '@angular/core';
import { CurrencyEurPipe } from '../pipes/currency-eur.pipe';

@Component({
  selector: 'app-currency-display',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyEurPipe],
  template: `<span [class]="colorClass()">{{ amount() | currencyEur }}</span>`,
  styles: [`:host { display: inline; }`],
})
export class CurrencyDisplayComponent {
  amount = input.required<number>();
  colorize = input(false);

  colorClass = computed(() => {
    if (!this.colorize()) return '';
    return this.amount() >= 0 ? 'positive' : 'negative';
  });
}
