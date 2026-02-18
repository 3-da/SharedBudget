import { ChangeDetectionStrategy, Component, input, computed, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { ChartConfiguration } from 'chart.js';
import { BaseChartComponent } from '../../../shared/components/base-chart.component';
import { DashboardOverview } from '../../../shared/models/dashboard.model';
import { cssVar } from '../../../shared/utils/chart-colors';

type SavingsViewMode = 'total' | 'personal' | 'shared';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-savings-chart',
  standalone: true,
  imports: [MatCardModule, MatButtonToggleModule, BaseChartComponent],
  template: `
    <mat-card style="height: 100%">
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
    mat-card-content { flex: 1; min-height: 0; display: flex; flex-direction: column; }
    mat-button-toggle-group { margin-bottom: 12px; flex-shrink: 0; }
    app-base-chart { flex: 1; min-height: 0; }
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
            cssVar('--chart-1'),
            cssVar('--chart-4'),
            cssVar('--chart-3'),
            cssVar('--chart-2'),
          ],
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
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
