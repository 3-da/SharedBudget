import { ChangeDetectionStrategy, Component, input, output, computed } from '@angular/core';
import {
  IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent,
  IonChip, IonButton, IonIcon,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  checkmarkCircleOutline, arrowUndoOutline, calendarOutline,
  createOutline, trashOutline,
} from 'ionicons/icons';
import { Expense } from '../../../../shared/models/expense.model';
import { ExpenseCategory, YearlyPaymentStrategy, PaymentStatus } from '../../../../shared/models/enums';
import { CurrencyEurPipe } from '../../../../shared/pipes/currency-eur.pipe';

@Component({
  selector: 'app-expense-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent,
    IonChip, IonButton, IonIcon, CurrencyEurPipe,
  ],
  template: `
    <ion-card [class.paid]="isPaid()">
      <ion-card-header>
        <ion-card-title>{{ expense().name }}</ion-card-title>
        <ion-card-subtitle>
          <ion-chip>{{ expense().category }}</ion-chip>
          <ion-chip>{{ expense().frequency }}</ion-chip>
          @if (isPaid()) {
            <ion-chip color="success">Paid</ion-chip>
          }
          @if (isShared()) {
            <ion-chip color="tertiary">Shared</ion-chip>
          }
          @if (hasPendingApproval()) {
            <ion-chip color="warning">Pending</ion-chip>
          }
        </ion-card-subtitle>
      </ion-card-header>
      <ion-card-content>
        <p class="amount">{{ expense().amount | currencyEur }}</p>
        <div class="actions">
          @if (isPaid()) {
            <ion-button fill="clear" size="small" (click)="undoPaid.emit(expense().id)">
              <ion-icon name="arrow-undo-outline" slot="icon-only"></ion-icon>
            </ion-button>
          } @else {
            <ion-button fill="clear" size="small" (click)="markPaid.emit(expense().id)">
              <ion-icon name="checkmark-circle-outline" slot="icon-only"></ion-icon>
            </ion-button>
          }
          @if (hasTimeline()) {
            <ion-button fill="clear" size="small" (click)="viewTimeline.emit(expense().id)">
              <ion-icon name="calendar-outline" slot="icon-only"></ion-icon>
            </ion-button>
          }
          <ion-button fill="clear" size="small" (click)="edit.emit(expense().id)" [disabled]="hasPendingApproval()">
            <ion-icon name="create-outline" slot="icon-only"></ion-icon>
          </ion-button>
          <ion-button fill="clear" size="small" color="danger" (click)="remove.emit(expense().id)" [disabled]="hasPendingApproval()">
            <ion-icon name="trash-outline" slot="icon-only"></ion-icon>
          </ion-button>
        </div>
      </ion-card-content>
    </ion-card>
  `,
  styles: [`
    .amount { font-size: 20px; font-weight: 500; margin: 8px 0; }
    .actions { display: flex; }
    .paid { opacity: 0.7; }
  `],
})
export class ExpenseCardComponent {
  readonly expense = input.required<Expense>();
  readonly paymentStatus = input<PaymentStatus | null>(null);
  readonly isShared = input(false);
  readonly hasPendingApproval = input(false);
  readonly edit = output<string>();
  readonly remove = output<string>();
  readonly markPaid = output<string>();
  readonly undoPaid = output<string>();
  readonly viewTimeline = output<string>();

  readonly isPaid = computed(() => this.paymentStatus() === PaymentStatus.PAID);
  readonly hasTimeline = computed(() => {
    const e = this.expense();
    if (e.category === ExpenseCategory.RECURRING) return true;
    if (e.category === ExpenseCategory.ONE_TIME && e.yearlyPaymentStrategy === YearlyPaymentStrategy.INSTALLMENTS) return true;
    return false;
  });

  constructor() {
    addIcons({ checkmarkCircleOutline, arrowUndoOutline, calendarOutline, createOutline, trashOutline });
  }
}
