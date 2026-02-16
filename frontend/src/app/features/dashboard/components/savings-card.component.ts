import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MemberSavings } from '../../../shared/models/dashboard.model';
import { CurrencyDisplayComponent } from '../../../shared/components/currency-display.component';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-savings-card',
  standalone: true,
  imports: [MatCardModule, CurrencyDisplayComponent],
  template: `
    <mat-card>
      <mat-card-header><mat-card-title>Savings</mat-card-title></mat-card-header>
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
  styles: [`.row { display: flex; justify-content: space-between; padding: 6px 0; }`],
})
export class SavingsCardComponent {
  readonly members = input.required<MemberSavings[]>();
}
