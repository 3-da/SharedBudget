import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { PersonalExpenseStore } from '../stores/personal-expense.store';
import { ExpenseCardComponent } from '../components/expense-card.component';
import { PageHeaderComponent } from '../../../shared/components/page-header.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state.component';
import { CurrencyEurPipe } from '../../../shared/pipes/currency-eur.pipe';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog.component';

@Component({
  selector: 'app-personal-expense-list',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, ExpenseCardComponent, PageHeaderComponent, LoadingSpinnerComponent, EmptyStateComponent, CurrencyEurPipe],
  template: `
    <app-page-header title="My Expenses" [subtitle]="'Total: ' + (store.totalMonthly() | currencyEur)">
      <div class="actions">
        <div class="month-nav">
          <button mat-icon-button (click)="prevMonth()"><mat-icon>chevron_left</mat-icon></button>
          <span>{{ monthLabel() }}</span>
          <button mat-icon-button (click)="nextMonth()"><mat-icon>chevron_right</mat-icon></button>
        </div>
        <button mat-flat-button (click)="router.navigate(['/expenses/personal/new'])">
          <mat-icon>add</mat-icon> Add Expense
        </button>
      </div>
    </app-page-header>

    @if (store.expenses().length > 0) {
      <div class="budget-bar">
        <span class="budget-label">Remaining: <strong>{{ store.remainingBudget() | currencyEur }}</strong></span>
        <span class="budget-paid">Paid: {{ store.paidTotal() | currencyEur }} / {{ store.totalMonthly() | currencyEur }}</span>
      </div>
    }

    @if (store.loading()) {
      <app-loading-spinner />
    } @else if (store.expenses().length === 0) {
      <app-empty-state icon="receipt_long" title="No Expenses" description="Add your first personal expense to start tracking." />
    } @else {
      <div class="expense-grid">
        @for (e of store.expenses(); track e.id) {
          <app-expense-card
            [expense]="e"
            [paymentStatus]="store.paymentStatuses().get(e.id) ?? null"
            (edit)="onEdit($event)"
            (remove)="onDelete($event)"
            (markPaid)="onMarkPaid($event)"
            (undoPaid)="onUndoPaid($event)"
            (viewTimeline)="onTimeline($event)" />
        }
      </div>
    }
  `,
  styles: [`
    .actions { display: flex; align-items: center; gap: 16px; }
    .month-nav { display: flex; align-items: center; gap: 8px; }
    .expense-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; }
    .budget-bar {
      display: flex; justify-content: space-between; align-items: center;
      padding: 8px 16px; margin-bottom: 16px; border-radius: 8px;
      background: var(--mat-sys-surface-container);
    }
    .budget-label { font-size: 1rem; }
    .budget-paid { font-size: 0.85rem; opacity: 0.7; }
  `],
})
export class PersonalExpenseListComponent implements OnInit {
  readonly store = inject(PersonalExpenseStore);
  readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);

  readonly month = signal(new Date().getMonth() + 1);
  readonly year = signal(new Date().getFullYear());
  readonly monthLabel = computed(() =>
    new Date(this.year(), this.month() - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
  );

  ngOnInit(): void { this.load(); }

  prevMonth(): void {
    if (this.month() === 1) { this.month.set(12); this.year.update(y => y - 1); }
    else this.month.update(m => m - 1);
    this.load();
  }

  nextMonth(): void {
    if (this.month() === 12) { this.month.set(1); this.year.update(y => y + 1); }
    else this.month.update(m => m + 1);
    this.load();
  }

  onEdit(id: string): void { this.router.navigate(['/expenses/personal', id, 'edit']); }

  onDelete(id: string): void {
    this.dialog.open(ConfirmDialogComponent, {
      data: { title: 'Delete Expense', message: 'Delete this expense permanently?', confirmText: 'Delete', color: 'warn' } as ConfirmDialogData,
    }).afterClosed().subscribe(ok => { if (ok) this.store.deleteExpense(id, this.month(), this.year()); });
  }

  onMarkPaid(id: string): void {
    this.store.markPaid(id, this.month(), this.year());
  }

  onUndoPaid(id: string): void {
    this.store.undoPaid(id, this.month(), this.year());
  }

  onTimeline(id: string): void {
    this.router.navigate(['/expenses/personal', id, 'timeline']);
  }

  private load(): void { this.store.loadExpenses(this.month(), this.year()); }
}
