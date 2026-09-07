import {ChangeDetectionStrategy, Component, inject, input, output} from '@angular/core';
import {LanguageService} from '../../core/i18n/language.service';

@Component({
  selector: 'app-dashboard-status',
  template: `
    <div aria-live="polite">
      @if (loading()) { <span>{{ i18n.t('overview.loading') }}</span> }
      @if (failed()) {
        <span role="alert">{{ i18n.t('overview.loadFailed') }}</span>
        <button type="button" [disabled]="loading()" (click)="retry.emit()">{{ i18n.t('overview.retry') }}</button>
      }
      @if (updatedAt()) { <small>{{ i18n.t('overview.updated') }} {{ timestamp() }}</small> }
    </div>`,
  styles: [`:host{display:block}div{display:flex;flex-wrap:wrap;align-items:center;gap:8px;color:var(--muted);font-size:12px}div:not(:empty){margin:8px 0}small{font-size:11px}button{border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--navy);min-height:32px;padding:4px 10px;cursor:pointer}`],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardStatusComponent {
  readonly i18n = inject(LanguageService);
  readonly loading = input(false);
  readonly failed = input(false);
  readonly updatedAt = input<string | null>(null);
  readonly retry = output<void>();
  timestamp(): string {
    return new Intl.DateTimeFormat(this.i18n.language() === 'vi' ? 'vi-VN' : 'en-US', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh'
    }).format(new Date(this.updatedAt()!));
  }
}
