import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { SalaryResponse } from '../../../shared/models/salary.model';
import { CurrencyEurPipe } from '../../../shared/pipes/currency-eur.pipe';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-salary-summary-card',
  standalone: true,
  imports: [MatCardModule, CurrencyEurPipe],
  template: `
    <mat-card>
      <mat-card-header>
        <mat-card-title>{{ salary().firstName }} {{ salary().lastName }}</mat-card-title>
      </mat-card-header>
      <mat-card-content>
        <div class="salary-row"><span>Default:</span><strong>{{ salary().defaultAmount | currencyEur }}</strong></div>
        <div class="salary-row"><span>Current:</span><strong>{{ salary().currentAmount | currencyEur }}</strong></div>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`.salary-row { display: flex; justify-content: space-between; padding: 4px 0; }`],
})
export class SalarySummaryCardComponent {
  readonly salary = input.required<SalaryResponse>();
}
