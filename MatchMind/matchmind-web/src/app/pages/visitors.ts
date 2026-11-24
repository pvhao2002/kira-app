import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { ApiService } from '../core/api.service';
import { errorMessage, keepPrevious, viewState } from '../core/resource';
import { fmtDateTime } from '../shared/format';
import { Paginator } from '../shared/kit';
import { StateView } from '../shared/ui';

const REGIONS = new Intl.DisplayNames(['en'], { type: 'region' });

/** Cloudflare codes: XX unknown, T1 Tor. */
function countryName(code: string): string {
  if (code === 'XX') return 'Unknown';
  if (code === 'T1') return 'Tor network';
  try { return REGIONS.of(code) ?? code; } catch { return code; }
}

/** One country's visits, newest first, 100 per page. Created only once its section is opened. */
@Component({
  selector: 'mm-country-visits',
  imports: [Paginator, StateView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (data(); as visits) {
      <div class="table-wrap"><table class="dt" [attr.aria-label]="'Visits from ' + country()">
        <thead><tr><th>Time</th><th>IP</th><th>Browser</th><th>OS</th><th>User agent</th></tr></thead>
        <tbody>@for (v of visits.data; track v.id) {
          <tr><td>{{ fmt(v.visitedAt) }}</td><td class="mono">{{ v.ip }}</td><td>{{ v.browser }}</td><td>{{ v.os }}</td>
            <td class="ua" [attr.title]="v.userAgent">{{ v.userAgent || '—' }}</td></tr>
        }</tbody>
      </table></div>
      @if (visits.meta.totalElements > visits.meta.size) {
        <mm-paginator [page]="visits.meta.page" [size]="visits.meta.size" [total]="visits.meta.totalElements"
          [sizes]="[]" unit="visits" (pageChange)="page.set($event.page)" />
      }
    } @else {
      <mm-state [state]="state()" [message]="error()" retryable (retry)="resource.reload()" />
    }`,
  styles: `.ua { max-width: 360px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--mm-ink-3); }`,
})
export class CountryVisits {
  readonly country = input.required<string>();
  readonly page = signal(0);
  readonly resource = inject(ApiService).visitsResource(this.country, this.page);
  readonly data = keepPrevious(this.resource);
  readonly state = viewState(this.resource);
  readonly error = errorMessage(this.resource);
  readonly fmt = fmtDateTime;
}

@Component({
  selector: 'mm-visitors',
  imports: [CountryVisits, StateView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel stack">
      <p class="page-note">People who opened the site while signed out. IP from api.ipify.org, country from Cloudflare,
        browser and OS from the User-Agent. The same visitor within 30 minutes counts once.</p>
      @if (countries.hasValue()) {
        @for (c of countries.value(); track c.country) {
          <details class="country" [attr.data-country]="c.country" (toggle)="toggle(c.country, $event)">
            <summary><strong>{{ name(c.country) }}</strong> <span class="muted">{{ c.country }}</span>
              <span class="muted">· {{ c.visits }} visits · {{ c.uniqueIps }} unique IPs · last {{ fmt(c.lastSeen) }}</span></summary>
            @if (opened().has(c.country)) { <mm-country-visits [country]="c.country" /> }
          </details>
        } @empty { <p class="empty">No visits yet.</p> }
      } @else {
        <mm-state [state]="state()" [message]="error()" retryable (retry)="countries.reload()" />
      }
    </section>`,
  styles: `
    .country { border: 1px solid var(--mm-line); border-radius: 12px; padding: 10px 14px; background: var(--mm-card-solid); }
    .country[open] { padding-bottom: 14px; }
    .country summary { cursor: pointer; min-height: 32px; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
    .country[open] summary { margin-bottom: 10px; }
    .muted { color: var(--mm-ink-3); }
  `,
})
export class VisitorsPage {
  readonly countries = inject(ApiService).visitCountriesResource();
  readonly state = viewState(this.countries);
  readonly error = errorMessage(this.countries);
  /** Countries opened at least once: their list stays loaded while collapsed. */
  readonly opened = signal(new Set<string>());
  readonly name = countryName;
  readonly fmt = fmtDateTime;

  toggle(country: string, event: Event): void {
    if ((event.target as HTMLDetailsElement).open) this.opened.update(s => new Set(s).add(country));
  }
}
