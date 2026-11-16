import {afterRenderEffect, ChangeDetectionStrategy, Component, computed, DestroyRef, ElementRef, inject, input, viewChild} from '@angular/core';
import {BarController, BarElement, CategoryScale, Chart, Legend, LinearScale, LineController, LineElement, PointElement, Tooltip} from 'chart.js';
import {TimeseriesPoint} from '../core/api/models';
import {formatVnd, LOCALE, numberFormat} from '../core/format/formatters';

Chart.register(BarController, BarElement, LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend);

const compact = (value: number | string) => numberFormat(LOCALE, {notation: 'compact', maximumFractionDigits: 1}).format(Number(value));

/** GMV as bars (left axis) with the three commission buckets as lines (right axis). */
@Component({
  selector: 'app-trend-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative h-64 w-full min-w-0 sm:h-72">
      <canvas #canvas role="img" [attr.aria-label]="summary()" data-testid="trend-chart"></canvas>
    </div>
  `
})
export class TrendChart {
  readonly points = input.required<TimeseriesPoint[]>();
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private chart?: Chart;

  protected readonly summary = computed(() => {
    const points = this.points();
    const gmv = points.reduce((sum, p) => sum + p.gmv, 0);
    return `Biểu đồ xu hướng ${points.length} kỳ: tổng doanh số ${formatVnd(gmv)}, kèm hoa hồng ước tính, đã xác nhận và bị hủy theo từng kỳ.`;
  });

  constructor() {
    afterRenderEffect(() => this.render(this.points()));
    inject(DestroyRef).onDestroy(() => this.chart?.destroy());
  }

  private render(points: TimeseriesPoint[]): void {
    this.chart?.destroy();
    const line = (label: string, data: number[], color: string) =>
      ({type: 'line' as const, label, data, borderColor: color, backgroundColor: color, borderWidth: 2, pointRadius: 2, tension: 0.25, yAxisID: 'commission'});
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.chart = new Chart(this.canvas().nativeElement, {
      type: 'bar',
      data: {
        labels: points.map(p => p.period.split('-').reverse().join('/')),
        datasets: [
          {type: 'bar' as const, label: 'Doanh số (GMV)', data: points.map(p => p.gmv), backgroundColor: '#F7B5A6', borderRadius: 3, yAxisID: 'gmv', order: 1},
          line('Hoa hồng ước tính', points.map(p => p.estimated), '#1D5FA8'),
          line('Hoa hồng đã xác nhận', points.map(p => p.confirmed), '#17734A'),
          line('Hoa hồng bị hủy', points.map(p => p.rejected), '#B42318')
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: reduceMotion ? false : {duration: 250},
        interaction: {mode: 'index', intersect: false},
        plugins: {
          legend: {position: 'bottom', labels: {boxWidth: 10, boxHeight: 10, font: {size: 12}}},
          tooltip: {callbacks: {label: ctx => `${ctx.dataset.label}: ${formatVnd(Number(ctx.parsed.y))}`}}
        },
        scales: {
          x: {grid: {display: false}, ticks: {maxRotation: 0, autoSkip: true, font: {size: 11}}},
          gmv: {position: 'left', beginAtZero: true, ticks: {callback: compact, font: {size: 11}}, grid: {color: '#EEF0F2'}},
          commission: {position: 'right', beginAtZero: true, ticks: {callback: compact, font: {size: 11}}, grid: {display: false}}
        }
      }
    });
  }
}
