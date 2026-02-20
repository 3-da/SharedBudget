import { Component, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { RouterLink } from '@angular/router';
import { HouseholdStore } from '../stores/household.store';
import { ApprovalStore } from '../../approvals/stores/approval.store';
import { CreateHouseholdFormComponent } from '../components/create-household-form.component';
import { JoinByCodeFormComponent } from '../components/join-by-code-form.component';
import { FinancialSummaryComponent } from '../components/financial-summary.component';
import { MemberFinanceCardComponent } from '../components/member-finance-card.component';
import { SettlementSummaryComponent } from '../components/settlement-summary.component';
import { HouseholdManagementComponent } from '../components/household-management.component';
import { IncomeExpenseChartComponent } from '../components/income-expense-chart.component';
import { SavingsChartComponent } from '../components/savings-chart.component';
import { MonthPickerComponent } from '../../../shared/components/month-picker.component';
import { PageHeaderComponent } from '../../../shared/components/page-header.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner.component';

@Component({
  selector: 'app-household-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule, MatIconModule, MatBadgeModule, MatTabsModule, MatButtonToggleModule, RouterLink,
    CreateHouseholdFormComponent, JoinByCodeFormComponent,
    FinancialSummaryComponent, MemberFinanceCardComponent,
    SettlementSummaryComponent, HouseholdManagementComponent,
    IncomeExpenseChartComponent, SavingsChartComponent,
    MonthPickerComponent, PageHeaderComponent, LoadingSpinnerComponent,
  ],
  template: `
    @if (store.loading()) {
      <app-loading-spinner />
    } @else if (!store.hasHousehold()) {
      <div class="setup-container">
        <h2>Join or Create a Household</h2>
        <mat-tab-group>
          <mat-tab label="Create New">
            <div class="tab-content">
              <app-create-household-form />
            </div>
          </mat-tab>
          <mat-tab label="Join by Code">
            <div class="tab-content">
              <app-join-by-code-form />
            </div>
          </mat-tab>
        </mat-tab-group>
      </div>
    } @else {
      <app-page-header [title]="store.household()!.name" [subtitle]="store.monthLabel()">
        <div class="header-actions">
          <app-month-picker
            [selectedMonth]="store.selectedMonth()"
            [selectedYear]="store.selectedYear()"
            (monthChange)="store.setMonth($event.month, $event.year)" />
          <mat-button-toggle-group [value]="store.viewMode()" (change)="store.setViewMode($event.value)">
            <mat-button-toggle value="monthly">This Month</mat-button-toggle>
            <mat-button-toggle value="yearly">Yearly Average</mat-button-toggle>
          </mat-button-toggle-group>
          @if (approvalStore.pendingCount() > 0) {
            <button mat-stroked-button routerLink="/approvals"
              class="has-pending"
              [matBadge]="approvalStore.pendingCount()"
              matBadgeColor="warn">
              <mat-icon>pending_actions</mat-icon> Approvals
            </button>
          }
        </div>
      </app-page-header>

      @if (store.overviewLoading()) {
        <app-loading-spinner />
      } @else if (store.overview(); as ov) {
        <!-- Summary Cards -->
        <section class="section">
          <app-financial-summary [data]="ov" [viewMode]="store.viewMode()" />
        </section>

        <!-- Members Financial Cards -->
        <section class="section">
          <h2 class="section-title">Members</h2>
          <div class="members-grid">
            @for (member of ov.income; track member.userId) {
              <app-member-finance-card
                [income]="member"
                [expenses]="getExpenseForMember(member.userId)"
                [savings]="getSavingsForMember(member.userId)"
                [sharedExpensesShare]="getSharedExpensesShare()"
                [role]="getRoleForMember(member.userId)" />
            }
          </div>
        </section>

        <!-- Charts -->
        <section class="section">
          <h2 class="section-title">Overview</h2>
          <div class="charts-grid">
            <app-income-expense-chart [data]="ov" />
            <app-savings-chart [data]="ov" />
          </div>
        </section>

        <!-- Settlement -->
        <section class="section">
          <app-settlement-summary
            [settlement]="ov.settlement"
            [monthLabel]="store.monthLabel()"
            (markPaid)="store.markSettlementPaid()" />
        </section>
      }

      <!-- Management (collapsible) -->
      <section class="section">
        <app-household-management />
      </section>
    }
  `,
  styles: [`
    .setup-container { max-width: 480px; margin: var(--space-xl) auto; }
    .tab-content { padding: var(--space-lg) 0; }
    .header-actions { display: flex; align-items: center; gap: var(--space-md); flex-wrap: wrap; }
    @media (max-width: 600px) {
      .header-actions { gap: var(--space-sm); }
    }
    .section { margin-bottom: var(--space-lg); }
    .section-title {
      font: var(--mat-sys-title-medium);
      margin: 0 0 var(--space-md);
      color: var(--mat-sys-on-surface);
    }
    .members-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: var(--space-md);
    }
    .charts-grid {
      display: grid;
      grid-template-columns: 3fr 2fr;
      gap: var(--space-md);
      overflow: hidden;
    }
    @media (max-width: 1024px) {
      .charts-grid { grid-template-columns: 1fr; }
    }
    .has-pending {
      border-color: var(--mat-sys-error);
      color: var(--mat-sys-error);
      animation: pulse-border 2s ease-in-out infinite;
    }
    @keyframes pulse-border {
      0%, 100% { box-shadow: 0 0 0 0 transparent; }
      50% { box-shadow: 0 0 0 3px color-mix(in srgb, var(--mat-sys-error) 25%, transparent); }
    }
  `],
})
export class HouseholdDetailComponent implements OnInit {
  readonly store = inject(HouseholdStore);
  readonly approvalStore = inject(ApprovalStore);

  ngOnInit(): void {
    this.store.loadHousehold();
    this.approvalStore.loadPending();
  }

  getExpenseForMember(userId: string) {
    return this.store.overview()?.expenses.personalExpenses.find(e => e.userId === userId) ?? null;
  }

  getSavingsForMember(userId: string) {
    return this.store.overview()?.savings.members.find(s => s.userId === userId) ?? null;
  }

  getSharedExpensesShare(): number {
    const ov = this.store.overview();
    if (!ov) return 0;
    const memberCount = ov.income.length || 1;
    return Math.round((ov.expenses.sharedExpensesTotal / memberCount) * 100) / 100;
  }

  getRoleForMember(userId: string) {
    return this.store.members().find(m => m.userId === userId)?.role ?? null;
  }
}
