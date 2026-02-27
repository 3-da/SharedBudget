import { ChangeDetectionStrategy, Component, inject, computed, input, effect } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonBackButton, IonButtons,
  IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent,
  IonSpinner, IonButton, IonIcon, IonText,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowBackOutline } from 'ionicons/icons';
import { HouseholdStore } from '../../household/stores/household.store';
import { CurrencyEurPipe } from '../../../shared/pipes/currency-eur.pipe';

@Component({
  selector: 'app-member-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent, IonBackButton, IonButtons,
    IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent,
    IonSpinner, IonButton, IonIcon, IonText,
    CurrencyEurPipe,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/tabs/household"></ion-back-button>
        </ion-buttons>
        <ion-title>Member Details</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      @if (store.overviewLoading() || store.loading()) {
        <div class="spinner-container">
          <ion-spinner name="crescent"></ion-spinner>
        </div>
      } @else if (isSelf()) {
        <div class="empty-state">
          <h3>Cannot view own profile</h3>
          <ion-text color="medium"><p>Navigate to the relevant pages to see your own data.</p></ion-text>
          <ion-button (click)="goBack()">
            <ion-icon name="arrow-back-outline" slot="start"></ion-icon>
            Back to Household
          </ion-button>
        </div>
      } @else if (memberIncome(); as member) {
        <h2>{{ member.firstName }} {{ member.lastName }}</h2>

        <!-- Salary -->
        <ion-card>
          <ion-card-header>
            <ion-card-title>Salary</ion-card-title>
            <ion-card-subtitle>{{ store.monthLabel() }}</ion-card-subtitle>
          </ion-card-header>
          <ion-card-content>
            <div class="stat-row">
              <span>Default salary</span>
              <span>{{ member.defaultSalary | currencyEur }}</span>
            </div>
            <div class="stat-row">
              <span>Current salary</span>
              <span>{{ member.currentSalary | currencyEur }}</span>
            </div>
          </ion-card-content>
        </ion-card>

        <!-- Expenses -->
        <ion-card>
          <ion-card-header>
            <ion-card-title>Personal Expenses</ion-card-title>
            <ion-card-subtitle>Monthly total</ion-card-subtitle>
          </ion-card-header>
          <ion-card-content>
            <div class="stat-row">
              <span>Total personal expenses</span>
              <span>{{ memberExpenseTotal() | currencyEur }}</span>
            </div>
          </ion-card-content>
        </ion-card>

        <!-- Savings -->
        <ion-card>
          <ion-card-header>
            <ion-card-title>Savings & Budget</ion-card-title>
            <ion-card-subtitle>Actual savings from records</ion-card-subtitle>
          </ion-card-header>
          <ion-card-content>
            <div class="stat-row">
              <span>Personal savings</span>
              <span>{{ memberPersonalSavings() | currencyEur }}</span>
            </div>
            <div class="stat-row">
              <span>Shared savings</span>
              <span>{{ memberSharedSavings() | currencyEur }}</span>
            </div>
            <div class="stat-row">
              <span>Remaining budget</span>
              <span [class]="memberRemainingBudget() >= 0 ? 'positive' : 'negative'">
                {{ memberRemainingBudget() | currencyEur }}
              </span>
            </div>
          </ion-card-content>
        </ion-card>
      } @else {
        <div class="empty-state">
          <h3>Member not found</h3>
          <ion-text color="medium"><p>This member does not exist or is not in your household.</p></ion-text>
          <ion-button (click)="goBack()">
            <ion-icon name="arrow-back-outline" slot="start"></ion-icon>
            Back to Household
          </ion-button>
        </div>
      }
    </ion-content>
  `,
  styles: [`
    .spinner-container { display: flex; justify-content: center; padding: 48px 0; }
    .empty-state { text-align: center; padding: 48px 16px; }
    .stat-row { display: flex; justify-content: space-between; padding: 8px 0; }
    .positive { color: var(--ion-color-success); }
    .negative { color: var(--ion-color-danger); }
  `],
})
export class MemberDetailPage {
  readonly store = inject(HouseholdStore);
  private readonly router = inject(Router);

  readonly userId = input<string>('');

  readonly isSelf = computed(() => this.userId() === this.store.currentUserId());

  readonly memberIncome = computed(() =>
    this.store.overview()?.income.find(m => m.userId === this.userId()) ?? null,
  );

  readonly memberExpenseTotal = computed(() =>
    this.store.overview()?.expenses.personalExpenses.find(e => e.userId === this.userId())?.personalExpensesTotal ?? 0,
  );

  readonly memberPersonalSavings = computed(() =>
    this.store.overview()?.savings.members.find(s => s.userId === this.userId())?.personalSavings ?? 0,
  );

  readonly memberSharedSavings = computed(() =>
    this.store.overview()?.savings.members.find(s => s.userId === this.userId())?.sharedSavings ?? 0,
  );

  readonly memberRemainingBudget = computed(() =>
    this.store.overview()?.savings.members.find(s => s.userId === this.userId())?.remainingBudget ?? 0,
  );

  constructor() {
    addIcons({ arrowBackOutline });
    effect(() => {
      this.userId();
      if (!this.store.hasHousehold()) {
        this.store.loadHousehold();
      } else if (!this.store.overview()) {
        this.store.loadOverview();
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/tabs/household']);
  }
}
