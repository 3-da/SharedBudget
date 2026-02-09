import { Component, input, computed } from '@angular/core';
import { ChartConfiguration } from 'chart.js';
import { BaseChartComponent } from '../../../shared/components/base-chart.component';
import { SalaryResponse } from '../../../shared/models/salary.model';

@Component({
  selector: 'app-salary-chart',
  standalone: true,
  imports: [BaseChartComponent],
  template: `<app-base-chart [config]="chartConfig()" />`,
  styles: [`:host { display: block; height: 300px; }`],
})
export class SalaryChartComponent {
  readonly salaries = input.required<SalaryResponse[]>();

  private readonly months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  readonly chartConfig = computed<ChartConfiguration>(() => {
    const data = this.salaries();
    const monthMap = new Map(data.map(s => [s.month, s]));
    const labels = this.months;
    const defaults = labels.map((_, i) => monthMap.get(i + 1)?.defaultAmount ?? 0);
    const currents = labels.map((_, i) => monthMap.get(i + 1)?.currentAmount ?? 0);

    return {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Default', data: defaults, backgroundColor: 'rgba(0,188,212,0.6)' },
          { label: 'Current', data: currents, backgroundColor: 'rgba(255,152,0,0.6)' },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } },
        scales: { y: { beginAtZero: true } },
      },
    };
  });
}
