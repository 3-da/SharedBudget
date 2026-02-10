import { Component, input, computed, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { ChartConfiguration } from 'chart.js';
import { BaseChartComponent } from '../../../shared/components/base-chart.component';
import { DashboardOverview } from '../../../shared/models/dashboard.model';

type SavingsViewMode = 'total' | 'personal' | 'shared';

@Component({
  selector: 'app-savings-chart',
  standalone: true,
  imports: [MatCardModule, MatButtonToggleModule, BaseChartComponent],
  template: `
    <mat-card>
      <mat-card-header>
        <mat-card-title>Savings Breakdown</mat-card-title>
        <mat-card-subtitle>Per member</mat-card-subtitle>
      </mat-card-header>
      <mat-card-content>
        <mat-button-toggle-group [value]="viewMode()" (change)="viewMode.set($event.value)">
          <mat-button-toggle value="total">Total</mat-button-toggle>
          <mat-button-toggle value="personal">Personal</mat-button-toggle>
          <mat-button-toggle value="shared">Shared</mat-button-toggle>
        </mat-button-toggle-group>
        <app-base-chart [config]="chartConfig()" />
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    mat-button-toggle-group { margin-bottom: 12px; }
  `],
})
export class SavingsChartComponent {
  readonly data = input.required<DashboardOverview>();
  readonly viewMode = signal<SavingsViewMode>('total');

  readonly chartConfig = computed((): ChartConfiguration => {
    const ov = this.data();
    const members = ov.savings.members;
    const mode = this.viewMode();

    const getData = (m: typeof members[0]): number => {
      switch (mode) {
        case 'personal': return Math.max(0, m.personalSavings);
        case 'shared': return Math.max(0, m.sharedSavings);
        default: return Math.max(0, m.personalSavings + m.sharedSavings);
      }
    };

    return {
      type: 'doughnut',
      data: {
        labels: members.map(m => `${m.firstName} ${m.lastName}`),
        datasets: [{
          data: members.map(getData),
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
