import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MemberIncome } from '../../../shared/models/dashboard.model';
import { CurrencyEurPipe } from '../../../shared/pipes/currency-eur.pipe';

@Component({
  selector: 'app-income-summary-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatCardModule, CurrencyEurPipe],
  template: `
    <mat-card>
      <mat-card-header><mat-card-title>Income</mat-card-title></mat-card-header>
      <mat-card-content>
        @for (m of members(); track m.userId) {
          <div class="row">
            <span>{{ m.firstName }} {{ m.lastName }}</span>
            <span>{{ m.currentSalary | currencyEur }}</span>
          </div>
        }
        <div class="row total">
          <strong>Total</strong>
          <strong>{{ totalCurrent() | currencyEur }}</strong>
        </div>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .row { display: flex; justify-content: space-between; padding: 6px 0; }
    .total { border-top: 1px solid var(--mat-sys-outline-variant); margin-top: 8px; padding-top: 8px; }
  `],
})
export class IncomeSummaryCardComponent {
  readonly members = input.required<MemberIncome[]>();
  readonly totalCurrent = input.required<number>();
}
