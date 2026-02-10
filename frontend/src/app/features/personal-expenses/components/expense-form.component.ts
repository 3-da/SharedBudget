import { Component, inject, input, output, effect, computed } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { DecimalPipe } from '@angular/common';
import { Expense, CreateExpenseRequest } from '../../../shared/models/expense.model';
import { HouseholdMember } from '../../../shared/models/household.model';
import { ExpenseCategory, ExpenseFrequency, YearlyPaymentStrategy, InstallmentFrequency } from '../../../shared/models/enums';

@Component({
  selector: 'app-expense-form',
  standalone: true,
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, DecimalPipe],
  template: `
    <form [formGroup]="form" (ngSubmit)="onSubmit()">
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Name</mat-label>
        <input matInput formControlName="name">
        <mat-error>Name is required</mat-error>
      </mat-form-field>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Amount (EUR)</mat-label>
        <input matInput type="number" formControlName="amount" min="0.01" step="0.01">
        <mat-error>Valid positive amount required</mat-error>
      </mat-form-field>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Category</mat-label>
        <mat-select formControlName="category">
          <mat-option value="RECURRING">Recurring</mat-option>
          <mat-option value="ONE_TIME">One-time</mat-option>
        </mat-select>
      </mat-form-field>

      @if (form.get('category')?.value !== 'ONE_TIME') {
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Frequency</mat-label>
          <mat-select formControlName="frequency">
            <mat-option value="MONTHLY">Monthly</mat-option>
            <mat-option value="YEARLY">Yearly</mat-option>
          </mat-select>
        </mat-form-field>
      }

      @if (form.get('category')?.value !== 'ONE_TIME' && form.get('frequency')?.value === 'YEARLY') {
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Yearly Payment Strategy</mat-label>
          <mat-select formControlName="yearlyPaymentStrategy">
            <mat-option value="FULL">Full payment</mat-option>
            <mat-option value="INSTALLMENTS">Installments</mat-option>
          </mat-select>
        </mat-form-field>

        @if (form.get('yearlyPaymentStrategy')?.value === 'INSTALLMENTS') {
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Installment Frequency</mat-label>
            <mat-select formControlName="installmentFrequency">
              <mat-option value="QUARTERLY">Quarterly</mat-option>
              <mat-option value="SEMI_ANNUAL">Semi-annual</mat-option>
            </mat-select>
          </mat-form-field>
        }

        @if (form.get('yearlyPaymentStrategy')?.value === 'FULL') {
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Payment Month</mat-label>
            <mat-select formControlName="paymentMonth">
              @for (m of months; track m.value) {
                <mat-option [value]="m.value">{{ m.label }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        }
      }

      @if (form.get('category')?.value === 'ONE_TIME') {
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Payment Type</mat-label>
          <mat-select formControlName="yearlyPaymentStrategy">
            <mat-option value="FULL">Full payment</mat-option>
            <mat-option value="INSTALLMENTS">Installments</mat-option>
          </mat-select>
        </mat-form-field>

        @if (form.get('yearlyPaymentStrategy')?.value === 'FULL') {
          <div class="row">
            <mat-form-field appearance="outline">
              <mat-label>Expense Month</mat-label>
              <mat-select formControlName="month">
                @for (m of months; track m.value) {
                  <mat-option [value]="m.value">{{ m.label }}</mat-option>
                }
              </mat-select>
              <mat-hint>The month when this expense occurs</mat-hint>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Expense Year</mat-label>
              <input matInput type="number" formControlName="year" min="2020" max="2099">
              <mat-hint>The year when this expense occurs</mat-hint>
            </mat-form-field>
          </div>
        }

        @if (form.get('yearlyPaymentStrategy')?.value === 'INSTALLMENTS') {
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Installment Frequency</mat-label>
            <mat-select formControlName="installmentFrequency">
              <mat-option value="MONTHLY">Monthly</mat-option>
              <mat-option value="QUARTERLY">Quarterly</mat-option>
              <mat-option value="SEMI_ANNUAL">Semi-annual</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Duration (years)</mat-label>
            <input matInput type="number" formControlName="installmentYears" min="1" max="30">
            <mat-hint>
              @if (installmentAmount() > 0) {
                Each installment: {{ installmentAmount() | number:'1.2-2' }} EUR
              }
            </mat-hint>
          </mat-form-field>
        }
      }

      @if (showPaidBy()) {
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Paid By</mat-label>
          <mat-select formControlName="paidByUserId">
            <mat-option [value]="null">Split equally</mat-option>
            @for (m of members(); track m.userId) {
              <mat-option [value]="m.userId">{{ m.firstName }} {{ m.lastName }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      }

      <button mat-flat-button type="submit" class="full-width" [disabled]="loading()">
        {{ expense() ? 'Update' : 'Create' }} Expense
      </button>
    </form>
  `,
  styles: [`
    .full-width { width: 100%; }
    form { display: flex; flex-direction: column; gap: 8px; }
    .row { display: flex; gap: 12px; }
    .row mat-form-field { flex: 1; }
  `],
})
export class ExpenseFormComponent {
  readonly expense = input<Expense | null>(null);
  readonly loading = input(false);
  readonly showPaidBy = input(false);
  readonly members = input<HouseholdMember[]>([]);
  readonly save = output<CreateExpenseRequest>();

