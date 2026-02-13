import { Component, DestroyRef, inject, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { SharedExpenseStore } from '../stores/shared-expense.store';
import { ApprovalStore } from '../../approvals/stores/approval.store';
import { SharedExpenseCardComponent } from '../components/shared-expense-card.component';
import { MonthPickerComponent } from '../../../shared/components/month-picker.component';
import { PageHeaderComponent } from '../../../shared/components/page-header.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog.component';

@Component({
  selector: 'app-shared-expense-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, SharedExpenseCardComponent, MonthPickerComponent, PageHeaderComponent, LoadingSpinnerComponent, EmptyStateComponent],
  template: `
    <app-page-header title="Shared Expenses" subtitle="Expenses shared across the household">
      <div class="actions">
        <app-month-picker
          [selectedMonth]="month()"
          [selectedYear]="year()"
          (monthChange)="onMonthChange($event)" />
        <button mat-flat-button (click)="router.navigate(['/expenses/shared/new'])">
          <mat-icon>add</mat-icon> Propose Expense
        </button>
      </div>
    </app-page-header>

    @if (store.error()) {
      <div class="error-banner">
        <mat-icon>error_outline</mat-icon>
        <span>{{ store.error() }}</span>
      </div>
    }

    @if (store.loading()) {
      <app-loading-spinner />
    } @else if (store.expenses().length === 0) {
      <app-empty-state icon="group" title="No Shared Expenses" description="Propose a shared expense for the household." />
    } @else {
      <div class="expense-grid">
        @for (e of store.expenses(); track e.id) {
          <app-shared-expense-card
            [expense]="e"
            [hasPendingApproval]="approvalStore.pendingExpenseIds().has(e.id)"
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
    .actions { display: flex; align-items: center; gap: var(--space-md); flex-wrap: wrap; }
    .expense-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: var(--space-md); }
    @media (max-width: 600px) { .expense-grid { grid-template-columns: 1fr; gap: var(--space-sm); } }
    .error-banner {
      display: flex; align-items: center; gap: var(--space-sm);
      padding: var(--space-sm) var(--space-md); margin-bottom: var(--space-md);
      border-radius: 8px;
      background: color-mix(in srgb, var(--mat-sys-error) 10%, transparent);
      color: var(--mat-sys-error);
    }
  `],
})
export class SharedExpenseListComponent implements OnInit {
  readonly store = inject(SharedExpenseStore);
  readonly approvalStore = inject(ApprovalStore);
  readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  readonly month = signal(new Date().getMonth() + 1);
  readonly year = signal(new Date().getFullYear());

  ngOnInit(): void { this.load(); this.approvalStore.loadPending(); }

  onMonthChange(event: { month: number; year: number }): void {
    this.month.set(event.month);
    this.year.set(event.year);
    this.load();
  }

  onEdit(id: string): void { this.router.navigate(['/expenses/shared', id, 'edit']); }

  onDelete(id: string): void {
    this.dialog.open(ConfirmDialogComponent, {
      data: { title: 'Propose Deletion', message: 'This will submit a deletion proposal for approval. Continue?', confirmText: 'Propose Delete', color: 'warn' } as ConfirmDialogData,
    }).afterClosed().pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(ok => { if (ok) this.store.proposeDelete(id, this.month(), this.year()); });
  }

  onMarkPaid(id: string): void {
    this.store.markPaid(id, this.month(), this.year());
  }

  onUndoPaid(id: string): void {
    this.store.undoPaid(id, this.month(), this.year());
  }

  onTimeline(id: string): void {
    this.router.navigate(['/expenses/shared', id, 'timeline']);
  }

  private load(): void { this.store.loadExpenses(this.month(), this.year()); }
}
