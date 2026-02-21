import { ChangeDetectionStrategy, Component, effect, inject, input, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { SharedExpenseStore } from '../stores/shared-expense.store';
import { ExpenseFrequency, InstallmentFrequency, YearlyPaymentStrategy, ExpenseCategory } from '../../../shared/models';
import { TimelineMonth, getDefaultInstallmentCount, getStepMonths } from '../../../shared/utils/timeline';
import { PageHeaderComponent } from '../../../shared/components/page-header.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner.component';
import { CurrencyEurPipe } from '../../../shared/pipes/currency-eur.pipe';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-shared-recurring-timeline',
  standalone: true,
  imports: [MatCardModule, MatButtonModule, MatIconModule, MatChipsModule, PageHeaderComponent, LoadingSpinnerComponent, CurrencyEurPipe],
  template: `
    <app-page-header [title]="expenseName()" [subtitle]="timelineSubtitle()">
      <button mat-button (click)="router.navigate(['/expenses/shared'])">
        <mat-icon>arrow_back</mat-icon> Back
      </button>
    </app-page-header>

    @if (loading()) {
      <app-loading-spinner />
    } @else {
      <div class="timeline">
        @for (m of timeline(); track m.month + '-' + m.year) {
          <mat-card [class.current]="m.isCurrent" [class.past]="m.isPast">
            <mat-card-header>
              <mat-card-title>{{ m.label }}</mat-card-title>
            </mat-card-header>
            <mat-card-content>
              <span class="amount">{{ m.amount | currencyEur }}</span>
            </mat-card-content>
          </mat-card>
        }
      </div>
    }
  `,
  styles: [`
    .timeline {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 8px; max-width: 1200px; margin: 0 auto;
    }
    .amount { font-size: 1.2rem; font-weight: 500; }
    .current { border-left: 3px solid var(--mat-sys-primary); }
    .past { opacity: 0.6; }
  `],
})
export class SharedRecurringTimelineComponent {
  readonly router = inject(Router);
  private readonly store = inject(SharedExpenseStore);

  readonly id = input.required<string>();
  readonly loading = signal(true);

  readonly expenseName = computed(() => this.store.selectedExpense()?.name ?? 'Expense');
  readonly defaultAmount = computed(() => {
    const e = this.store.selectedExpense();
    if (!e) return 0;
    const amount = Number(e.amount);
    if (e.frequency === ExpenseFrequency.YEARLY && e.yearlyPaymentStrategy === YearlyPaymentStrategy.INSTALLMENTS) {
      const count = e.installmentCount ?? getDefaultInstallmentCount(e.installmentFrequency);
      return Math.round((amount / count) * 100) / 100;
    }
    return amount;
  });
  readonly isOneTimeInstallment = computed(() => {
    const e = this.store.selectedExpense();
    return e?.category === ExpenseCategory.ONE_TIME && e?.yearlyPaymentStrategy === YearlyPaymentStrategy.INSTALLMENTS;
  });
  readonly timelineSubtitle = computed(() =>
    this.isOneTimeInstallment() ? 'Installment schedule' : 'Recurring expense timeline',
  );

  readonly timeline = computed<TimelineMonth[]>(() => {
    const expense = this.store.selectedExpense();
    if (!expense) return [];
    const now = new Date();
    const currentM = now.getMonth() + 1;
    const currentY = now.getFullYear();

    if (this.isOneTimeInstallment()) {
      return this.buildInstallmentTimeline(expense, currentM, currentY);
    }
    return this.buildRecurringTimeline(expense, currentM, currentY);
  });

  constructor() {
    effect(() => {
      this.store.loadExpense(this.id());
      this.loading.set(false);
    });
  }

  private buildRecurringTimeline(expense: any, currentM: number, currentY: number): TimelineMonth[] {
    const months: TimelineMonth[] = [];
    const isYearly = expense.frequency === ExpenseFrequency.YEARLY;
    const strategy = expense.yearlyPaymentStrategy;
    const installFreq = expense.installmentFrequency;
    const expenseMonth = expense.month ?? 1;

    for (let offset = -12; offset <= 12; offset++) {
      const d = new Date(currentY, currentM - 1 + offset);
      const m = d.getMonth() + 1;
      const y = d.getFullYear();

      if (isYearly) {
        if (strategy === YearlyPaymentStrategy.FULL) {
          if (m !== expenseMonth) continue;
        } else if (strategy === YearlyPaymentStrategy.INSTALLMENTS) {
          if (installFreq === InstallmentFrequency.QUARTERLY) {
            if ((m - expenseMonth + 12) % 3 !== 0) continue;
          } else if (installFreq === InstallmentFrequency.SEMI_ANNUAL) {
            if ((m - expenseMonth + 12) % 6 !== 0) continue;
          }
        }
      }

      months.push({
        month: m, year: y,
        label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        amount: this.defaultAmount(),
        isPast: y < currentY || (y === currentY && m < currentM),
        isCurrent: y === currentY && m === currentM,
      });
    }
    return months;
  }

  private buildInstallmentTimeline(expense: any, currentM: number, currentY: number): TimelineMonth[] {
    const startMonth = expense.month ?? currentM;
    const startYear = expense.year ?? currentY;
    const freq = expense.installmentFrequency;
    const totalAmount = Number(expense.amount);
    const count = expense.installmentCount ?? getDefaultInstallmentCount(freq);
    const stepMonths = getStepMonths(freq);
    const perInstallment = Math.round((totalAmount / count) * 100) / 100;
    const months: TimelineMonth[] = [];

    for (let i = 0; i < count; i++) {
      const d = new Date(startYear, startMonth - 1 + (i * stepMonths));
      const m = d.getMonth() + 1;
      const y = d.getFullYear();
      months.push({
        month: m, year: y,
        label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        amount: perInstallment,
        isPast: y < currentY || (y === currentY && m < currentM),
        isCurrent: y === currentY && m === currentM,
      });
    }
    return months;
  }
}
