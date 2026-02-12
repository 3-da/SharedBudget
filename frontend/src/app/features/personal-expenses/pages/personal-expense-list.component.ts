import { Component, inject, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { PersonalExpenseStore } from '../stores/personal-expense.store';
import { ExpenseCardComponent } from '../components/expense-card.component';
import { MonthPickerComponent } from '../../../shared/components/month-picker.component';
import { PageHeaderComponent } from '../../../shared/components/page-header.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state.component';
import { CurrencyEurPipe } from '../../../shared/pipes/currency-eur.pipe';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog.component';

@Component({
  selector: 'app-personal-expense-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, ExpenseCardComponent, MonthPickerComponent, PageHeaderComponent, LoadingSpinnerComponent, EmptyStateComponent, CurrencyEurPipe],
  template: `
    <app-page-header title="My Expenses" [subtitle]="'Total: ' + (store.totalMonthly() | currencyEur)">
      <div class="actions">
        <app-month-picker
          [selectedMonth]="month()"
          [selectedYear]="year()"
          (monthChange)="onMonthChange($event)" />
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
    .actions { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
    .expense-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
    @media (max-width: 600px) { .expense-grid { grid-template-columns: 1fr; } }
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

  ngOnInit(): void { this.load(); }

  onMonthChange(event: { month: number; year: number }): void {
    this.month.set(event.month);
    this.year.set(event.year);
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
