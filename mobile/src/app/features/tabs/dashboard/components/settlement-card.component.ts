import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonButton, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { checkmarkCircle, shieldCheckmark } from 'ionicons/icons';
import { SettlementResponse } from '../../../../shared/models/dashboard.model';
import { CurrencyEurPipe } from '../../../../shared/pipes/currency-eur.pipe';

@Component({
  selector: 'app-settlement-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonButton, IonIcon, CurrencyEurPipe],
  template: `
    <ion-card>
      <ion-card-header>
        <ion-card-title>Settlement</ion-card-title>
      </ion-card-header>
      <ion-card-content>
        @if (settlement(); as s) {
          <p>{{ s.message }}</p>
          @if (s.amount > 0) {
            <p class="amount">{{ s.amount | currencyEur }}</p>
          }
          @if (!s.isSettled && s.amount > 0) {
            <ion-button expand="block" (click)="markPaid.emit()">
              <ion-icon slot="start" name="checkmark-circle"></ion-icon>
              Mark as Paid
            </ion-button>
          }
          @if (s.isSettled) {
            <p class="settled">
              <ion-icon name="shield-checkmark"></ion-icon> Settled
            </p>
          }
        } @else {
          <p>No settlement data available</p>
        }
      </ion-card-content>
    </ion-card>
  `,
  styles: [`
    .amount { font-size: 24px; font-weight: 600; margin: 12px 0; }
    .settled { display: flex; align-items: center; gap: 8px; color: var(--ion-color-success); }
  `],
})
export class SettlementCardComponent {
  readonly settlement = input.required<SettlementResponse | null>();
  readonly markPaid = output<void>();

  constructor() {
    addIcons({ checkmarkCircle, shieldCheckmark });
  }
}
