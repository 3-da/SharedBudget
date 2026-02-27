import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonSpinner,
  IonSegment, IonSegmentButton, IonLabel, IonButton, IonIcon, IonFab, IonFabButton,
  IonRefresher, IonRefresherContent, IonText,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { addOutline, chevronBackOutline, chevronForwardOutline } from 'ionicons/icons';
import { Router } from '@angular/router';
import { PersonalExpenseStore } from '../../personal-expenses/stores/personal-expense.store';
import { SharedExpenseStore } from '../../shared-expenses/stores/shared-expense.store';
import { ApprovalStore } from '../../approvals/stores/approval.store';
import { ConfirmAlertService } from '../../../core/services/confirm-alert.service';
import { ExpenseCardComponent } from './components/expense-card.component';
import { CurrencyEurPipe } from '../../../shared/pipes/currency-eur.pipe';

@Component({
  selector: 'app-expenses',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent, IonSpinner,
    IonSegment, IonSegmentButton, IonLabel, IonButton, IonIcon, IonFab, IonFabButton,
    IonRefresher, IonRefresherContent, IonText,
    ExpenseCardComponent, CurrencyEurPipe,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Expenses</ion-title>
      </ion-toolbar>
      <ion-toolbar>
        <ion-segment [value]="tab" (ionChange)="tab = $any($event).detail.value; load()">
          <ion-segment-button value="personal">
            <ion-label>Personal</ion-label>
          </ion-segment-button>
          <ion-segment-button value="shared">
            <ion-label>Shared</ion-label>
          </ion-segment-button>
        </ion-segment>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <ion-refresher slot="fixed" (ionRefresh)="onRefresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <!-- Month picker -->
      <div class="month-picker">
        <ion-button fill="clear" size="small" (click)="prevMonth()">
          <ion-icon name="chevron-back-outline" slot="icon-only"></ion-icon>
        </ion-button>
        <span class="month-label">{{ monthLabel() }}</span>
        <ion-button fill="clear" size="small" (click)="nextMonth()">
          <ion-icon name="chevron-forward-outline" slot="icon-only"></ion-icon>
        </ion-button>
      </div>

      @if (tab === 'personal') {
        @if (personalStore.expenses().length > 0) {
          <div class="budget-bar">
            <span>Remaining: <strong>{{ personalStore.remainingBudget() | currencyEur }}</strong></span>
            <ion-text color="medium">
              <span>Paid: {{ personalStore.paidTotal() | currencyEur }} / {{ personalStore.totalMonthly() | currencyEur }}</span>
            </ion-text>
          </div>
        }

        @if (personalStore.loading()) {
          <div class="spinner-container"><ion-spinner name="crescent"></ion-spinner></div>
        } @else if (personalStore.expenses().length === 0) {
          <div class="empty-state">
            <h3>No Personal Expenses</h3>
            <ion-text color="medium"><p>Add your first expense to start tracking.</p></ion-text>
          </div>
        } @else {
          @for (e of personalStore.expenses(); track e.id) {
            <app-expense-card
              [expense]="e"
              [paymentStatus]="personalStore.paymentStatuses().get(e.id) ?? null"
              (edit)="onEditPersonal($event)"
              (remove)="onDeletePersonal($event)"
              (markPaid)="personalStore.markPaid($event, month(), year())"
              (undoPaid)="personalStore.undoPaid($event, month(), year())"
 />
          }
        }
      } @else {
        @if (sharedStore.error()) {
          <div class="error-banner">{{ sharedStore.error() }}</div>
        }

        @if (sharedStore.loading()) {
          <div class="spinner-container"><ion-spinner name="crescent"></ion-spinner></div>
        } @else if (sharedStore.expenses().length === 0) {
          <div class="empty-state">
            <h3>No Shared Expenses</h3>
            <ion-text color="medium"><p>Propose a shared expense for the household.</p></ion-text>
          </div>
        } @else {
          @for (e of sharedStore.expenses(); track e.id) {
            <app-expense-card
              [expense]="e"
              [isShared]="true"
              [hasPendingApproval]="approvalStore.pendingExpenseIds().has(e.id)"
              [paymentStatus]="sharedStore.paymentStatuses().get(e.id) ?? null"
              (edit)="onEditShared($event)"
              (remove)="onDeleteShared($event)"
              (markPaid)="sharedStore.markPaid($event, month(), year())"
              (undoPaid)="sharedStore.undoPaid($event, month(), year())"
 />
          }
        }
      }

      <ion-fab slot="fixed" vertical="bottom" horizontal="end">
        <ion-fab-button (click)="onAdd()">
          <ion-icon name="add-outline"></ion-icon>
        </ion-fab-button>
      </ion-fab>
    </ion-content>
  `,
  styles: [`
    .spinner-container { display: flex; justify-content: center; padding: 48px 0; }
    .empty-state { text-align: center; padding: 48px 16px; }
    .month-picker { display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 8px; }
    .month-label { font-weight: 500; }
    .budget-bar {
      display: flex; justify-content: space-between; align-items: center;
      padding: 8px 12px; margin-bottom: 8px; border-radius: 8px;
      background: var(--ion-color-light);
    }
    .error-banner {
      padding: 8px 12px; margin-bottom: 8px; border-radius: 8px;
      background: color-mix(in srgb, var(--ion-color-danger) 10%, transparent);
      color: var(--ion-color-danger);
    }
  `],
})
export class ExpensesPage implements OnInit {
  readonly personalStore = inject(PersonalExpenseStore);
  readonly sharedStore = inject(SharedExpenseStore);
  readonly approvalStore = inject(ApprovalStore);
  private readonly router = inject(Router);
  private readonly confirmAlert = inject(ConfirmAlertService);

  tab: 'personal' | 'shared' = 'personal';
  readonly month = signal(new Date().getMonth() + 1);
  readonly year = signal(new Date().getFullYear());

  readonly monthLabel = computed(() =>
    new Date(this.year(), this.month() - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  );

  constructor() {
    addIcons({ addOutline, chevronBackOutline, chevronForwardOutline });
  }

  ngOnInit(): void {
    this.load();
    this.approvalStore.loadPending();
  }

  load(): void {
    this.loadWithCallback();
  }

  private loadWithCallback(onFinish?: () => void): void {
    if (this.tab === 'personal') {
      this.personalStore.loadExpenses(this.month(), this.year(), onFinish);
    } else {
      this.sharedStore.loadExpenses(this.month(), this.year(), onFinish);
    }
  }

  prevMonth(): void {
    if (this.month() === 1) { this.month.set(12); this.year.update(y => y - 1); }
    else this.month.update(m => m - 1);
    this.load();
  }

  nextMonth(): void {
    if (this.month() === 12) { this.month.set(1); this.year.update(y => y + 1); }
    else this.month.update(m => m + 1);
    this.load();
  }

  onRefresh(event: CustomEvent): void {
    const refresher = event.target as HTMLIonRefresherElement;
    this.loadWithCallback(() => refresher.complete());
  }

  onAdd(): void {
    if (this.tab === 'personal') this.router.navigate(['/tabs/expenses/personal/new']);
    else this.router.navigate(['/tabs/expenses/shared/new']);
  }

  onEditPersonal(id: string): void { this.router.navigate(['/tabs/expenses/personal', id, 'edit']); }
  onEditShared(id: string): void { this.router.navigate(['/tabs/expenses/shared', id, 'edit']); }
  async onDeletePersonal(id: string): Promise<void> {
    const ok = await this.confirmAlert.confirm({
      header: 'Delete Expense', message: 'Delete this expense permanently?',
      confirmText: 'Delete', confirmColor: 'danger',
    });
    if (ok) this.personalStore.deleteExpense(id, this.month(), this.year());
  }

  async onDeleteShared(id: string): Promise<void> {
    const ok = await this.confirmAlert.confirm({
      header: 'Propose Deletion', message: 'This will submit a deletion proposal for approval. Continue?',
      confirmText: 'Propose Delete', confirmColor: 'danger',
    });
    if (ok) this.sharedStore.proposeDelete(id, this.month(), this.year());
  }
}
