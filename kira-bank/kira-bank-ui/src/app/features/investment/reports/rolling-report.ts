import {ChangeDetectionStrategy, Component, computed, inject, input} from '@angular/core';
import {LanguageService} from '../../../core/i18n/language.service';
import {InvestmentRollingReport} from '../../../shared/models/api.models';
import {formatMoney, REPORT_STYLES} from './report-format';

@Component({
  selector: 'app-rolling-report',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel">
      <header class="head"><h2>{{ i18n.t('investmentReports.tab.rolling') }}</h2></header>
      <div class="metrics">
        <article><small>{{ i18n.t('investmentReports.rolling.latest7') }}</small><strong [class.pos]="data().latest7 >= 0" [class.neg]="data().latest7 < 0">{{ money(data().latest7) }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.rolling.latest30') }}</small><strong [class.pos]="data().latest30 >= 0" [class.neg]="data().latest30 < 0">{{ money(data().latest30) }}</strong></article>
        @if (data().best7 !== null) { <article><small>{{ i18n.t('investmentReports.rolling.best7') }}</small><strong>{{ money(data().best7!) }}</strong></article> }
        @if (data().worst7 !== null) { <article><small>{{ i18n.t('investmentReports.rolling.worst7') }}</small><strong>{{ money(data().worst7!) }}</strong></article> }
        <article><small>{{ i18n.t('investmentReports.rolling.avgDaily') }}</small><strong>{{ money(data().averageDailyNet) }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.rolling.volatility') }}</small><strong>{{ money(data().volatility) }}</strong></article>
      </div>
      <p class="hint">{{ i18n.t('investmentReports.rolling.volatilityHint') }}</p>
      <div class="scroll"><svg class="curve" viewBox="0 0 100 40" preserveAspectRatio="none" role="img" [attr.aria-label]="i18n.t('investmentReports.tab.rolling')">
        <line class="zero-line" x1="0" x2="100" [attr.y1]="zeroY()" [attr.y2]="zeroY()"/>
        <polyline class="l30" [attr.points]="line('rolling30')"/>
        <polyline class="l7" [attr.points]="line('rolling7')"/>
      </svg></div>
      <div class="axis"><small>{{ data().points[0]?.date }}</small><small>{{ money(range().min) }} … {{ money(range().max) }}</small><small>{{ data().points.at(-1)?.date }}</small></div>
      <div class="legend"><span class="k l7"></span>{{ i18n.t('investmentReports.rolling.line7') }}<span class="k l30"></span>{{ i18n.t('investmentReports.rolling.line30') }}</div>
    </section>`,
  styles: REPORT_STYLES + `
    .hint { color:var(--muted); font-size:12px; }
    .curve { display:block; width:100%; min-width:520px; height:200px; overflow:visible; }
    .zero-line { stroke:var(--border); stroke-width:.4; stroke-dasharray:2 2; vector-effect:non-scaling-stroke; }
    polyline { fill:none; vector-effect:non-scaling-stroke; }.l7 { stroke:#2563eb; stroke-width:1.5; }.l30 { stroke:#f59e0b; stroke-width:1.5; }
    .axis { display:flex; justify-content:space-between; gap:8px; margin-top:4px; color:var(--muted); font-size:10px; }
    .legend { display:flex; gap:8px 14px; align-items:center; margin-top:8px; color:var(--muted); font-size:11px; }.k { width:10px; height:3px; }.k.l7 { background:#2563eb; }.k.l30 { background:#f59e0b; }`
})
export class RollingReportComponent {
  readonly i18n = inject(LanguageService);
  readonly data = input.required<InvestmentRollingReport>();
  readonly currency = input.required<string>();
  readonly range = computed(() => {
    const values = this.data().points.flatMap(p => [p.rolling7, p.rolling30]);
    const max = Math.max(0, ...values), min = Math.min(0, ...values);
    return {min, max, span: max === min ? 1 : max - min};
  });
  readonly zeroY = computed(() => this.y(0));
  line(field: 'rolling7' | 'rolling30'): string {
    const pts = this.data().points;
    return pts.length === 1 ? `0,${this.y(pts[0][field])} 100,${this.y(pts[0][field])}`
      : pts.map((p, i) => `${i / (pts.length - 1) * 100},${this.y(p[field])}`).join(' ');
  }
  money(amount: number): string { return formatMoney(this.i18n.locale(), this.currency(), amount); }
  private y(value: number): number { const {min, span} = this.range(); return 38 - ((value - min) / span) * 36; }
}
