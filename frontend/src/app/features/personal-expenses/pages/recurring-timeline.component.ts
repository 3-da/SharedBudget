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
import { ExpenseCategory, ExpenseFrequency, YearlyPaymentStrategy } from '../../../shared/models';
import { TimelineMonth, TimelineOverride, getDefaultInstallmentCount, buildRecurringTimeline, buildInstallmentTimeline, overrideKey } from '../../../shared/utils/timeline';
import { roundCurrency } from '../../../shared/utils/round-currency';
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

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-recurring-timeline',
  imports: [MatCardModule, MatButtonModule, MatIconModule, MatChipsModule, PageHeaderComponent, LoadingSpinnerComponent, CurrencyEurPipe],
  template: `
    <app-page-header [title]="expenseName()" [subtitle]="timelineSubtitle()">
      <button mat-button (click)="router.navigate(['/expenses/personal'])">
        <mat-icon aria-hidden="true">arrow_back</mat-icon> Back
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
                    <mat-icon aria-hidden="true">undo</mat-icon> Undo
                  </button>
                }
                <button mat-button (click)="openOverride(m)">
                  <mat-icon aria-hidden="true">edit</mat-icon> Override
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

    const overrideMap = new Map<string, TimelineOverride>(
      this.overrides().map(o => [overrideKey(o.year, o.month), { amount: o.amount ?? null, skipped: !!o.skipped }]),
    );
    return buildRecurringTimeline(expense, this.defaultAmount(), currentM, currentY, overrideMap);
  });

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
    // Look up the raw override record instead of the timeline's display amount,
    // which is zeroed out for a skipped month — pre-filling from that would
    // silently turn "skipped" into an active EUR0 override on save.
    const existingOverride = this.overrides().find(o => o.month === m.month && o.year === m.year);

    this.dialog.open(RecurringOverrideDialogComponent, {
      data: {
        expenseName: this.expenseName(),
        currentAmount: existingOverride?.amount ?? this.defaultAmount(),
        skipped: existingOverride?.skipped ?? false,
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
          const keys = new Set(result.map(r => overrideKey(r.year, r.month)));
          const filtered = list.filter(x => !keys.has(overrideKey(x.year, x.month)));
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
