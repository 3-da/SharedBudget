import { ChangeDetectionStrategy, Component, inject, OnInit, signal, computed } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatBadgeModule } from '@angular/material/badge';
import { RouterLink } from '@angular/router';
import { DashboardStore } from '../stores/dashboard.store';
import { IncomeSummaryCardComponent } from '../components/income-summary-card.component';
import { ExpenseSummaryCardComponent } from '../components/expense-summary-card.component';
import { SavingsCardComponent } from '../components/savings-card.component';
import { SettlementCardComponent } from '../components/settlement-card.component';
import { PageHeaderComponent } from '../../../shared/components/page-header.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    MatButtonModule, MatIconModule, MatBadgeModule, RouterLink,
    IncomeSummaryCardComponent, ExpenseSummaryCardComponent, SavingsCardComponent,
    SettlementCardComponent, PageHeaderComponent, LoadingSpinnerComponent,
  ],
  template: `
    <app-page-header title="Dashboard" [subtitle]="monthLabel()">
      <div class="header-actions">
        @if (store.pendingApprovalsCount() > 0) {
          <button mat-stroked-button routerLink="/approvals" [matBadge]="store.pendingApprovalsCount()" matBadgeColor="warn">
            <mat-icon>pending_actions</mat-icon> Approvals
          </button>
        }
      </div>
    </app-page-header>

    @if (store.loading()) {
      <app-loading-spinner />
    } @else if (store.overview(); as ov) {
      <div class="dashboard-grid">
        <app-income-summary-card [members]="ov.income" [totalCurrent]="ov.totalCurrentIncome" />
        <app-expense-summary-card [personalExpenses]="ov.expenses.personalExpenses" [sharedTotal]="ov.expenses.sharedExpensesTotal" [grandTotal]="ov.expenses.totalHouseholdExpenses" />
        <app-savings-card [members]="ov.savings.members" />
        <app-settlement-card [settlement]="ov.settlement" (markPaid)="onMarkPaid()" />
      </div>
    }
  `,
  styles: [`
    .header-actions { display: flex; align-items: center; gap: 16px; }
    .dashboard-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
      max-width: 1000px;
      margin: 0 auto;
    }
    @media (max-width: 768px) { .dashboard-grid { grid-template-columns: 1fr; } }
  `],
})
export class DashboardComponent implements OnInit {
  readonly store = inject(DashboardStore);

  readonly monthLabel = computed(() => {
    const ov = this.store.overview();
    if (!ov) return '';
    return new Date(ov.year, ov.month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  });

  ngOnInit(): void {
    this.store.loadAll();
  }

  onMarkPaid(): void {
    this.store.markPaid();
  }
}
