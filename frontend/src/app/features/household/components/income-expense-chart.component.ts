import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { ChartConfiguration } from 'chart.js';
import { BaseChartComponent } from '../../../shared/components/base-chart.component';
import { DashboardOverview } from '../../../shared/models/dashboard.model';
import { cssVar } from '../../../shared/utils/chart-colors';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-income-expense-chart',
  standalone: true,
  imports: [MatCardModule, BaseChartComponent],
  template: `
    <mat-card style="height: 100%">
      <mat-card-header>
        <mat-card-title>Income vs Expenses</mat-card-title>
        <mat-card-subtitle>Current month breakdown</mat-card-subtitle>
      </mat-card-header>
      <mat-card-content>
        <app-base-chart [config]="chartConfig()" />
      </mat-card-content>
    </mat-card>
  `,
})
export class IncomeExpenseChartComponent {
  readonly data = input.required<DashboardOverview>();

  readonly chartConfig = computed((): ChartConfiguration => {
    const ov = this.data();
    const memberLabels = ov.income.map(m => `${m.firstName} ${m.lastName}`);

    const salaries = ov.income.map(m => m.currentSalary);
    const personalExpenses = ov.income.map(m => {
      const exp = ov.expenses.personalExpenses.find(e => e.userId === m.userId);
      return exp?.personalExpensesTotal ?? 0;
    });
    const sharedShare = ov.expenses.sharedExpensesTotal / (ov.income.length || 1);
    const sharedPerMember = ov.income.map(() => Math.round(sharedShare * 100) / 100);

    return {
      type: 'bar',
      data: {
        labels: memberLabels,
        datasets: [
          {
            label: 'Salary',
            data: salaries,
            backgroundColor: cssVar('--chart-1'),
            borderColor: cssVar('--chart-1-border'),
            borderWidth: 1,
          },
          {
            label: 'Personal Expenses',
            data: personalExpenses,
            backgroundColor: cssVar('--chart-2'),
            borderColor: cssVar('--chart-2-border'),
            borderWidth: 1,
          },
          {
            label: 'Shared Expenses (share)',
            data: sharedPerMember,
            backgroundColor: cssVar('--chart-3'),
            borderColor: cssVar('--chart-3-border'),
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) => `€${value}`,
            },
          },
        },
      },
    };
  });
}
