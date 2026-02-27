import { ChangeDetectionStrategy, Component, inject, OnInit, computed } from '@angular/core';
import {
  IonHeader, IonToolbar, IonTitle, IonContent,
  IonSpinner, IonBadge, IonButton, IonIcon,
  IonRefresher, IonRefresherContent,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { alertCircleOutline } from 'ionicons/icons';
import { RouterLink } from '@angular/router';
import { DashboardStore } from '../../dashboard/stores/dashboard.store';
import { IncomeSummaryCardComponent } from './components/income-summary-card.component';
import { ExpenseSummaryCardComponent } from './components/expense-summary-card.component';
import { SavingsCardComponent } from './components/savings-card.component';
import { SettlementCardComponent } from './components/settlement-card.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent,
    IonSpinner, IonBadge, IonButton, IonIcon,
    IonRefresher, IonRefresherContent,
    RouterLink,
    IncomeSummaryCardComponent, ExpenseSummaryCardComponent,
    SavingsCardComponent, SettlementCardComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Dashboard</ion-title>
        @if (store.pendingApprovalsCount() > 0) {
          <ion-button slot="end" fill="clear" routerLink="/tabs/approvals">
            <ion-icon name="alert-circle-outline" slot="icon-only"></ion-icon>
            <ion-badge color="warning">{{ store.pendingApprovalsCount() }}</ion-badge>
          </ion-button>
        }
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <ion-refresher slot="fixed" (ionRefresh)="onRefresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      @if (store.loading()) {
        <div class="spinner-container">
          <ion-spinner name="crescent"></ion-spinner>
        </div>
      } @else if (store.overview(); as ov) {
        <p class="month-label">{{ monthLabel() }}</p>

        <app-income-summary-card [members]="ov.income" [totalCurrent]="ov.totalCurrentIncome" />
        <app-expense-summary-card
          [personalExpenses]="ov.expenses.personalExpenses"
          [sharedTotal]="ov.expenses.sharedExpensesTotal"
          [grandTotal]="ov.expenses.totalHouseholdExpenses" />
        <app-savings-card [members]="ov.savings.members" />
        <app-settlement-card [settlement]="ov.settlement" (markPaid)="onMarkPaid()" />
      }
    </ion-content>
  `,
  styles: [`
    .spinner-container { display: flex; justify-content: center; padding: 48px 0; }
    .month-label { text-align: center; font-size: 14px; color: var(--ion-color-medium); margin: 0 0 8px; }
  `],
})
export class DashboardPage implements OnInit {
  readonly store = inject(DashboardStore);

  readonly monthLabel = computed(() => {
    const ov = this.store.overview();
    if (!ov) return '';
    return new Date(ov.year, ov.month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  });

  constructor() {
    addIcons({ alertCircleOutline });
  }

  ngOnInit(): void {
    this.store.loadAll();
  }

  onMarkPaid(): void {
    this.store.markPaid();
  }

  onRefresh(event: CustomEvent): void {
    const refresher = event.target as HTMLIonRefresherElement;
    this.store.loadAll(() => refresher.complete());
  }
}
