import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
  IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonCardSubtitle,
  IonItem, IonInput, IonButton, IonSpinner, IonIcon,
  IonRefresher, IonRefresherContent,
  ModalController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chevronBackOutline, chevronForwardOutline, informationCircleOutline } from 'ionicons/icons';
import { SavingStore } from '../../../savings/stores/saving.store';
import { HouseholdStore } from '../../../household/stores/household.store';
import { CurrencyEurPipe } from '../../../../shared/pipes/currency-eur.pipe';
import { WithdrawModalComponent } from './withdraw-modal.component';

@Component({
  selector: 'app-savings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
    IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonCardSubtitle,
    IonItem, IonInput, IonButton, IonSpinner, IonIcon,
    IonRefresher, IonRefresherContent,
    CurrencyEurPipe,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/tabs/more" />
        </ion-buttons>
        <ion-title>Savings</ion-title>
      </ion-toolbar>
      <ion-toolbar>
        <div class="month-nav">
          <ion-button fill="clear" size="small" (click)="prevMonth()">
            <ion-icon name="chevron-back-outline" />
          </ion-button>
          <span>{{ month() }}/{{ year() }}</span>
          <ion-button fill="clear" size="small" (click)="nextMonth()">
            <ion-icon name="chevron-forward-outline" />
          </ion-button>
        </div>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <ion-refresher slot="fixed" (ionRefresh)="onRefresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      @if (store.loading()) {
        <div class="center-spinner"><ion-spinner name="crescent" /></div>
      } @else {
        <!-- Personal Savings -->
        <ion-card>
          <ion-card-header>
            <ion-card-title>Personal Savings</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <div class="current-amount">{{ store.totalPersonal() | currencyEur }}</div>
            <form [formGroup]="personalForm" (ngSubmit)="addPersonal()">
              <ion-item>
                <ion-input label="Amount (EUR)" labelPlacement="floating" type="number" formControlName="amount" min="0.01" />
              </ion-item>
              <div class="form-actions">
                <ion-button type="submit" size="small" [disabled]="personalForm.invalid">Add</ion-button>
                @if (store.totalPersonal() > 0) {
                  <ion-button color="warning" size="small" fill="outline" (click)="withdrawPersonal()">Withdraw</ion-button>
                }
              </div>
            </form>
          </ion-card-content>
        </ion-card>

        <!-- Shared Savings -->
        <ion-card>
          <ion-card-header>
            <ion-card-title>Shared Savings</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <div class="savings-amounts">
              <div class="amount-block">
                <span class="amount-label">Your contribution</span>
                <div class="current-amount">{{ store.totalShared() | currencyEur }}</div>
              </div>
              <div class="amount-block">
                <span class="amount-label">Household pool</span>
                <div class="current-amount pool">{{ store.totalHouseholdShared() | currencyEur }}</div>
              </div>
              <div class="amount-block">
                <span class="amount-label">Household total</span>
                <div class="current-amount">{{ store.totalHousehold() | currencyEur }}</div>
              </div>
            </div>
            <form [formGroup]="sharedForm" (ngSubmit)="addShared()">
              <ion-item>
                <ion-input label="Amount (EUR)" labelPlacement="floating" type="number" formControlName="amount" min="0.01" />
              </ion-item>
              <div class="form-actions">
                <ion-button type="submit" size="small" [disabled]="sharedForm.invalid">Add</ion-button>
                @if (store.totalHouseholdShared() > 0) {
                  <ion-button color="warning" size="small" fill="outline" (click)="withdrawShared()">Withdraw</ion-button>
                }
              </div>
            </form>
          </ion-card-content>
        </ion-card>

        <!-- Per-Member Breakdown -->
        @if (householdStore.overview(); as ov) {
          <ion-card>
            <ion-card-header>
              <ion-card-title>Per-Member Breakdown</ion-card-title>
              <ion-card-subtitle>Shared savings by household member</ion-card-subtitle>
            </ion-card-header>
            <ion-card-content>
              @for (member of ov.savings.members; track member.userId) {
                <div class="member-row">
                  <span class="member-name">{{ member.firstName }} {{ member.lastName }}</span>
                  <div class="member-amounts">
                    <span class="amount-label">Personal: {{ member.personalSavings | currencyEur }}</span>
                    <span class="amount-label">Shared: {{ member.sharedSavings | currencyEur }}</span>
                  </div>
                </div>
              }
            </ion-card-content>
          </ion-card>
        }
      }
    </ion-content>
  `,
  styles: [`
    .center-spinner { display: flex; justify-content: center; padding: 48px 0; }
    .month-nav { display: flex; align-items: center; justify-content: center; gap: 8px; }
    .current-amount { font-size: 1.2rem; font-weight: 500; margin-bottom: 8px; }
    .current-amount.pool { color: var(--ion-color-primary); }
    .savings-amounts { display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 8px; }
    .amount-block { display: flex; flex-direction: column; }
    .amount-label { font-size: 0.85rem; color: var(--ion-color-medium); }
    .form-actions { display: flex; gap: 8px; margin-top: 12px; }
    .member-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--ion-color-light); }
    .member-row:last-child { border-bottom: none; }
    .member-name { font-weight: 500; }
    .member-amounts { display: flex; gap: 12px; flex-shrink: 0; }
  `],
})
export class SavingsPage implements OnInit {
  readonly store = inject(SavingStore);
  readonly householdStore = inject(HouseholdStore);
  private readonly fb = inject(FormBuilder);
  private readonly modalCtrl = inject(ModalController);
  readonly month = signal(new Date().getMonth() + 1);
  readonly year = signal(new Date().getFullYear());

  personalForm = this.fb.group({ amount: [null as number | null, [Validators.required, Validators.min(0.01)]] });
  sharedForm = this.fb.group({ amount: [null as number | null, [Validators.required, Validators.min(0.01)]] });

  constructor() {
    addIcons({ chevronBackOutline, chevronForwardOutline, informationCircleOutline });
  }

  ngOnInit(): void {
    this.load();
    this.store.loadSavingsHistory();
    if (!this.householdStore.overview()) this.householdStore.loadOverview();
  }

  prevMonth(): void {
    if (this.month() === 1) { this.month.set(12); this.year.update(y => y - 1); }
    else { this.month.update(m => m - 1); }
    this.load();
    this.householdStore.setMonth(this.month(), this.year());
  }

  nextMonth(): void {
    if (this.month() === 12) { this.month.set(1); this.year.update(y => y + 1); }
    else { this.month.update(m => m + 1); }
    this.load();
    this.householdStore.setMonth(this.month(), this.year());
  }

  addPersonal(): void {
    if (this.personalForm.invalid) return;
    this.store.addPersonal(
      { amount: this.personalForm.getRawValue().amount!, month: this.month(), year: this.year() },
      () => { this.personalForm.reset(); this.householdStore.loadOverview(); },
    );
  }

  addShared(): void {
    if (this.sharedForm.invalid) return;
    this.store.addShared(
      { amount: this.sharedForm.getRawValue().amount!, month: this.month(), year: this.year() },
      () => { this.sharedForm.reset(); this.householdStore.loadOverview(); },
    );
  }

  async withdrawPersonal(): Promise<void> {
    const amount = await this.openWithdrawModal('Withdraw Personal Savings', this.store.totalPersonal());
    if (amount != null && amount > 0) {
      this.store.withdrawPersonal(
        { amount, month: this.month(), year: this.year() },
        () => this.householdStore.loadOverview(),
      );
    }
  }

  async withdrawShared(): Promise<void> {
    const amount = await this.openWithdrawModal('Withdraw from Shared Pool', this.store.totalHouseholdShared(), true);
    if (amount != null && amount > 0) {
      this.store.withdrawShared(
        { amount, month: this.month(), year: this.year() },
        () => this.householdStore.loadOverview(),
      );
    }
  }

  onRefresh(event: CustomEvent): void {
    const refresher = event.target as HTMLIonRefresherElement;
    let remaining = 3;
    const done = () => { if (--remaining === 0) refresher.complete(); };
    this.store.loadMySavings(this.month(), this.year(), done);
    this.store.loadHouseholdSavings(this.month(), this.year(), done);
    this.householdStore.loadOverview(done);
  }

  private load(): void {
    this.store.loadMySavings(this.month(), this.year());
    this.store.loadHouseholdSavings(this.month(), this.year());
  }

  private async openWithdrawModal(title: string, currentAmount: number, requiresApproval = false): Promise<number | null> {
    const modal = await this.modalCtrl.create({
      component: WithdrawModalComponent,
      componentProps: { title, currentAmount, requiresApproval },
    });
    await modal.present();
    const { data, role } = await modal.onWillDismiss();
    return role === 'confirm' ? data : null;
  }
}
