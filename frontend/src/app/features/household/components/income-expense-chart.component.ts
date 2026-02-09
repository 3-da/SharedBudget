import { Component, input, computed } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { ChartConfiguration } from 'chart.js';
import { BaseChartComponent } from '../../../shared/components/base-chart.component';
import { DashboardOverview } from '../../../shared/models/dashboard.model';

@Component({
  selector: 'app-income-expense-chart',
  standalone: true,
  imports: [MatCardModule, BaseChartComponent],
  template: `
    <mat-card>
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
            backgroundColor: 'rgba(0, 137, 123, 0.7)',
            borderColor: 'rgb(0, 137, 123)',
            borderWidth: 1,
          },
          {
            label: 'Personal Expenses',
            data: personalExpenses,
            backgroundColor: 'rgba(229, 57, 53, 0.7)',
            borderColor: 'rgb(229, 57, 53)',
            borderWidth: 1,
          },
          {
            label: 'Shared Expenses (share)',
            data: sharedPerMember,
            backgroundColor: 'rgba(249, 168, 37, 0.7)',
            borderColor: 'rgb(249, 168, 37)',
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
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
