import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MemberIncome } from '../../../shared/models/dashboard.model';
import { CurrencyEurPipe } from '../../../shared/pipes/currency-eur.pipe';

@Component({
  selector: 'app-income-summary-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatCardModule, CurrencyEurPipe],
  template: `
    <mat-card>
      <mat-card-header><div class="summary-icon income"><span aria-hidden="true">+</span></div><mat-card-title>Income</mat-card-title><mat-card-subtitle>Household earnings</mat-card-subtitle></mat-card-header>
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
    mat-card { height: 100%; }
    mat-card-header { align-items: center; }
    .summary-icon { display: grid; width: 38px; height: 38px; margin-right: 12px; place-items: center; border-radius: 11px; font-size: 1.2rem; font-weight: 600; }
    .income { background: var(--color-positive-container); color: var(--color-positive); }
    .row { display: flex; justify-content: space-between; padding: 7px 0; color: var(--color-ink-muted); font-size: 0.8rem; }
    .row span:last-child { color: var(--color-ink); font-weight: 600; }
    .total { border-top: 1px solid var(--color-border); margin-top: 8px; padding-top: 12px; }
  `],
})
export class IncomeSummaryCardComponent {
  readonly members = input.required<MemberIncome[]>();
  readonly totalCurrent = input.required<number>();
}
