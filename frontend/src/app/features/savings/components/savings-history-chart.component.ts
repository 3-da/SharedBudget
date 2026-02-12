import { Component, input, computed, ChangeDetectionStrategy } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { ChartConfiguration } from 'chart.js';
import { BaseChartComponent } from '../../../shared/components/base-chart.component';
import { SavingsHistoryItem } from '../../../shared/models/dashboard.model';

@Component({
  selector: 'app-savings-history-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatCardModule, MatIconModule, BaseChartComponent],
  template: `
    <mat-card>
      <mat-card-header>
        <mat-icon matCardAvatar>show_chart</mat-icon>
        <mat-card-title>Savings History</mat-card-title>
        <mat-card-subtitle>Personal and shared savings over the past 12 months</mat-card-subtitle>
      </mat-card-header>
      <mat-card-content>
        @if (items().length > 0) {
          <app-base-chart [config]="chartConfig()" />
        } @else {
          <p class="no-data">No savings data available yet.</p>
        }
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    mat-icon[matCardAvatar] {
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
      border-radius: 50%; width: 40px; height: 40px;
      display: flex; align-items: center; justify-content: center; font-size: 24px;
    }
    app-base-chart { height: 300px; }
    .no-data { text-align: center; color: var(--mat-sys-on-surface-variant); padding: 32px 0; }
  `],
})
export class SavingsHistoryChartComponent {
  readonly items = input.required<SavingsHistoryItem[]>();

  readonly chartConfig = computed<ChartConfiguration>(() => {
    const data = this.items();
    const labels = data.map(item => {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${monthNames[item.month - 1]} '${String(item.year).slice(2)}`;
    });

    return {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Personal',
            data: data.map(d => d.personalSavings),
            borderColor: 'rgba(0, 188, 212, 0.8)',
            backgroundColor: 'rgba(0, 188, 212, 0.1)',
            fill: true,
            tension: 0.3,
            pointRadius: 4,
            pointHoverRadius: 6,
          },
          {
            label: 'Shared',
            data: data.map(d => d.sharedSavings),
            borderColor: 'rgba(255, 152, 0, 0.8)',
            backgroundColor: 'rgba(255, 152, 0, 0.1)',
            fill: true,
            tension: 0.3,
            pointRadius: 4,
            pointHoverRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) => `${value} EUR`,
            },
          },
        },
      },
    };
  });
}
