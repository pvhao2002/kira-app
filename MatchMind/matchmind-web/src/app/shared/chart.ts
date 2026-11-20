// Chart.js (MIT) wrapper, kept out of kit.ts so only chart pages load Chart.js.
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterRenderEffect, inject, input, viewChild } from '@angular/core';
import { Chart, ChartConfiguration, registerables } from 'chart.js';

Chart.register(...registerables);
Chart.defaults.font.family = "'IBM Plex Sans', system-ui, sans-serif";
const dark = globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;   // read once; follows the OS setting like styles.scss
Chart.defaults.color = dark ? '#a6b4cc' : '#536074';
Chart.defaults.elements.arc.borderColor = dark ? '#111b2f' : '#fff';   // slice gaps match the card
Chart.defaults.font.size = 12;
Chart.defaults.plugins.tooltip.backgroundColor = '#0f1b33';
Chart.defaults.plugins.tooltip.padding = 10;
Chart.defaults.plugins.tooltip.cornerRadius = 8;
Chart.defaults.plugins.tooltip.boxPadding = 4;
Chart.defaults.plugins.legend.labels.usePointStyle = true;
Chart.defaults.plugins.legend.labels.pointStyle = 'rectRounded';
Chart.defaults.elements.bar.borderRadius = 4;
// Slanted labels are hard to scan: let Chart.js skip ticks instead.
Chart.defaults.set('scale', { ticks: { maxRotation: 0, autoSkipPadding: 12 } });
// Quiet grid: faint horizontal rules only; category (x) axes get none.
Chart.defaults.borderColor = dark ? '#22304a' : '#e6eaf0';
Chart.defaults.set('scales.category', { grid: { display: false } });
// People who ask for less motion get no draw-in animation.
if (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) Chart.defaults.animation = false;

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
  private chartType?: ChartConfiguration['type'];

  constructor() {
    afterRenderEffect(() => {
      const config = { type: this.type(), data: this.data(), options: { maintainAspectRatio: false, ...this.options() } } as ChartConfiguration;
      if (this.chart && this.chartType === config.type) {
        // Same kind of chart with new data: update in place instead of redrawing from scratch.
        this.chart.data = config.data;
        this.chart.options = config.options!;
        this.chart.update();
        return;
      }
      this.chart?.destroy();
      this.chartType = config.type;
      this.chart = new Chart(this.canvas().nativeElement, config);
    });
    inject(DestroyRef).onDestroy(() => this.chart?.destroy());
  }
}
