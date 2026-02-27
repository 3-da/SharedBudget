import { ChangeDetectionStrategy, Component, inject, OnInit, signal, effect } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
  IonCard, IonCardHeader, IonCardTitle, IonCardContent,
  IonItem, IonInput, IonButton, IonSpinner, IonIcon, IonNote,
  IonRefresher, IonRefresherContent,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chevronBackOutline, chevronForwardOutline } from 'ionicons/icons';
import { SalaryStore } from '../../../salary/stores/salary.store';
import { CurrencyEurPipe } from '../../../../shared/pipes/currency-eur.pipe';

@Component({
  selector: 'app-salary',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
    IonCard, IonCardHeader, IonCardTitle, IonCardContent,
    IonItem, IonInput, IonButton, IonSpinner, IonIcon, IonNote,
    IonRefresher, IonRefresherContent,
    CurrencyEurPipe,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/tabs/more" />
        </ion-buttons>
        <ion-title>Salary</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <ion-refresher slot="fixed" (ionRefresh)="onRefresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      @if (store.loading()) {
        <div class="center-spinner"><ion-spinner name="crescent" /></div>
      } @else {
        <ion-card>
          <ion-card-header>
            <ion-card-title>My Salary</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <form [formGroup]="form" (ngSubmit)="onSave()">
              <ion-item>
                <ion-input
                  label="Default Salary (EUR)"
                  labelPlacement="floating"
                  type="number"
                  formControlName="defaultAmount"
                  min="0" />
              </ion-item>
              <ion-item>
                <ion-input
                  label="Current Salary (EUR)"
                  labelPlacement="floating"
                  type="number"
                  formControlName="currentAmount"
                  min="0" />
              </ion-item>
              <ion-button expand="block" type="submit" [disabled]="form.invalid" class="ion-margin-top">
                Save Salary
              </ion-button>
            </form>
          </ion-card-content>
        </ion-card>

        <ion-card>
          <ion-card-header>
            <ion-card-title>
              <div class="year-nav">
                <ion-button fill="clear" size="small" (click)="prevYear()">
                  <ion-icon name="chevron-back-outline" />
                </ion-button>
                <span>{{ currentYear() }}</span>
                <ion-button fill="clear" size="small" (click)="nextYear()">
                  <ion-icon name="chevron-forward-outline" />
                </ion-button>
              </div>
            </ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <div class="stats-row">
              <div class="stat">
                <span class="stat-label">Yearly Total</span>
                <strong>{{ store.yearlyTotal() | currencyEur }}</strong>
              </div>
              <div class="stat">
                <span class="stat-label">Monthly Avg</span>
                <strong>{{ store.yearlyAverage() | currencyEur }}</strong>
              </div>
            </div>
            @if (store.yearlySalaries().length === 0) {
              <ion-note>No salary data for {{ currentYear() }}</ion-note>
            } @else {
              @for (s of store.yearlySalaries(); track s.id) {
                <div class="month-row">
                  <span>{{ monthName(s.month) }}</span>
                  <strong>{{ s.currentAmount | currencyEur }}</strong>
                </div>
              }
            }
          </ion-card-content>
        </ion-card>
      }
    </ion-content>
  `,
  styles: [`
    .center-spinner { display: flex; justify-content: center; padding: 48px 0; }
    .year-nav { display: flex; align-items: center; justify-content: center; gap: 8px; }
    .stats-row { display: flex; gap: 24px; margin-bottom: 16px; }
    .stat { display: flex; flex-direction: column; }
    .stat-label { font-size: 0.85rem; color: var(--ion-color-medium); }
    .month-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--ion-color-light); }
    .month-row:last-child { border-bottom: none; }
  `],
})
export class SalaryPage implements OnInit {
  readonly store = inject(SalaryStore);
  readonly currentYear = signal(new Date().getFullYear());
  private readonly fb = inject(FormBuilder);

  form = this.fb.nonNullable.group({
    defaultAmount: [0, [Validators.required, Validators.min(0)]],
    currentAmount: [0, [Validators.required, Validators.min(0)]],
  });

  constructor() {
    addIcons({ chevronBackOutline, chevronForwardOutline });
    effect(() => {
      const s = this.store.mySalary();
      if (s) this.form.patchValue({ defaultAmount: s.defaultAmount, currentAmount: s.currentAmount });
    });
  }

  ngOnInit(): void {
    this.store.loadMySalary();
    this.store.loadYearlySalaries(this.currentYear());
  }

  prevYear(): void {
    this.currentYear.update(y => y - 1);
    this.store.loadYearlySalaries(this.currentYear());
  }

  nextYear(): void {
    this.currentYear.update(y => y + 1);
    this.store.loadYearlySalaries(this.currentYear());
  }

  onSave(): void {
    if (this.form.invalid) return;
    this.store.upsert(this.form.getRawValue());
  }

  monthName(month: number): string {
    return new Date(2000, month - 1).toLocaleDateString('en-US', { month: 'long' });
  }

  onRefresh(event: CustomEvent): void {
    const refresher = event.target as HTMLIonRefresherElement;
    let remaining = 2;
    const done = () => { if (--remaining === 0) refresher.complete(); };
    this.store.loadMySalary(done);
    this.store.loadYearlySalaries(this.currentYear(), done);
  }
}
