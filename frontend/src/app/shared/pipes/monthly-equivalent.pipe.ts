import { Pipe, PipeTransform } from '@angular/core';
import { ExpenseFrequency } from '../models/enums';

@Pipe({ name: 'monthlyEquivalent', standalone: true })
export class MonthlyEquivalentPipe implements PipeTransform {
  transform(amount: number, frequency: ExpenseFrequency): number {
    if (frequency === ExpenseFrequency.YEARLY) {
      return Math.round((amount / 12) * 100) / 100;
    }
    return amount;
  }
}
