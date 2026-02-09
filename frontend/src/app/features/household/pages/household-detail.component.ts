import { Component, inject, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTabsModule } from '@angular/material/tabs';
import { RouterLink } from '@angular/router';
import { HouseholdStore } from '../stores/household.store';
import { CreateHouseholdFormComponent } from '../components/create-household-form.component';
import { JoinByCodeFormComponent } from '../components/join-by-code-form.component';
import { FinancialSummaryComponent } from '../components/financial-summary.component';
import { MemberFinanceCardComponent } from '../components/member-finance-card.component';
import { SettlementSummaryComponent } from '../components/settlement-summary.component';
import { HouseholdManagementComponent } from '../components/household-management.component';
import { IncomeExpenseChartComponent } from '../components/income-expense-chart.component';
import { SavingsChartComponent } from '../components/savings-chart.component';
import { PageHeaderComponent } from '../../../shared/components/page-header.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner.component';

@Component({
  selector: 'app-household-detail',
  standalone: true,
  imports: [
    MatButtonModule, MatIconModule, MatBadgeModule, MatTabsModule, RouterLink,
    CreateHouseholdFormComponent, JoinByCodeFormComponent,
    FinancialSummaryComponent, MemberFinanceCardComponent,
    SettlementSummaryComponent, HouseholdManagementComponent,
    IncomeExpenseChartComponent, SavingsChartComponent,
    PageHeaderComponent, LoadingSpinnerComponent,
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
          @if (store.overview()?.pendingApprovalsCount; as count) {
            <button mat-stroked-button routerLink="/approvals" [matBadge]="count" matBadgeColor="warn">
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
          <app-financial-summary [data]="ov" />
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
                [isSelf]="member.userId === store.currentUserId()" />
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
    .setup-container { max-width: 480px; margin: 32px auto; }
    .tab-content { padding: 24px 0; }
    .header-actions { display: flex; align-items: center; gap: var(--space-md); }
    .section { margin-bottom: var(--space-lg); }
    .section-title {
      font: var(--mat-sys-title-medium);
      margin: 0 0 var(--space-md);
      color: var(--mat-sys-on-surface);
    }
    .members-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: var(--space-md);
    }
    .charts-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: var(--space-md);
    }
    @media (max-width: 768px) { .charts-grid { grid-template-columns: 1fr; } }
  `],
})
export class HouseholdDetailComponent implements OnInit {
  readonly store = inject(HouseholdStore);

  ngOnInit(): void {
    this.store.loadHousehold();
  }

  getExpenseForMember(userId: string) {
    return this.store.overview()?.expenses.personalExpenses.find(e => e.userId === userId) ?? null;
  }

  getSavingsForMember(userId: string) {
    return this.store.overview()?.savings.members.find(s => s.userId === userId) ?? null;
  }
}
