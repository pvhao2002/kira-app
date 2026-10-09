import {ChangeDetectionStrategy, Component, computed, inject, input} from '@angular/core';
import {LanguageService} from '../../../core/i18n/language.service';
import {InvestmentEquityReport} from '../../../shared/models/api.models';
import {formatMoney, REPORT_STYLES} from './report-format';

@Component({
  selector: 'app-equity-report',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel">
      <header class="head"><h2>{{ i18n.t('investmentReports.tab.equity') }}</h2></header>
      <div class="metrics">
        <article><small>{{ i18n.t('investmentReports.equity.final') }}</small><strong [class.pos]="data().finalNet >= 0" [class.neg]="data().finalNet < 0">{{ money(data().finalNet) }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.equity.peak') }}</small><strong>{{ money(data().peakNet) }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.equity.maxDrawdown') }}</small><strong class="neg">{{ money(data().maxDrawdown) }}</strong>@if (data().maxDrawdownDate) { <small>{{ data().maxDrawdownDate }}</small> }</article>
        <article><small>{{ i18n.t('investmentReports.equity.currentDrawdown') }}</small><strong>{{ money(data().currentDrawdown) }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.equity.activeDays') }}</small><strong>{{ data().activeDays }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.equity.winDays') }}</small><strong>{{ data().winDays }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.equity.lossDays') }}</small><strong>{{ data().lossDays }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.equity.winRate') }}</small><strong>{{ winRate() }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.equity.longestWin') }}</small><strong>{{ data().longestWinStreak }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.equity.longestLoss') }}</small><strong>{{ data().longestLossStreak }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.equity.currentStreak') }}</small><strong>{{ data().currentStreak }}</strong></article>
        @if (data().bestDay; as day) { <article><small>{{ i18n.t('investmentReports.equity.bestDay') }}</small><strong class="pos">{{ day.date }} · {{ money(day.net) }}</strong></article> }
        @if (data().worstDay; as day) { <article><small>{{ i18n.t('investmentReports.equity.worstDay') }}</small><strong class="neg">{{ day.date }} · {{ money(day.net) }}</strong></article> }
      </div>
      <h3>{{ i18n.t('investmentReports.equity.curve') }}</h3>
      <div class="scroll"><svg class="curve" viewBox="0 0 100 40" preserveAspectRatio="none" role="img" [attr.aria-label]="i18n.t('investmentReports.equity.curve')">
        <line class="zero-line" x1="0" x2="100" [attr.y1]="zeroY()" [attr.y2]="zeroY()"/>
        <polyline class="peak-line" [attr.points]="peakLine()"/>
        <polyline class="net-line" [attr.points]="curveLine()"/>
      </svg></div>
      <div class="axis"><small>{{ firstDate() }}</small><small>{{ i18n.t('investmentReports.equity.range') }}: {{ money(range().min) }} … {{ money(range().max) }}</small><small>{{ lastDate() }}</small></div>
      <div class="legend"><span class="k net"></span>{{ i18n.t('investmentReports.equity.cumulative') }}<span class="k peak"></span>{{ i18n.t('investmentReports.equity.peak') }}</div>
    </section>`,
  styles: REPORT_STYLES + `
    .curve { display:block; width:100%; min-width:520px; height:200px; overflow:visible; }
    .zero-line { stroke:var(--border); stroke-width:.4; stroke-dasharray:2 2; vector-effect:non-scaling-stroke; }
    .net-line { fill:none; stroke:#2563eb; stroke-width:1.5; vector-effect:non-scaling-stroke; }
    .peak-line { fill:none; stroke:#10b981; stroke-width:1; stroke-dasharray:3 3; vector-effect:non-scaling-stroke; }
    .axis { display:flex; justify-content:space-between; gap:8px; margin-top:4px; color:var(--muted); font-size:10px; }
    .legend { display:flex; gap:8px 14px; align-items:center; margin-top:8px; color:var(--muted); font-size:11px; }.k { width:10px; height:3px; }.k.net { background:#2563eb; }.k.peak { background:#10b981; }`
})
export class EquityReportComponent {
  readonly i18n = inject(LanguageService);
  readonly data = input.required<InvestmentEquityReport>();
  readonly currency = input.required<string>();
  readonly range = computed(() => {
    const values = this.data().points.flatMap(p => [p.cumulativeNet, p.peak]);
    const max = Math.max(0, ...values), min = Math.min(0, ...values);
    return {min, max, span: max === min ? 1 : max - min};
  });
  readonly firstDate = computed(() => this.data().points[0]?.date ?? '');
  readonly lastDate = computed(() => this.data().points.at(-1)?.date ?? '');
  readonly winRate = computed(() => {
    const d = this.data(), decided = d.winDays + d.lossDays;
    return decided ? `${(d.winDays / decided * 100).toFixed(1)}%` : '—';
  });
  readonly zeroY = computed(() => this.y(0));
  readonly curveLine = computed(() => this.line(p => p.cumulativeNet));
  readonly peakLine = computed(() => this.line(p => p.peak));
  money(amount: number): string { return formatMoney(this.i18n.locale(), this.currency(), amount); }
  private y(value: number): number { const {min, span} = this.range(); return 38 - ((value - min) / span) * 36; }
  private line(pick: (p: InvestmentEquityReport['points'][number]) => number): string {
    const pts = this.data().points;
    return pts.length === 1 ? `0,${this.y(pick(pts[0]))} 100,${this.y(pick(pts[0]))}` // a single point still needs a visible line
      : pts.map((p, i) => `${i / (pts.length - 1) * 100},${this.y(pick(p))}`).join(' ');
  }
}
