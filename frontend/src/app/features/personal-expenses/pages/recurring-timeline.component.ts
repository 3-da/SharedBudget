import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { PersonalExpenseStore } from '../stores/personal-expense.store';
import { RecurringOverrideService } from '../services/recurring-override.service';
import { RecurringOverride } from '../../../shared/models/recurring-override.model';
import { PageHeaderComponent } from '../../../shared/components/page-header.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner.component';
import { CurrencyEurPipe } from '../../../shared/pipes/currency-eur.pipe';
import {
  RecurringOverrideDialogComponent,
  RecurringOverrideDialogData,
  RecurringOverrideDialogResult,
} from '../components/recurring-override-dialog.component';

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
  selector: 'app-recurring-timeline',
  standalone: true,
  imports: [MatCardModule, MatButtonModule, MatIconModule, MatChipsModule, PageHeaderComponent, LoadingSpinnerComponent, CurrencyEurPipe],
  template: `
    <app-page-header [title]="expenseName()" subtitle="Recurring expense timeline">
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
            @if (!m.isPast) {
              <mat-card-actions align="end">
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
export class RecurringTimelineComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  readonly router = inject(Router);
  private readonly store = inject(PersonalExpenseStore);
  private readonly overrideService = inject(RecurringOverrideService);
  private readonly dialog = inject(MatDialog);

  readonly loading = signal(true);
  private readonly overrides = signal<RecurringOverride[]>([]);
  private readonly expenseId = signal('');

  readonly expenseName = computed(() => this.store.selectedExpense()?.name ?? 'Expense');
  readonly defaultAmount = computed(() => this.store.selectedExpense()?.amount ?? 0);

  readonly timeline = computed<TimelineMonth[]>(() => {
    const now = new Date();
    const currentM = now.getMonth() + 1;
    const currentY = now.getFullYear();
    const overrideMap = new Map(this.overrides().map(o => [`${o.year}-${o.month}`, o]));
    const months: TimelineMonth[] = [];

    for (let offset = -12; offset <= 12; offset++) {
      const d = new Date(currentY, currentM - 1 + offset);
      const m = d.getMonth() + 1;
      const y = d.getFullYear();
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
  });

  ngOnInit(): void {
    const id = this.route.snapshot.params['id'];
    this.expenseId.set(id);
    this.store.loadExpense(id);
    this.overrideService.listOverrides(id).subscribe({
      next: o => { this.overrides.set(o); this.loading.set(false); },
      error: () => this.loading.set(false),
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
    }).afterClosed().subscribe((result: RecurringOverrideDialogResult | undefined) => {
      if (!result) return;
      this.overrideService.upsertOverride(this.expenseId(), m.year, m.month, result).subscribe({
        next: o => this.overrides.update(list => {
          const filtered = list.filter(x => !(x.month === m.month && x.year === m.year));
          return [...filtered, o];
        }),
      });
    });
  }
}
