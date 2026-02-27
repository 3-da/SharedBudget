import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IonCard, IonCardHeader, IonCardTitle, IonCardContent } from '@ionic/angular/standalone';
import { MemberSavings } from '../../../../shared/models/dashboard.model';
import { CurrencyEurPipe } from '../../../../shared/pipes/currency-eur.pipe';

@Component({
  selector: 'app-savings-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonCard, IonCardHeader, IonCardTitle, IonCardContent, CurrencyEurPipe],
  template: `
    <ion-card>
      <ion-card-header>
        <ion-card-title>Savings</ion-card-title>
      </ion-card-header>
      <ion-card-content>
        @for (m of members(); track m.userId) {
          <div class="row">
            <span>{{ m.firstName }} {{ m.lastName }}</span>
            <span [class]="(m.personalSavings + m.sharedSavings) >= 0 ? 'positive' : 'negative'">
              {{ m.personalSavings + m.sharedSavings | currencyEur }}
            </span>
          </div>
        }
      </ion-card-content>
    </ion-card>
  `,
  styles: [`
    .row { display: flex; justify-content: space-between; padding: 6px 0; }
    .positive { color: var(--ion-color-success); }
    .negative { color: var(--ion-color-danger); }
  `],
})
export class SavingsCardComponent {
  readonly members = input.required<MemberSavings[]>();
}
