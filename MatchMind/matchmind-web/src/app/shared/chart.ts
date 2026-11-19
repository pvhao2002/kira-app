// Chart.js (MIT) wrapper, kept out of kit.ts so only chart pages load Chart.js.
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterRenderEffect, inject, input, viewChild } from '@angular/core';
import { Chart, ChartConfiguration, registerables } from 'chart.js';

Chart.register(...registerables);
Chart.defaults.font.family = "'IBM Plex Sans', system-ui, sans-serif";
Chart.defaults.color = '#536074';

@Component({
  selector: 'mm-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'chart-box' },
  template: `<canvas #c role="img" [attr.aria-label]="label()"></canvas>`,
})
export class ChartView {
  readonly type = input.required<ChartConfiguration['type']>();
  readonly data = input.required<ChartConfiguration['data']>();
  readonly options = input<ChartConfiguration['options']>({});
  readonly label = input('Chart');
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('c');
  private chart?: Chart;

  constructor() {
    afterRenderEffect(() => {
      const config = { type: this.type(), data: this.data(), options: { maintainAspectRatio: false, ...this.options() } } as ChartConfiguration;
      this.chart?.destroy();
      this.chart = new Chart(this.canvas().nativeElement, config);
    });
    inject(DestroyRef).onDestroy(() => this.chart?.destroy());
  }
}
