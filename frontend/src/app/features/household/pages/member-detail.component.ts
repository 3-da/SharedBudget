import { Component, inject, OnInit, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { HouseholdStore } from '../stores/household.store';
import { PageHeaderComponent } from '../../../shared/components/page-header.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state.component';
import { CurrencyEurPipe } from '../../../shared/pipes/currency-eur.pipe';

@Component({
  selector: 'app-member-detail',
  standalone: true,
  imports: [
    MatCardModule, MatButtonModule, MatIconModule, MatDividerModule,
    PageHeaderComponent, LoadingSpinnerComponent, EmptyStateComponent, CurrencyEurPipe,
  ],
  template: `
    @if (store.overviewLoading() || store.loading()) {
      <app-loading-spinner />
    } @else if (isSelf()) {
      <app-empty-state icon="block" title="Cannot view own profile" description="Navigate to the relevant pages to see your own data.">
        <button mat-flat-button (click)="goBack()">
          <mat-icon>arrow_back</mat-icon> Back to Household
        </button>
      </app-empty-state>
    } @else if (memberIncome(); as member) {
      <app-page-header [title]="member.firstName + ' ' + member.lastName" subtitle="Member Details">
        <button mat-icon-button (click)="goBack()"><mat-icon>arrow_back</mat-icon></button>
      </app-page-header>

      <div class="detail-grid">
        <!-- Salary -->
        <mat-card>
          <mat-card-header>
            <mat-icon matCardAvatar class="icon-salary">payments</mat-icon>
            <mat-card-title>Salary</mat-card-title>
            <mat-card-subtitle>{{ store.monthLabel() }}</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <div class="stat-row">
              <span class="stat-label">Default salary</span>
              <span class="stat-value">{{ member.defaultSalary | currencyEur }}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Current salary</span>
              <span class="stat-value">{{ member.currentSalary | currencyEur }}</span>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- Expenses -->
        <mat-card>
          <mat-card-header>
            <mat-icon matCardAvatar class="icon-expenses">receipt_long</mat-icon>
            <mat-card-title>Personal Expenses</mat-card-title>
            <mat-card-subtitle>Monthly total</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <div class="stat-row">
              <span class="stat-label">Total personal expenses</span>
              <span class="stat-value">{{ memberExpenseTotal() | currencyEur }}</span>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- Savings -->
        <mat-card>
          <mat-card-header>
            <mat-icon matCardAvatar class="icon-savings">savings</mat-icon>
            <mat-card-title>Savings</mat-card-title>
            <mat-card-subtitle>Income minus expenses</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <div class="stat-row">
              <span class="stat-label">Default savings</span>
              <span class="stat-value">{{ memberSavingsDefault() | currencyEur }}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Current savings</span>
              <span class="stat-value" [class]="memberSavingsCurrent() >= 0 ? 'positive' : 'negative'">
                {{ memberSavingsCurrent() | currencyEur }}
              </span>
            </div>
          </mat-card-content>
        </mat-card>
      </div>
    } @else {
      <app-empty-state icon="person_off" title="Member not found" description="This member does not exist or is not in your household.">
        <button mat-flat-button (click)="goBack()">
          <mat-icon>arrow_back</mat-icon> Back to Household
        </button>
      </app-empty-state>
    }
  `,
  styles: [`
    .detail-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: var(--space-md);
    }
    mat-icon[matCardAvatar] {
      border-radius: 50%;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .icon-salary { background: color-mix(in srgb, var(--color-positive) 15%, transparent); color: var(--color-positive); }
    .icon-expenses { background: color-mix(in srgb, var(--color-negative) 15%, transparent); color: var(--color-negative); }
    .icon-savings { background: color-mix(in srgb, var(--color-info) 15%, transparent); color: var(--color-info); }
    .stat-row { display: flex; justify-content: space-between; padding: 8px 0; }
    .stat-label { color: var(--mat-sys-on-surface-variant); }
    .stat-value { font-weight: 500; }
    .positive { color: var(--color-positive); }
    .negative { color: var(--color-negative); }
  `],
})
export class MemberDetailComponent implements OnInit {
  readonly store = inject(HouseholdStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private userId = '';

  readonly isSelf = computed(() => this.userId === this.store.currentUserId());

  readonly memberIncome = computed(() =>
    this.store.overview()?.income.find(m => m.userId === this.userId) ?? null,
  );

  readonly memberExpenseTotal = computed(() =>
    this.store.overview()?.expenses.personalExpenses.find(e => e.userId === this.userId)?.personalExpensesTotal ?? 0,
  );

  readonly memberSavingsDefault = computed(() =>
    this.store.overview()?.savings.members.find(s => s.userId === this.userId)?.defaultSavings ?? 0,
  );

  readonly memberSavingsCurrent = computed(() =>
    this.store.overview()?.savings.members.find(s => s.userId === this.userId)?.currentSavings ?? 0,
  );

  ngOnInit(): void {
    this.userId = this.route.snapshot.paramMap.get('userId') ?? '';
    if (!this.store.hasHousehold()) {
      this.store.loadHousehold();
    } else if (!this.store.overview()) {
      this.store.loadOverview();
    }
  }

  goBack(): void {
    this.router.navigate(['/household']);
  }
}
