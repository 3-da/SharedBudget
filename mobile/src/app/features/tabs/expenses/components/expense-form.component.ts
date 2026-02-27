import { ChangeDetectionStrategy, Component, inject, input, output, effect, computed } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';
import { DecimalPipe } from '@angular/common';
import { IonItem, IonInput, IonSelect, IonSelectOption, IonButton, IonNote } from '@ionic/angular/standalone';
import { Expense, CreateExpenseRequest } from '../../../../shared/models/expense.model';
import { HouseholdMember } from '../../../../shared/models/household.model';
import { ExpenseCategory, ExpenseFrequency, YearlyPaymentStrategy, InstallmentFrequency } from '../../../../shared/models/enums';

@Component({
  selector: 'app-expense-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, IonItem, IonInput, IonSelect, IonSelectOption, IonButton, IonNote, DecimalPipe],
  template: `
    <form [formGroup]="form" (ngSubmit)="onSubmit()">
      <ion-item>
        <ion-input label="Name" labelPlacement="floating" formControlName="name" maxlength="100"></ion-input>
      </ion-item>

      <ion-item>
        <ion-input label="Amount (EUR)" labelPlacement="floating" formControlName="amount" type="number" min="0.01" step="0.01"></ion-input>
      </ion-item>

      <ion-item>
        <ion-select label="Category" labelPlacement="floating" formControlName="category" interface="action-sheet">
          <ion-select-option value="RECURRING">Recurring</ion-select-option>
          <ion-select-option value="ONE_TIME">One-time</ion-select-option>
        </ion-select>
      </ion-item>

      @if (showFrequency()) {
        <ion-item>
          <ion-select label="Frequency" labelPlacement="floating" formControlName="frequency" interface="action-sheet">
            <ion-select-option value="MONTHLY">Monthly</ion-select-option>
            <ion-select-option value="YEARLY">Yearly</ion-select-option>
          </ion-select>
        </ion-item>
      }

      @if (showYearlyOptions()) {
        <ion-item>
          <ion-select label="Yearly Payment Strategy" labelPlacement="floating" formControlName="yearlyPaymentStrategy" interface="action-sheet">
            <ion-select-option value="FULL">Full payment</ion-select-option>
            <ion-select-option value="INSTALLMENTS">Installments</ion-select-option>
          </ion-select>
        </ion-item>

        @if (formYearlyStrategy() === 'INSTALLMENTS') {
          <ion-item>
            <ion-select label="Installment Frequency" labelPlacement="floating" formControlName="installmentFrequency" interface="action-sheet">
              <ion-select-option value="QUARTERLY">Quarterly</ion-select-option>
              <ion-select-option value="SEMI_ANNUAL">Semi-annual</ion-select-option>
            </ion-select>
          </ion-item>
        }

        @if (formYearlyStrategy() === 'FULL') {
          <ion-item>
            <ion-select label="Payment Month" labelPlacement="floating" formControlName="paymentMonth" interface="action-sheet">
              @for (m of months; track m.value) {
                <ion-select-option [value]="m.value">{{ m.label }}</ion-select-option>
              }
            </ion-select>
          </ion-item>
        }
      }

      @if (formCategory() === 'ONE_TIME') {
        <ion-item>
          <ion-select label="Payment Type" labelPlacement="floating" formControlName="yearlyPaymentStrategy" interface="action-sheet">
            <ion-select-option value="FULL">Full payment</ion-select-option>
            <ion-select-option value="INSTALLMENTS">Installments</ion-select-option>
          </ion-select>
        </ion-item>

        @if (formYearlyStrategy() === 'FULL' || !formYearlyStrategy()) {
          <ion-item>
            <ion-select label="Expense Month" labelPlacement="floating" formControlName="month" interface="action-sheet">
              @for (m of months; track m.value) {
                <ion-select-option [value]="m.value">{{ m.label }}</ion-select-option>
              }
            </ion-select>
          </ion-item>
          <ion-item>
            <ion-input label="Expense Year" labelPlacement="floating" formControlName="year" type="number" min="2020" max="2099"></ion-input>
          </ion-item>
        }

        @if (formYearlyStrategy() === 'INSTALLMENTS') {
          <ion-item>
            <ion-select label="Start Month" labelPlacement="floating" formControlName="month" interface="action-sheet">
              @for (m of months; track m.value) {
                <ion-select-option [value]="m.value">{{ m.label }}</ion-select-option>
              }
            </ion-select>
          </ion-item>
          <ion-item>
            <ion-input label="Start Year" labelPlacement="floating" formControlName="year" type="number" min="2020" max="2099"></ion-input>
          </ion-item>
          <ion-item>
            <ion-select label="Installment Frequency" labelPlacement="floating" formControlName="installmentFrequency" interface="action-sheet">
              <ion-select-option value="MONTHLY">Monthly</ion-select-option>
              <ion-select-option value="QUARTERLY">Quarterly</ion-select-option>
              <ion-select-option value="SEMI_ANNUAL">Semi-annual</ion-select-option>
            </ion-select>
          </ion-item>
          <ion-item>
            <ion-input label="Duration (years)" labelPlacement="floating" formControlName="installmentYears" type="number" min="1" max="30"></ion-input>
          </ion-item>
          @if (installmentAmount() > 0) {
            <ion-note class="ion-padding-start">Each installment: {{ installmentAmount() | number:'1.2-2' }} EUR</ion-note>
          }
        }
      }

      @if (showPaidBy()) {
        <ion-item>
          <ion-select label="Paid By" labelPlacement="floating" formControlName="paidByUserId" interface="action-sheet">
            <ion-select-option [value]="null">Split equally</ion-select-option>
            @for (m of members(); track m.userId) {
              <ion-select-option [value]="m.userId">{{ m.firstName }} {{ m.lastName }}</ion-select-option>
            }
          </ion-select>
        </ion-item>
      }

      <ion-button expand="block" type="submit" [disabled]="loading()" class="ion-margin-top">
        {{ expense() ? 'Update' : 'Create' }} Expense
      </ion-button>
    </form>
  `,
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

  readonly formCategory = toSignal(
    this.form.controls.category.valueChanges.pipe(startWith(this.form.controls.category.value)),
  );
  readonly formFrequency = toSignal(
    this.form.controls.frequency.valueChanges.pipe(startWith(this.form.controls.frequency.value)),
  );
  readonly formYearlyStrategy = toSignal(
    this.form.controls.yearlyPaymentStrategy.valueChanges.pipe(startWith(this.form.controls.yearlyPaymentStrategy.value)),
  );
  private readonly formValues = toSignal(
    this.form.valueChanges.pipe(startWith(this.form.getRawValue())),
    { initialValue: this.form.getRawValue() },
  );

  readonly showFrequency = computed(() => this.formCategory() !== 'ONE_TIME');
  readonly showYearlyOptions = computed(() => this.formCategory() !== 'ONE_TIME' && this.formFrequency() === 'YEARLY');

  readonly installmentAmount = computed(() => {
    const v = this.formValues();
    const amount = v.amount ?? 0;
    const years = v.installmentYears ?? 0;
    const freq = v.installmentFrequency;
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
  });

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
      dto.frequency = 'MONTHLY' as ExpenseFrequency;
      dto.month = val.month ?? new Date().getMonth() + 1;
      dto.year = val.year ?? new Date().getFullYear();
      if (val.yearlyPaymentStrategy) {
        dto.yearlyPaymentStrategy = val.yearlyPaymentStrategy;
        if (val.yearlyPaymentStrategy === 'INSTALLMENTS' && val.installmentFrequency) {
          dto.installmentFrequency = val.installmentFrequency;
          const years = val.installmentYears ?? 1;
          let perYear: number;
          switch (val.installmentFrequency) {
            case 'MONTHLY': perYear = 12; break;
            case 'QUARTERLY': perYear = 4; break;
            case 'SEMI_ANNUAL': perYear = 2; break;
            default: perYear = 12;
          }
          dto.installmentCount = perYear * years;
        }
      }
    } else if (val.frequency === 'YEARLY' && val.yearlyPaymentStrategy) {
      dto.yearlyPaymentStrategy = val.yearlyPaymentStrategy;
      if (val.yearlyPaymentStrategy === 'INSTALLMENTS' && val.installmentFrequency) {
        dto.installmentFrequency = val.installmentFrequency;
        switch (val.installmentFrequency) {
          case 'QUARTERLY': dto.installmentCount = 4; break;
          case 'SEMI_ANNUAL': dto.installmentCount = 2; break;
          default: dto.installmentCount = 12; break;
        }
      }
      if (val.yearlyPaymentStrategy === 'FULL' && val.paymentMonth) dto.paymentMonth = val.paymentMonth;
    }
    if (val.paidByUserId) dto.paidByUserId = val.paidByUserId;
    this.save.emit(dto);
  }
}
