import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonBackButton, IonButtons, IonSpinner,
} from '@ionic/angular/standalone';
import { PersonalExpenseStore } from '../../personal-expenses/stores/personal-expense.store';
import { ExpenseFormComponent } from './components/expense-form.component';
import { CreateExpenseRequest } from '../../../shared/models/expense.model';

@Component({
  selector: 'app-personal-expense-form-page',
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
        <ion-title>{{ isEdit() ? 'Edit' : 'New' }} Personal Expense</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      @if (store.loading()) {
        <div class="spinner-container"><ion-spinner name="crescent"></ion-spinner></div>
      } @else {
        <app-expense-form
          [expense]="store.selectedExpense()"
          [loading]="store.loading()"
          (save)="onSave($event)" />
      }
    </ion-content>
  `,
  styles: [`.spinner-container { display: flex; justify-content: center; padding: 48px 0; }`],
})
export class PersonalExpenseFormPage {
  readonly store = inject(PersonalExpenseStore);
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
    if (this.isEdit()) this.store.updateExpense(expenseId, dto, undefined, undefined, onSuccess);
    else this.store.createExpense(dto, undefined, undefined, onSuccess);
  }
}
