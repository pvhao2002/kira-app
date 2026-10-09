import {ChangeDetectionStrategy, Component, inject, input, output, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {LanguageService} from '../../../core/i18n/language.service';
import {InvestmentGoalProgress, InvestmentGoalsReport} from '../../../shared/models/api.models';
import {formatMoney, REPORT_STYLES} from './report-format';

@Component({
  selector: 'app-goals-report',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel">
      <header class="head"><h2>{{ i18n.t('investmentReports.tab.goals') }}</h2><small>{{ i18n.t('investmentReports.projection.asOf') }}: {{ data().asOf }}</small></header>
      <p class="hint">{{ i18n.t('investmentReports.goals.hint') }}</p>
      @if (!data().goals.length) { <div class="empty">{{ i18n.t('investmentReports.goals.none') }}</div> }
      @for (goal of data().goals; track goal.id) {
        <article class="goal">
          <div class="row"><strong>{{ i18n.t('investmentReports.goals.' + goal.period.toLowerCase()) }} · {{ money(goal.target) }}</strong>
            <span class="badge" [class.ok]="goal.reached || goal.onTrack" [class.late]="!goal.reached && !goal.onTrack">{{ status(goal) }}</span>
            <button class="btn ghost" type="button" (click)="remove.emit(goal.id)">{{ i18n.t('investmentReports.goals.delete') }}</button></div>
          <div class="track" role="progressbar" [attr.aria-valuenow]="clamp(goal.pct)" aria-valuemin="0" aria-valuemax="100" [attr.aria-label]="goal.pct + '%'">
            <i class="fill" [style.width.%]="clamp(goal.pct)"></i><i class="mark" [style.left.%]="clamp(goal.elapsedPct)" [title]="i18n.t('investmentReports.goals.elapsed') + ' ' + goal.elapsedPct + '%'"></i></div>
          <small>{{ i18n.t('investmentReports.goals.achieved') }} {{ money(goal.achieved) }} ({{ goal.pct }}%) · {{ i18n.t('investmentReports.goals.elapsed') }} {{ goal.elapsedPct }}% ·
            {{ i18n.t('investmentReports.goals.remaining') }} {{ money(goal.remaining) }} · {{ i18n.t('investmentReports.goals.requiredDaily') }} {{ money(goal.requiredDaily) }} · {{ goal.daysRemaining }}d</small>
        </article>
      }
      <h3>{{ i18n.t('investmentReports.goals.set') }} ({{ currency() }})</h3>
      <form class="form" (ngSubmit)="submit()">
        <label><span>{{ i18n.t('investmentReports.goals.period') }}</span>
          <select [ngModel]="period()" (ngModelChange)="period.set($event)" name="period"><option value="MONTH">{{ i18n.t('investmentReports.goals.month') }}</option><option value="YEAR">{{ i18n.t('investmentReports.goals.year') }}</option></select></label>
        <label><span>{{ i18n.t('investmentReports.goals.target') }}</span><input type="number" min="0" step="any" name="target" [ngModel]="target()" (ngModelChange)="target.set($event)"/></label>
        <button class="btn primary" type="submit" [disabled]="!(target() > 0)">{{ i18n.t('investmentReports.goals.save') }}</button>
      </form>
    </section>`,
  styles: REPORT_STYLES + `
    .hint { color:var(--muted); font-size:12px; }.empty { padding:16px; color:var(--muted); text-align:center; }
    .goal { margin:14px 0; padding:12px; border:1px solid var(--border); border-radius:10px; }.goal small { display:block; margin-top:8px; color:var(--muted); font-size:11px; line-height:1.5; }
    .row { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }.row strong { flex:1; }
    .badge { padding:3px 8px; border-radius:999px; font-size:10px; font-weight:700; }.badge.ok { background:#dcfce7; color:#166534; }.badge.late { background:#fef3c7; color:#92400e; }
    .track { position:relative; height:10px; margin-top:10px; border-radius:5px; background:var(--border); }
    .fill { position:absolute; inset:0 auto 0 0; border-radius:5px; background:#2563eb; }.mark { position:absolute; top:-3px; bottom:-3px; width:2px; background:var(--navy); }
    .form { display:flex; flex-wrap:wrap; gap:12px; align-items:flex-end; }.form label { display:grid; gap:5px; color:var(--muted); font-size:11px; }
    .form input,.form select { min-height:38px; padding:7px 10px; border:1px solid var(--border); border-radius:8px; background:var(--surface); color:var(--navy); }`
})
export class GoalsReportComponent {
  readonly i18n = inject(LanguageService);
  readonly data = input.required<InvestmentGoalsReport>();
  readonly currency = input.required<string>();
  readonly save = output<{currency: string; period: string; targetAmount: number}>();
  readonly remove = output<number>();
  readonly period = signal('MONTH');
  readonly target = signal(0);
  clamp(value: number): number { return Math.min(100, Math.max(0, value)); }
  status(goal: InvestmentGoalProgress): string {
    return this.i18n.t(goal.reached ? 'investmentReports.goals.reached' : goal.onTrack ? 'investmentReports.goals.onTrack' : 'investmentReports.goals.behind');
  }
  submit(): void {
    if (this.target() > 0) this.save.emit({currency: this.currency(), period: this.period(), targetAmount: Number(this.target())});
  }
  money(amount: number): string { return formatMoney(this.i18n.locale(), this.currency(), amount); }
}
