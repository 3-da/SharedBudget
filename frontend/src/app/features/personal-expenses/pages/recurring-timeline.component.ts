import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, signal, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { filter, switchMap } from 'rxjs';
import { PersonalExpenseStore } from '../stores/personal-expense.store';
import { RecurringOverrideService } from '../services/recurring-override.service';
import { RecurringOverride } from '../../../shared/models/recurring-override.model';
import { BatchOverrideItem } from '../../../shared/models/recurring-override.model';
import { ExpenseCategory, ExpenseFrequency, InstallmentFrequency, YearlyPaymentStrategy } from '../../../shared/models/enums';
import { PageHeaderComponent } from '../../../shared/components/page-header.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner.component';
import { CurrencyEurPipe } from '../../../shared/pipes/currency-eur.pipe';
import {
  RecurringOverrideDialogComponent,
  RecurringOverrideDialogData,
  RecurringOverrideDialogResult,
} from '../components/recurring-override-dialog.component';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-undo-scope-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>Undo Override</h2>
    <mat-dialog-content>Which overrides should be removed?</mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-button [mat-dialog-close]="'single'">This month only</button>
      <button mat-flat-button [mat-dialog-close]="'all_upcoming'">All upcoming months</button>
    </mat-dialog-actions>
  `,
})
class UndoScopeDialogComponent {}

interface TimelineMonth {
  month: number;
  year: number;
  label: string;
  amount: number;
  isOverride: boolean;
  isPast: boolean;
  isCurrent: boolean;
}

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-recurring-timeline',
  standalone: true,
  imports: [MatCardModule, MatButtonModule, MatIconModule, MatChipsModule, PageHeaderComponent, LoadingSpinnerComponent, CurrencyEurPipe],
  template: `
    <app-page-header [title]="expenseName()" [subtitle]="timelineSubtitle()">
      <button mat-button (click)="router.navigate(['/expenses/personal'])">
        <mat-icon>arrow_back</mat-icon> Back
      </button>
    </app-page-header>

    @if (loading()) {
      <app-loading-spinner />
    } @else {
      <div class="timeline">
        @for (m of timeline(); track m.month + '-' + m.year) {
          <mat-card [class.current]="m.isCurrent" [class.past]="m.isPast" [class.override]="m.isOverride">
            <mat-card-header>
              <mat-card-title>{{ m.label }}</mat-card-title>
              @if (m.isOverride) {
                <mat-chip class="override-chip">Override</mat-chip>
              }
            </mat-card-header>
            <mat-card-content>
              <span class="amount">{{ m.amount | currencyEur }}</span>
            </mat-card-content>
            @if (!m.isPast && !isOneTimeInstallment()) {
              <mat-card-actions align="end">
                @if (m.isOverride) {
                  <button mat-button (click)="undoOverride(m)">
                    <mat-icon>undo</mat-icon> Undo
                  </button>
                }
                <button mat-button (click)="openOverride(m)">
                  <mat-icon>edit</mat-icon> Override
                </button>
              </mat-card-actions>
            }
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
    .override .amount { color: var(--mat-sys-tertiary); }
    .override-chip { --mdc-chip-elevated-container-color: var(--mat-sys-tertiary-container); font-size: 0.7rem; }
  `],
})
export class RecurringTimelineComponent {
  readonly router = inject(Router);
  private readonly store = inject(PersonalExpenseStore);
  private readonly overrideService = inject(RecurringOverrideService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  readonly id = input.required<string>();
  readonly loading = signal(true);
  private readonly overrides = signal<RecurringOverride[]>([]);

  readonly expenseName = computed(() => this.store.selectedExpense()?.name ?? 'Expense');
  readonly defaultAmount = computed(() => {
    const e = this.store.selectedExpense();
    if (!e) return 0;
    const amount = Number(e.amount);
    // For yearly installments, show per-installment amount
    if (e.frequency === ExpenseFrequency.YEARLY && e.yearlyPaymentStrategy === YearlyPaymentStrategy.INSTALLMENTS) {
      const count = e.installmentCount ?? this.getDefaultInstallmentCount(e.installmentFrequency);
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

    return this.buildRecurringTimeline(currentM, currentY);
  });

  private buildRecurringTimeline(currentM: number, currentY: number): TimelineMonth[] {
    const expense = this.store.selectedExpense();
    const overrideMap = new Map(this.overrides().map(o => [`${o.year}-${o.month}`, o]));
    const months: TimelineMonth[] = [];

    // For YEARLY frequency, only show applicable months based on payment strategy
    const isYearly = expense?.frequency === ExpenseFrequency.YEARLY;
    const strategy = expense?.yearlyPaymentStrategy;
    const installFreq = expense?.installmentFrequency;
    const expenseMonth = expense?.month ?? 1;

    for (let offset = -12; offset <= 12; offset++) {
      const d = new Date(currentY, currentM - 1 + offset);
      const m = d.getMonth() + 1;
      const y = d.getFullYear();

      // Skip months that don't apply for yearly expenses
      if (isYearly) {
        if (strategy === YearlyPaymentStrategy.FULL) {
          // Only show the payment month
          if (m !== expenseMonth) continue;
        } else if (strategy === YearlyPaymentStrategy.INSTALLMENTS) {
          if (installFreq === InstallmentFrequency.QUARTERLY) {
            // Show every 3 months starting from expense month
            if ((m - expenseMonth + 12) % 3 !== 0) continue;
          } else if (installFreq === InstallmentFrequency.SEMI_ANNUAL) {
            // Show every 6 months starting from expense month
            if ((m - expenseMonth + 12) % 6 !== 0) continue;
          }
          // MONTHLY installments show all months
        }
      }

      const key = `${y}-${m}`;
      const override = overrideMap.get(key);
      months.push({
        month: m, year: y,
        label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        amount: override?.skipped ? 0 : (override?.amount ?? this.defaultAmount()),
        isOverride: !!override,
        isPast: y < currentY || (y === currentY && m < currentM),
        isCurrent: y === currentY && m === currentM,
      });
    }
    return months;
  }

  private getDefaultInstallmentCount(freq: InstallmentFrequency | null | undefined): number {
    switch (freq) {
      case InstallmentFrequency.QUARTERLY: return 4;
      case InstallmentFrequency.SEMI_ANNUAL: return 2;
      case InstallmentFrequency.MONTHLY: default: return 12;
    }
  }

  private getStepMonths(freq: InstallmentFrequency | null | undefined): number {
    switch (freq) {
      case InstallmentFrequency.QUARTERLY: return 3;
      case InstallmentFrequency.SEMI_ANNUAL: return 6;
      case InstallmentFrequency.MONTHLY: default: return 1;
    }
  }

  private buildInstallmentTimeline(expense: any, currentM: number, currentY: number): TimelineMonth[] {
    const startMonth = expense.month ?? currentM;
    const startYear = expense.year ?? currentY;
    const freq = expense.installmentFrequency;
    const totalAmount = Number(expense.amount);

    const count = expense.installmentCount ?? this.getDefaultInstallmentCount(freq);
    const stepMonths = this.getStepMonths(freq);

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
        isOverride: false,
        isPast: y < currentY || (y === currentY && m < currentM),
        isCurrent: y === currentY && m === currentM,
      });
    }
    return months;
  }

  constructor() {
    effect(() => {
      const expenseId = this.id();
      this.store.loadExpense(expenseId);
      this.overrideService.listOverrides(expenseId).pipe(
        takeUntilDestroyed(this.destroyRef),
      ).subscribe({
        next: o => { this.overrides.set(o); this.loading.set(false); },
        error: () => this.loading.set(false),
      });
    });
  }

  openOverride(m: TimelineMonth): void {
    this.dialog.open(RecurringOverrideDialogComponent, {
      data: {
        expenseName: this.expenseName(),
        currentAmount: m.amount,
        month: m.month,
        year: m.year,
      } as RecurringOverrideDialogData,
      width: '400px',
    }).afterClosed().pipe(
      takeUntilDestroyed(this.destroyRef),
      filter((result): result is RecurringOverrideDialogResult => !!result),
      switchMap(result => {
        const dto = { amount: result.amount, skipped: result.skipped };

        if (result.scope === 'all_upcoming') {
          const upcomingMonths = this.timeline().filter(t =>
            t.year > m.year || (t.year === m.year && t.month >= m.month),
          );
          const batchItems: BatchOverrideItem[] = upcomingMonths.map(t => ({
            year: t.year, month: t.month, amount: result.amount, skipped: result.skipped,
          }));
          return this.overrideService.batchUpsertOverrides(this.id(), { overrides: batchItems });
        }
        return this.overrideService.upsertOverride(this.id(), m.year, m.month, dto);
      }),
    ).subscribe(result => {
      if (Array.isArray(result)) {
        this.overrides.update(list => {
          const keys = new Set(result.map(r => `${r.year}-${r.month}`));
          const filtered = list.filter(x => !keys.has(`${x.year}-${x.month}`));
          return [...filtered, ...result];
        });
      } else {
        this.overrides.update(list => {
          const filtered = list.filter(x => !(x.month === m.month && x.year === m.year));
          return [...filtered, result];
        });
      }
    });
  }

  undoOverride(m: TimelineMonth): void {
    const hasUpcoming = this.overrides().some(o =>
      o.year > m.year || (o.year === m.year && o.month > m.month),
    );

    if (!hasUpcoming) {
      this.overrideService.deleteOverride(this.id(), m.year, m.month).pipe(
        takeUntilDestroyed(this.destroyRef),
      ).subscribe({
        next: () => this.overrides.update(list =>
          list.filter(x => !(x.month === m.month && x.year === m.year)),
        ),
      });
      return;
    }

    this.dialog.open(UndoScopeDialogComponent, { width: '350px' })
      .afterClosed().pipe(
        takeUntilDestroyed(this.destroyRef),
        filter((scope): scope is 'single' | 'all_upcoming' => !!scope),
        switchMap(scope => {
          if (scope === 'all_upcoming') {
            return this.overrideService.deleteUpcomingOverrides(this.id(), m.year, m.month);
          }
          return this.overrideService.deleteOverride(this.id(), m.year, m.month);
        }),
        switchMap(() => this.overrideService.listOverrides(this.id())),
      ).subscribe(o => this.overrides.set(o));
  }
}
