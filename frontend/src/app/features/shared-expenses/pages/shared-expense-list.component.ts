import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { SharedExpenseStore } from '../stores/shared-expense.store';
import { ApprovalStore } from '../../approvals/stores/approval.store';
import { SharedExpenseCardComponent } from '../components/shared-expense-card.component';
import { PageHeaderComponent } from '../../../shared/components/page-header.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog.component';

@Component({
  selector: 'app-shared-expense-list',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, SharedExpenseCardComponent, PageHeaderComponent, LoadingSpinnerComponent, EmptyStateComponent],
  template: `
    <app-page-header title="Shared Expenses" subtitle="Expenses shared across the household">
      <div class="actions">
        <div class="month-nav">
          <button mat-icon-button (click)="prevMonth()"><mat-icon>chevron_left</mat-icon></button>
          <span>{{ monthLabel() }}</span>
          <button mat-icon-button (click)="nextMonth()"><mat-icon>chevron_right</mat-icon></button>
        </div>
        <button mat-flat-button (click)="router.navigate(['/expenses/shared/new'])">
          <mat-icon>add</mat-icon> Propose Expense
        </button>
      </div>
    </app-page-header>

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
            (undoPaid)="onUndoPaid($event)" />
        }
      </div>
    }
  `,
  styles: [`
    .actions { display: flex; align-items: center; gap: 16px; }
    .month-nav { display: flex; align-items: center; gap: 8px; }
    .expense-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; }
  `],
})
export class SharedExpenseListComponent implements OnInit {
  readonly store = inject(SharedExpenseStore);
  readonly approvalStore = inject(ApprovalStore);
  readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);

  readonly month = signal(new Date().getMonth() + 1);
  readonly year = signal(new Date().getFullYear());
  readonly monthLabel = computed(() =>
    new Date(this.year(), this.month() - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
  );

  ngOnInit(): void { this.load(); this.approvalStore.loadPending(); }

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

  onEdit(id: string): void { this.router.navigate(['/expenses/shared', id, 'edit']); }

  onDelete(id: string): void {
    this.dialog.open(ConfirmDialogComponent, {
      data: { title: 'Propose Deletion', message: 'This will submit a deletion proposal for approval. Continue?', confirmText: 'Propose Delete', color: 'warn' } as ConfirmDialogData,
    }).afterClosed().subscribe(ok => { if (ok) this.store.proposeDelete(id, this.month(), this.year()); });
  }

  onMarkPaid(id: string): void {
    this.store.markPaid(id, this.month(), this.year());
  }

  onUndoPaid(id: string): void {
    this.store.undoPaid(id, this.month(), this.year());
  }

  private load(): void { this.store.loadExpenses(this.month(), this.year()); }
}
