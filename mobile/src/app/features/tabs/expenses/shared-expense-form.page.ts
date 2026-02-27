import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonBackButton, IonButtons, IonSpinner,
} from '@ionic/angular/standalone';
import { SharedExpenseStore } from '../../shared-expenses/stores/shared-expense.store';
import { ExpenseFormComponent } from './components/expense-form.component';
import { CreateExpenseRequest } from '../../../shared/models/expense.model';

@Component({
  selector: 'app-shared-expense-form-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent, IonBackButton, IonButtons, IonSpinner,
    ExpenseFormComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/tabs/expenses"></ion-back-button>
        </ion-buttons>
        <ion-title>{{ isEdit() ? 'Propose Update' : 'Propose New' }} Shared Expense</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      @if (store.loading()) {
        <div class="spinner-container"><ion-spinner name="crescent"></ion-spinner></div>
      } @else {
        <app-expense-form
          [expense]="store.selectedExpense()"
          [loading]="store.loading()"
          [showPaidBy]="false"
          (save)="onSave($event)" />
      }
    </ion-content>
  `,
  styles: [`.spinner-container { display: flex; justify-content: center; padding: 48px 0; }`],
})
export class SharedExpenseFormPage {
  readonly store = inject(SharedExpenseStore);
  private readonly router = inject(Router);

  readonly id = input<string>('');
  readonly isEdit = computed(() => !!this.id());

  constructor() {
    effect(() => {
      const expenseId = this.id();
      if (expenseId) this.store.loadExpense(expenseId);
      else this.store.selectedExpense.set(null);
    });
  }

  onSave(dto: CreateExpenseRequest): void {
    const onSuccess = () => this.router.navigate(['/tabs/expenses']);
    const expenseId = this.id();
    if (this.isEdit()) this.store.proposeUpdate(expenseId, dto, undefined, undefined, onSuccess);
    else this.store.proposeCreate(dto, undefined, undefined, onSuccess);
  }
}
