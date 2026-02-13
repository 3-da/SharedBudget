import { Component, inject, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { SavingStore } from '../stores/saving.store';
import { HouseholdStore } from '../../household/stores/household.store';
import { SavingsHistoryChartComponent } from '../components/savings-history-chart.component';
import { MonthPickerComponent } from '../../../shared/components/month-picker.component';
import { PageHeaderComponent } from '../../../shared/components/page-header.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner.component';
import { CurrencyEurPipe } from '../../../shared/pipes/currency-eur.pipe';

@Component({
  selector: 'app-savings-overview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatCardModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule, ReactiveFormsModule, MonthPickerComponent, SavingsHistoryChartComponent, PageHeaderComponent, LoadingSpinnerComponent, CurrencyEurPipe],
  template: `
    <app-page-header title="Savings" subtitle="Manage your personal and shared savings">
      <app-month-picker
        [selectedMonth]="month()"
        [selectedYear]="year()"
        (monthChange)="onMonthChange($event)" />
    </app-page-header>

    @if (store.loading()) {
      <app-loading-spinner />
    } @else {
      <div class="savings-layout">
        <mat-card>
          <mat-card-header>
            <mat-icon matCardAvatar>savings</mat-icon>
            <mat-card-title>Personal Savings</mat-card-title>
            <mat-card-subtitle>Your individual savings this month</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <div class="current-amount">{{ store.totalPersonal() | currencyEur }}</div>
            <form [formGroup]="personalForm" (ngSubmit)="savePersonal()">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Amount (EUR)</mat-label>
                <input matInput type="number" formControlName="amount" min="0">
              </mat-form-field>
              <button mat-flat-button type="submit" [disabled]="personalForm.invalid">Update</button>
            </form>
          </mat-card-content>
        </mat-card>

        <mat-card>
          <mat-card-header>
            <mat-icon matCardAvatar>group</mat-icon>
            <mat-card-title>Shared Savings</mat-card-title>
            <mat-card-subtitle>Joint household savings this month</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <div class="current-amount">{{ store.totalShared() | currencyEur }}</div>
            <form [formGroup]="sharedForm" (ngSubmit)="saveShared()">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Amount (EUR)</mat-label>
                <input matInput type="number" formControlName="amount" min="0">
              </mat-form-field>
              <button mat-flat-button type="submit" [disabled]="sharedForm.invalid">Update</button>
            </form>
          </mat-card-content>
        </mat-card>

        <mat-card class="summary-card">
          <mat-card-header>
            <mat-icon matCardAvatar>account_balance</mat-icon>
            <mat-card-title>Household Total</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="current-amount large">{{ store.totalHousehold() | currencyEur }}</div>
          </mat-card-content>
        </mat-card>

        @if (householdStore.overview(); as ov) {
          <mat-card class="summary-card">
            <mat-card-header>
              <mat-icon matCardAvatar>people</mat-icon>
              <mat-card-title>Per-Member Breakdown</mat-card-title>
              <mat-card-subtitle>Shared savings by household member</mat-card-subtitle>
            </mat-card-header>
            <mat-card-content>
              @for (member of ov.savings.members; track member.userId) {
                <div class="member-row">
                  <span class="member-name">{{ member.firstName }} {{ member.lastName }}</span>
                  <div class="member-amounts">
                    <span class="amount-label">Personal: {{ member.personalSavings | currencyEur }}</span>
                    <span class="amount-label">Shared: {{ member.sharedSavings | currencyEur }}</span>
                  </div>
                </div>
              }
            </mat-card-content>
          </mat-card>
        }

        <app-savings-history-chart class="summary-card" [items]="store.savingsHistory()" />
      </div>
    }
  `,
  styles: [`
    .savings-layout { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-md); max-width: 900px; margin: 0 auto; }
    .summary-card { grid-column: 1 / -1; }
    .current-amount { font-size: clamp(1.4rem, 2vw + 0.5rem, 1.8rem); font-weight: 500; margin-bottom: var(--space-sm); }
    .current-amount.large { font-size: clamp(1.6rem, 3vw + 0.5rem, 2.2rem); text-align: center; }
    .full-width { width: 100%; }
    form { display: flex; gap: var(--space-sm); align-items: start; }
    mat-icon[matCardAvatar] {
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
      border-radius: 50%; width: 40px; height: 40px;
      display: flex; align-items: center; justify-content: center; font-size: 24px;
    }
    .member-row {
      display: flex; justify-content: space-between; align-items: center;
      padding: 8px 0; border-bottom: 1px solid var(--mat-sys-outline-variant);
    }
    .member-row:last-child { border-bottom: none; }
    .member-name { font-weight: 500; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
    .member-amounts { display: flex; gap: 16px; flex-shrink: 0; }
    .amount-label { color: var(--mat-sys-on-surface-variant); font-size: 0.875rem; white-space: nowrap; }
    @media (max-width: 768px) {
      .savings-layout { grid-template-columns: 1fr; }
      .current-amount { font-size: 1.4rem; }
      .current-amount.large { font-size: 1.6rem; }
      .member-row { flex-direction: column; align-items: flex-start; gap: 4px; }
      .member-amounts { gap: 12px; }
      .amount-label { font-size: 0.8rem; }
      mat-icon[matCardAvatar] { width: 32px; height: 32px; font-size: 20px; }
    }
  `],
})
export class SavingsOverviewComponent implements OnInit {
  readonly store = inject(SavingStore);
  readonly householdStore = inject(HouseholdStore);
  private readonly fb = inject(FormBuilder);

  readonly month = signal(new Date().getMonth() + 1);
  readonly year = signal(new Date().getFullYear());

  personalForm = this.fb.nonNullable.group({ amount: [0, [Validators.required, Validators.min(0)]] });
  sharedForm = this.fb.nonNullable.group({ amount: [0, [Validators.required, Validators.min(0)]] });

  ngOnInit(): void {
    this.load();
    this.store.loadSavingsHistory();
    if (!this.householdStore.overview()) {
      this.householdStore.loadOverview();
    }
  }

  onMonthChange(event: { month: number; year: number }): void {
    this.month.set(event.month);
    this.year.set(event.year);
    this.load();
    this.householdStore.setMonth(event.month, event.year);
  }

  savePersonal(): void {
    if (this.personalForm.invalid) return;
    this.store.upsertPersonal(
      { amount: this.personalForm.getRawValue().amount, month: this.month(), year: this.year() },
      () => this.householdStore.loadOverview(),
    );
  }

  saveShared(): void {
    if (this.sharedForm.invalid) return;
    this.store.upsertShared(
      { amount: this.sharedForm.getRawValue().amount, month: this.month(), year: this.year() },
      () => this.householdStore.loadOverview(),
    );
  }

  private load(): void {
    this.store.loadMySavings(this.month(), this.year());
    this.store.loadHouseholdSavings(this.month(), this.year());
  }
}
