import { ChangeDetectionStrategy, Component, inject, Input, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent,
  IonButtons, IonButton, IonItem, IonInput, IonNote, IonIcon,
  ModalController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { informationCircleOutline } from 'ionicons/icons';
import { CurrencyEurPipe } from '../../../../shared/pipes/currency-eur.pipe';

@Component({
  selector: 'app-withdraw-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent,
    IonButtons, IonButton, IonItem, IonInput, IonNote, IonIcon,
    CurrencyEurPipe,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ title }}</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="dismiss()">Cancel</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <p>Current savings: <strong>{{ currentAmount | currencyEur }}</strong></p>
      @if (requiresApproval) {
        <div class="approval-info">
          <ion-icon name="information-circle-outline" />
          <span>Withdrawals from the shared pool require another member's approval.</span>
        </div>
      }
      <form [formGroup]="form">
        <ion-item>
          <ion-input
            label="Withdraw amount (EUR)"
            labelPlacement="floating"
            type="number"
            formControlName="amount"
            min="0.01"
            [max]="currentAmount" />
        </ion-item>
        <ion-note class="ion-padding-start">Max: {{ currentAmount | currencyEur }}</ion-note>
      </form>
      <ion-button
        expand="block"
        color="warning"
        [disabled]="form.invalid"
        (click)="confirm()"
        class="ion-margin-top">
        {{ requiresApproval ? 'Request Withdrawal' : 'Withdraw' }}
      </ion-button>
    </ion-content>
  `,
  styles: [`
    .approval-info {
      display: flex; align-items: center; gap: 8px;
      padding: 12px; margin-bottom: 12px;
      border-radius: 8px;
      background: var(--ion-color-tertiary-tint);
      font-size: 0.875rem;
    }
    .approval-info ion-icon { font-size: 20px; flex-shrink: 0; }
  `],
})
export class WithdrawModalComponent implements OnInit {
  @Input() title = 'Withdraw';
  @Input() currentAmount = 0;
  @Input() requiresApproval = false;

  private readonly modalCtrl = inject(ModalController);
  private readonly fb = inject(FormBuilder);
  readonly form = this.fb.nonNullable.group({
    amount: [0, [Validators.required, Validators.min(0.01)]],
  });

  constructor() {
    addIcons({ informationCircleOutline });
  }

  ngOnInit(): void {
    this.form.controls.amount.addValidators(Validators.max(this.currentAmount));
  }

  dismiss(): void {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  confirm(): void {
    if (this.form.valid) {
      this.modalCtrl.dismiss(this.form.getRawValue().amount, 'confirm');
    }
  }
}
