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
// [token, light fallback, dark fallback]: the fallbacks only matter where styles.scss is not loaded (tests).
const RESULT_TOKENS: Record<string, [string, string, string]> = {
  WIN: ['--mm-win', '#047857', '#34d399'], HALF_WIN: ['--mm-half-win', '#10b981', '#1f8f6b'],
  PUSH: ['--mm-void', '#8a96a8', '#7b86a8'], VOID: ['--mm-void', '#8a96a8', '#7b86a8'],
  HALF_LOSS: ['--mm-half-loss', '#fb7185', '#b8506a'], LOSS: ['--mm-loss', '#be123c', '#fb7185'],
  PENDING: ['--mm-pending', '#9a6200', '#fbbf24'],
};
const SERIES_TOKENS: [string, string][] = [
  ['#4f46e5', '#818cf8'], ['#0891b2', '#22d3ee'], ['#c98a00', '#fbbf24'], ['#7b4bb3', '#c084fc'],
  ['#d1603d', '#fb923c'], ['#3a9fb0', '#2dd4bf'], ['#5b6779', '#94a3b8'], ['#a3476f', '#f472b6'],
];
/**
 * Theme colours for chart data, refreshed in place whenever the theme changes. Pages that bake a colour into a dataset
 * keep the old theme's value until their data is rebuilt: pass a function (`backgroundColor: () => RESULT_COLORS['WIN']`,
 * `borderColor: () => SERIES[0]`) and Chart.js re-reads it on every update, so a light/dark switch recolours the chart.
 */
export const RESULT_COLORS: Record<string, string> = {};
/** Eight categorical series colours; `SERIES[0]` is the accent (readable on dark cards too). */
export const SERIES: string[] = SERIES_TOKENS.map(() => '');

/** Text, grid and slice-gap colours from the current theme (styles.scss follows the OS setting). */
function applyTheme(): void {
  const dark = darkQuery?.matches ?? false;
  for (const [k, [name, light, darkFallback]] of Object.entries(RESULT_TOKENS)) RESULT_COLORS[k] = token(name, dark ? darkFallback : light);
  SERIES_TOKENS.forEach(([light, darkFallback], i) => { SERIES[i] = token(`--mm-series-${i + 1}`, dark ? darkFallback : light); });
  Chart.defaults.plugins.tooltip.borderColor = token('--mm-line-2', 'rgba(255, 255, 255, .18)');   // the navy tooltip blends into dark cards without an edge
  Chart.defaults.plugins.tooltip.borderWidth = dark ? 1 : 0;
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
