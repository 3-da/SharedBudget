import { Component, inject, OnInit } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { SavingStore } from '../stores/saving.store';
import { PageHeaderComponent } from '../../../shared/components/page-header.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner.component';
import { CurrencyEurPipe } from '../../../shared/pipes/currency-eur.pipe';

@Component({
  selector: 'app-savings-overview',
  standalone: true,
  imports: [MatCardModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule, ReactiveFormsModule, PageHeaderComponent, LoadingSpinnerComponent, CurrencyEurPipe],
  template: `
    <app-page-header title="Savings" subtitle="Manage your personal and shared savings" />

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
      </div>
    }
  `,
  styles: [`
    .savings-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; max-width: 900px; margin: 0 auto; }
    .summary-card { grid-column: 1 / -1; }
    .current-amount { font-size: 1.8rem; font-weight: 500; margin-bottom: 16px; }
    .current-amount.large { font-size: 2.4rem; text-align: center; }
    .full-width { width: 100%; }
    form { display: flex; gap: 8px; align-items: start; }
    mat-icon[matCardAvatar] {
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
      border-radius: 50%; width: 40px; height: 40px;
      display: flex; align-items: center; justify-content: center; font-size: 24px;
    }
    @media (max-width: 768px) { .savings-layout { grid-template-columns: 1fr; } }
  `],
})
export class SavingsOverviewComponent implements OnInit {
  readonly store = inject(SavingStore);
  private readonly fb = inject(FormBuilder);

  personalForm = this.fb.nonNullable.group({ amount: [0, [Validators.required, Validators.min(0)]] });
  sharedForm = this.fb.nonNullable.group({ amount: [0, [Validators.required, Validators.min(0)]] });

  ngOnInit(): void {
    this.store.loadMySavings();
    this.store.loadHouseholdSavings();
  }

  savePersonal(): void {
    if (this.personalForm.invalid) return;
    this.store.upsertPersonal({ amount: this.personalForm.getRawValue().amount });
  }

  saveShared(): void {
    if (this.sharedForm.invalid) return;
    this.store.upsertShared({ amount: this.sharedForm.getRawValue().amount });
  }
}
