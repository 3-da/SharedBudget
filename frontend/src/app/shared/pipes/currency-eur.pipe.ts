import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'currencyEur', standalone: true })
export class CurrencyEurPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    if (value == null) return '\u20AC0.00';
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(value);
  }
}
