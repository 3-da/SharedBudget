import { Component, input, computed } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { ChartConfiguration } from 'chart.js';
import { BaseChartComponent } from '../../../shared/components/base-chart.component';
import { DashboardOverview } from '../../../shared/models/dashboard.model';

@Component({
  selector: 'app-savings-chart',
  standalone: true,
  imports: [MatCardModule, BaseChartComponent],
  template: `
    <mat-card>
      <mat-card-header>
        <mat-card-title>Savings Breakdown</mat-card-title>
        <mat-card-subtitle>Per member</mat-card-subtitle>
      </mat-card-header>
      <mat-card-content>
        <app-base-chart [config]="chartConfig()" />
      </mat-card-content>
    </mat-card>
  `,
})
export class SavingsChartComponent {
  readonly data = input.required<DashboardOverview>();

  readonly chartConfig = computed((): ChartConfiguration => {
    const ov = this.data();
    const members = ov.savings.members;

    return {
      type: 'doughnut',
      data: {
        labels: members.map(m => `${m.firstName} ${m.lastName}`),
        datasets: [{
          data: members.map(m => Math.max(0, m.currentSavings)),
          backgroundColor: [
            'rgba(0, 137, 123, 0.7)',
            'rgba(30, 136, 229, 0.7)',
            'rgba(249, 168, 37, 0.7)',
            'rgba(142, 36, 170, 0.7)',
          ],
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.label}: €${ctx.parsed.toFixed(2)}`,
            },
          },
        },
      },
    };
  });
}
