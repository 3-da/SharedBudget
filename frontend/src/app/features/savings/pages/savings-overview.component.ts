import {ChangeDetectionStrategy, Component, inject, OnInit, signal, viewChildren} from '@angular/core';
import {MatCardModule} from '@angular/material/card';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {FormBuilder, FormGroupDirective, ReactiveFormsModule, Validators} from '@angular/forms';
import {MatDialog} from '@angular/material/dialog';
import {filter} from 'rxjs';
import {SavingStore} from '../stores/saving.store';
import {HouseholdStore} from '../../household/stores/household.store';
import {SavingsHistoryChartComponent} from '../components/savings-history-chart.component';
import {WithdrawDialogComponent, WithdrawDialogData} from '../components/withdraw-dialog.component';
import {MonthPickerComponent} from '../../../shared/components/month-picker.component';
import {PageHeaderComponent} from '../../../shared/components/page-header.component';
import {LoadingSpinnerComponent} from '../../../shared/components/loading-spinner.component';
import {CurrencyEurPipe} from '../../../shared/pipes/currency-eur.pipe';

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
            <mat-card-title>Personal Savings</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="current-amount">{{ store.totalPersonal() | currencyEur }}</div>
            <form class="inline-form" [formGroup]="personalForm" (ngSubmit)="addPersonal()">
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Amount (EUR)</mat-label>
                <input matInput type="number" formControlName="amount" min="0.01">
              </mat-form-field>
              <button mat-flat-button type="submit" [disabled]="personalForm.invalid">Add</button>
              @if (store.totalPersonal() > 0) {
                <button mat-stroked-button type="button" color="warn" (click)="withdrawPersonal()">Withdraw</button>
              }
            </form>
          </mat-card-content>
        </mat-card>

        <mat-card>
          <mat-card-header>
            <mat-card-title>Shared Savings</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="savings-amounts">
              <div>
                <div class="amount-label">Your contribution</div>
                <div class="current-amount">{{ store.totalShared() | currencyEur }}</div>
              </div>
              <div>
                <div class="amount-label">Household pool</div>
                <div class="current-amount pool-amount">{{ store.totalHouseholdShared() | currencyEur }}</div>
              </div>
              <div>
                <div class="amount-label">Household total</div>
                <div class="current-amount">{{ store.totalHousehold() | currencyEur }}</div>
              </div>
            </div>
            <form class="inline-form" [formGroup]="sharedForm" (ngSubmit)="addShared()">
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Amount (EUR)</mat-label>
                <input matInput type="number" formControlName="amount" min="0.01">
              </mat-form-field>
              <button mat-flat-button type="submit" [disabled]="sharedForm.invalid">Add</button>
              @if (store.totalHouseholdShared() > 0) {
                <button mat-stroked-button type="button" color="warn" (click)="withdrawShared()">Withdraw</button>
              }
            </form>
          </mat-card-content>
        </mat-card>

        @if (householdStore.overview(); as ov) {
          <mat-card class="breakdown-card">
            <mat-card-header>
              <mat-icon matCardAvatar aria-hidden="true">people</mat-icon>
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
    /* Ensure cards stretch and their content is spaced so forms align at the bottom */
    .savings-layout { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-md); max-width: 900px; margin: 0 auto; }
    .savings-layout mat-card { display: flex; flex-direction: column; height: 100%; }
    .savings-layout mat-card > mat-card-content { flex: 1 1 auto; display: flex; flex-direction: column; justify-content: space-between; }

    .summary-card { grid-column: 1 / -1; }
    .breakdown-card { grid-column: 1; }
    .current-amount { font-size: 1.2rem; font-weight: 500; margin-bottom: var(--space-sm); }
    .inline-form { display: flex; align-items: center; gap: 8px; }
    .inline-form mat-form-field { flex: 1; min-width: 120px; }
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
    .savings-amounts { display: flex; flex-wrap: wrap; gap: var(--space-md) var(--space-lg); margin-bottom: var(--space-sm); }
    .pool-amount { color: var(--mat-sys-primary); }
    @media (max-width: 768px) {
      .savings-layout { grid-template-columns: 1fr; }
      .breakdown-card { grid-column: 1; }
      .inline-form { flex-wrap: wrap; align-items: center; }
      .inline-form mat-form-field { flex-basis: 100%; }
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
  readonly month = signal(new Date().getMonth() + 1);
  readonly year = signal(new Date().getFullYear());
  private readonly fb = inject(FormBuilder);
  personalForm = this.fb.group({ amount: [null as number | null, [Validators.required, Validators.min(0.01)]] });
  sharedForm = this.fb.group({ amount: [null as number | null, [Validators.required, Validators.min(0.01)]] });
  private readonly dialog = inject(MatDialog);
  private readonly formDirs = viewChildren(FormGroupDirective);

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

  addPersonal(): void {
    if (this.personalForm.invalid) return;
    this.store.addPersonal(
      { amount: this.personalForm.getRawValue().amount!, month: this.month(), year: this.year() },
      () => { this.resetForm(this.personalForm); this.householdStore.loadOverview(); },
    );
  }

  addShared(): void {
    if (this.sharedForm.invalid) return;
    this.store.addShared(
      { amount: this.sharedForm.getRawValue().amount!, month: this.month(), year: this.year() },
      () => { this.resetForm(this.sharedForm); this.householdStore.loadOverview(); },
    );
  }

  withdrawPersonal(): void {
    const current = this.store.totalPersonal();
    this.dialog.open<WithdrawDialogComponent, WithdrawDialogData, number | null>(WithdrawDialogComponent, {
      data: { title: 'Withdraw Personal Savings', currentAmount: current },
    }).afterClosed().pipe(filter(amount => amount != null && amount > 0)).subscribe(amount => {
      this.store.withdrawPersonal(
        { amount: amount!, month: this.month(), year: this.year() },
        () => this.householdStore.loadOverview(),
      );
    });
  }

  withdrawShared(): void {
    const poolTotal = this.store.totalHouseholdShared();
    this.dialog.open<WithdrawDialogComponent, WithdrawDialogData, number | null>(WithdrawDialogComponent, {
      data: { title: 'Withdraw from Shared Savings Pool', currentAmount: poolTotal, requiresApproval: true },
    }).afterClosed().pipe(filter(amount => amount != null && amount > 0)).subscribe(amount => {
      this.store.withdrawShared(
        { amount: amount!, month: this.month(), year: this.year() },
        () => this.householdStore.loadOverview(),
      );
    });
  }

  private resetForm(form: typeof this.personalForm): void {
    const dir = this.formDirs().find(d => d.form === form);
    if (dir) {
      dir.resetForm({ amount: null });
    } else {
      form.reset({ amount: null });
    }
  }

  private load(): void {
    this.store.loadMySavings(this.month(), this.year());
    this.store.loadHouseholdSavings(this.month(), this.year());
  }
}
