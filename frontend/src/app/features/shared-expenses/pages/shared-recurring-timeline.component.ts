import { ChangeDetectionStrategy, Component, effect, inject, input, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { SharedExpenseStore } from '../stores/shared-expense.store';
import { ExpenseFrequency, YearlyPaymentStrategy, ExpenseCategory } from '../../../shared/models';
import { TimelineMonth, getDefaultInstallmentCount, buildRecurringTimeline, buildInstallmentTimeline } from '../../../shared/utils/timeline';
import { roundCurrency } from '../../../shared/utils/round-currency';
import { PageHeaderComponent } from '../../../shared/components/page-header.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner.component';
import { CurrencyEurPipe } from '../../../shared/pipes/currency-eur.pipe';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-shared-recurring-timeline',
  imports: [MatCardModule, MatButtonModule, MatIconModule, MatChipsModule, PageHeaderComponent, LoadingSpinnerComponent, CurrencyEurPipe],
  template: `
    <app-page-header [title]="expenseName()" [subtitle]="timelineSubtitle()">
      <button mat-button (click)="router.navigate(['/expenses/shared'])">
        <mat-icon aria-hidden="true">arrow_back</mat-icon> Back
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
      return roundCurrency(amount / count);
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
      return buildInstallmentTimeline(expense, currentM, currentY);
    }
    return buildRecurringTimeline(expense, this.defaultAmount(), currentM, currentY);
  });

  constructor() {
    effect(() => {
      this.store.loadExpense(this.id());
      this.loading.set(false);
    });
  }
}
