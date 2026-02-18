import {
  Component, input, effect, ElementRef, viewChild,
  OnDestroy, ChangeDetectionStrategy,
} from '@angular/core';
import { Chart, ChartConfiguration, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-base-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<canvas #chartCanvas></canvas>`,
  styles: [`:host { display: block; position: relative; height: 100%; }`],
})
export class BaseChartComponent implements OnDestroy {
  readonly config = input.required<ChartConfiguration>();

  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('chartCanvas');
  private chart: Chart | null = null;

  constructor() {
    effect(() => {
      const cfg = this.config();
      const canvas = this.canvasRef();
      if (!canvas) return;

      if (this.chart) {
        this.chart.destroy();
      }
      this.chart = new Chart(canvas.nativeElement, cfg);
    });
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }
}
