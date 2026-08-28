import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MemberSavings } from '../../../shared/models/dashboard.model';
import { CurrencyDisplayComponent } from '../../../shared/components/currency-display.component';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-savings-card',
  imports: [MatCardModule, CurrencyDisplayComponent],
  template: `
    <mat-card>
      <mat-card-header><div class="summary-icon savings"><span aria-hidden="true">↗</span></div><mat-card-title>Savings</mat-card-title><mat-card-subtitle>Progress by member</mat-card-subtitle></mat-card-header>
      <mat-card-content>
        @for (m of members(); track m.userId) {
          <div class="row">
            <span>{{ m.firstName }} {{ m.lastName }}</span>
            <app-currency-display [amount]="m.personalSavings + m.sharedSavings" [colorize]="true" />
          </div>
        }
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    mat-card { height: 100%; }
    mat-card-header { align-items: center; }
    .summary-icon { display: grid; width: 38px; height: 38px; margin-right: 12px; place-items: center; border-radius: 11px; font-size: 1.05rem; font-weight: 600; }
    .savings { background: var(--color-info-container); color: var(--color-info); }
    .row { display: flex; justify-content: space-between; padding: 8px 0; color: var(--color-ink-muted); font-size: 0.8rem; }
  `],
})
export class SavingsCardComponent {
  readonly members = input.required<MemberSavings[]>();
}