  private readonly fb = inject(FormBuilder);
  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    amount: [0, [Validators.required, Validators.min(0.01)]],
    category: ['RECURRING' as ExpenseCategory, Validators.required],
    frequency: ['MONTHLY' as ExpenseFrequency, Validators.required],
    yearlyPaymentStrategy: [null as YearlyPaymentStrategy | null],
    installmentFrequency: [null as InstallmentFrequency | null],
    paymentMonth: [null as number | null],
    month: [null as number | null],
    year: [null as number | null],
    paidByUserId: [null as string | null],
    installmentYears: [null as number | null],
  });

  installmentAmount(): number {
    const amount = this.form.get('amount')?.value ?? 0;
    const years = this.form.get('installmentYears')?.value ?? 0;
    const freq = this.form.get('installmentFrequency')?.value;
    if (years <= 0) return 0;
    let installmentsPerYear: number;
    switch (freq) {
      case 'MONTHLY': installmentsPerYear = 12; break;
      case 'QUARTERLY': installmentsPerYear = 4; break;
      case 'SEMI_ANNUAL': installmentsPerYear = 2; break;
      default: installmentsPerYear = 12;
    }
    const totalInstallments = installmentsPerYear * years;
    return Math.round((amount / totalInstallments) * 100) / 100;
  }

  months = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: new Date(2000, i).toLocaleDateString('en-US', { month: 'long' }),
  }));

  constructor() {
    effect(() => {
      const e = this.expense();
      if (e) {
        this.form.patchValue({
          name: e.name, amount: e.amount, category: e.category, frequency: e.frequency,
          yearlyPaymentStrategy: e.yearlyPaymentStrategy, installmentFrequency: e.installmentFrequency,
          paymentMonth: e.paymentMonth, month: e.month, year: e.year, paidByUserId: e.paidByUserId,
        });
      }
    });
  }

  onSubmit(): void {
    if (this.form.invalid) return;
    const val = this.form.getRawValue();
    const dto: CreateExpenseRequest = {
      name: val.name, amount: val.amount, category: val.category, frequency: val.frequency,
    };
    if (val.category === 'ONE_TIME') {
      // ONE_TIME uses yearlyPaymentStrategy for FULL vs INSTALLMENTS
      if (val.yearlyPaymentStrategy) {
        dto.yearlyPaymentStrategy = val.yearlyPaymentStrategy;
        if (val.yearlyPaymentStrategy === 'FULL') {
          dto.month = val.month ?? undefined;
          dto.year = val.year ?? undefined;
        } else if (val.yearlyPaymentStrategy === 'INSTALLMENTS' && val.installmentFrequency) {
          dto.installmentFrequency = val.installmentFrequency;
        }
      }
    } else if (val.frequency === 'YEARLY' && val.yearlyPaymentStrategy) {
      dto.yearlyPaymentStrategy = val.yearlyPaymentStrategy;
      if (val.yearlyPaymentStrategy === 'INSTALLMENTS' && val.installmentFrequency) dto.installmentFrequency = val.installmentFrequency;
      if (val.yearlyPaymentStrategy === 'FULL' && val.paymentMonth) dto.paymentMonth = val.paymentMonth;
    }
    if (val.paidByUserId) dto.paidByUserId = val.paidByUserId;
    this.save.emit(dto);
  }
}
