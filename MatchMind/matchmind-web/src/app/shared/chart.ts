// Chart.js (MIT) wrapper, kept out of kit.ts so only chart pages load Chart.js.
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterRenderEffect, inject, input, viewChild } from '@angular/core';
import { Chart, ChartConfiguration, registerables } from 'chart.js';

Chart.register(...registerables);
Chart.defaults.font.family = "'IBM Plex Sans', system-ui, sans-serif";

const darkQuery = globalThis.matchMedia?.('(prefers-color-scheme: dark)');
/** The theme's CSS token, or the fallback where styles are not loaded (tests). */
function token(name: string, fallback: string): string {
  return globalThis.getComputedStyle?.(document.documentElement).getPropertyValue(name).trim() || fallback;
}
/** Text, grid and slice-gap colours from the current theme (styles.scss follows the OS setting). */
function applyTheme(): void {
  const dark = darkQuery?.matches ?? false;
  Chart.defaults.color = token('--mm-ink-2', dark ? '#aab2d0' : '#475569');
  Chart.defaults.borderColor = token('--mm-line', dark ? 'rgba(255, 255, 255, .08)' : 'rgba(30, 27, 75, .1)');   // quiet grid: faint rules only
  Chart.defaults.elements.arc.borderColor = token('--mm-card-solid', dark ? '#161b3a' : '#fff');   // slice gaps match the card
}
applyTheme();
// The OS can switch light/dark mid-session (phones do at dusk): recolour every chart on screen.
darkQuery?.addEventListener?.('change', () => {
  applyTheme();
  for (const c of Object.values(Chart.instances)) c.update();
});
Chart.defaults.font.size = 12;
Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(30, 27, 75, .92)';
Chart.defaults.plugins.tooltip.padding = 10;
Chart.defaults.plugins.tooltip.cornerRadius = 8;
Chart.defaults.plugins.tooltip.boxPadding = 4;
Chart.defaults.plugins.legend.labels.usePointStyle = true;
Chart.defaults.plugins.legend.labels.pointStyle = 'rectRounded';
Chart.defaults.elements.bar.borderRadius = 4;
// Slanted labels are hard to scan: let Chart.js skip ticks instead.
Chart.defaults.set('scale', { ticks: { maxRotation: 0, autoSkipPadding: 12 } });
// Category axes get no grid.
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
