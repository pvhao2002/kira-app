import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../core/api.service';
import { apiError } from '../core/http';
import { ApiLogDetail, ApiLogRow } from '../core/models';
import { safeValue } from '../core/resource';
import { DateInput, DateRange } from '../shared/date-picker';
import { dayRange } from '../shared/filter-bar';
import { fmtDateTime, humanize } from '../shared/format';
import { Dialog, Paginator, SortHeader, ToastService } from '../shared/kit';
import { PagedList } from '../shared/paged-list';
import { Select, SelectOption } from '../shared/select';
import { JsonView, ResultTag, StateView } from '../shared/ui';
import { fromQuery, toQuery } from '../shared/url-state';

@Component({
  selector: 'mm-api-logs',
  imports: [FormsModule, Dialog, Paginator, SortHeader, JsonView, ResultTag, StateView, Select, DateInput, DateRange],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stack">
      <form class="filter-bar" (ngSubmit)="apply()">
        <button type="button" class="filter-toggle" (click)="collapsed.set(!collapsed())" [attr.aria-expanded]="!collapsed()">
          <i class="pi pi-sliders-h" aria-hidden="true"></i> Filters
          @if (activeCount()) { <span class="count">{{ activeCount() }}</span> }
          @if (pending()) { <span class="pending-note">· not applied</span> }
          <i class="pi" [class.pi-chevron-down]="collapsed()" [class.pi-chevron-up]="!collapsed()" aria-hidden="true"></i>
        </button>
        @if (!collapsed()) {
        <div class="filter-fields">
          <input class="input f-search" name="search" [(ngModel)]="search" placeholder="Request, event id or error" aria-label="Search logs" />
          <mm-date-range label="Received">
            <mm-date-input name="from" [(ngModel)]="from" />
            <mm-date-input name="to" [(ngModel)]="to" />
          </mm-date-range>
          <mm-select class="f-select" name="provider" [(ngModel)]="providerId" ariaLabel="Provider" [options]="providerOptions()" />
          <mm-select class="f-select" name="endpoint" [(ngModel)]="endpoint" ariaLabel="Endpoint" [options]="endpointOptions()" />
          <mm-select class="f-select-sm" name="status" [(ngModel)]="status" ariaLabel="Outcome" [options]="statusOptions" />
          @if (dateError()) { <span class="field-error" role="alert">{{ dateError() }}</span> }
          <span class="filter-actions">
            <button type="submit" class="btn btn-primary btn-sm" [disabled]="!!rangeError()"><i class="pi pi-check" aria-hidden="true"></i> Apply</button>
            <button type="button" class="btn btn-text btn-sm" (click)="reset()">Reset</button>
            @if (pending()) { <span class="pending-note" role="status">Changes not applied</span> }
          </span>
        </div>
        }
      </form>
      <section class="panel flush">
        <div class="table-wrap tall">
          <table class="dt compact-sm" aria-label="API calls" [class.loading]="list.loading()" [attr.aria-busy]="list.loading()">
            <thead>
              <tr><th mmSort="receivedAt" [sort]="list.sort()" (sortChange)="list.setSort($event)">Received</th><th class="hide-sm">Provider</th>
                <th class="hide-sm" mmSort="endpoint" [sort]="list.sort()" (sortChange)="list.setSort($event)">Endpoint</th>
                <th mmSort="httpStatus" class="num" [sort]="list.sort()" (sortChange)="list.setSort($event)">HTTP</th><th>Outcome</th><th>Error</th><th class="hide-sm">Event / match id</th>
                <th mmSort="durationMs" class="num hide-sm" [sort]="list.sort()" (sortChange)="list.setSort($event)">ms</th><th class="hide-sm">Client IP</th></tr>
            </thead>
            <tbody>
              @for (l of list.rows(); track l.id) {
                <!-- The button in the Received cell is the keyboard stop; clicking the row is a mouse shortcut. -->
                <tr class="clickable" tabindex="-1" (click)="open(l)">
                  <td class="nowrap"><button type="button" class="btn btn-text btn-sm" [attr.aria-label]="'Open call from ' + fmt(l.receivedAt)"
                    [attr.aria-busy]="opening() === l.id || null" (click)="$event.stopPropagation(); open(l)">
                    @if (opening() === l.id) { <i class="pi pi-spinner pi-spin" aria-hidden="true"></i> } {{ fmt(l.receivedAt) }}</button></td><td class="hide-sm">{{ l.providerName ?? '—' }}@if (l.legacyKey) { <span class="tag tag-warn" title="Sent with the shared EXTERNAL_API_KEY">Legacy key</span> }@if (l.actor) { <span class="cell-sub">by {{ l.actor }}</span> }</td><td class="hide-sm"><code>{{ l.httpMethod }} {{ l.endpoint }}</code></td>
                  <td class="num">{{ l.httpStatus }}</td><td><mm-result [value]="l.requestStatus" kind="status" /></td><td><span class="clamp" [title]="l.errorMessage ?? ''">{{ l.errorMessage ?? '' }}</span></td>
                  <td class="hide-sm"><span class="truncate" [title]="l.eventId ?? ''">{{ l.eventId ?? '—' }}</span></td><td class="num hide-sm">{{ l.durationMs }}</td><td class="hide-sm">{{ l.clientIp ?? '—' }}</td>
                </tr>
              } @empty {
                <tr><td colspan="9" class="empty">
                  @if (list.loading()) { <mm-state state="loading" [rows]="6" /> }
                  @else if (list.error()) {
                    <div class="empty-state" role="alert"><i class="pi pi-exclamation-circle" aria-hidden="true"></i><strong>Couldn't load API calls</strong><span>{{ list.error() }}</span>
                      <button type="button" class="btn btn-outline btn-sm" data-testid="retry" (click)="list.load()"><i class="pi pi-refresh" aria-hidden="true"></i> Retry</button></div>
                  }
                  @else { <div class="empty-state"><i class="pi pi-filter-slash" aria-hidden="true"></i><span>No API calls match these filters.</span></div> }
                </td></tr>
              }
            </tbody>
          </table>
        </div>
        @if (!list.error()) {
        <mm-paginator [page]="list.page()" [size]="list.size()" [total]="list.total()" [sizes]="[50, 100, 200]" unit="calls" (pageChange)="list.setPage($event)" />
        }
      </section>
    </div>

    <mm-dialog [open]="!!detail()" (closed)="detail.set(null)" header="API call" width="min(760px, 95vw)">
      @if (detail(); as d) {
        <dl class="dl">
          <dt>Received</dt><dd>{{ fmt(d.receivedAt) }}</dd>
          <dt>Endpoint</dt><dd><code>{{ d.httpMethod }} {{ d.endpoint }}</code></dd>
          <dt>Outcome</dt><dd>{{ d.httpStatus }} · {{ humanize(d.requestStatus) }} · {{ d.durationMs }} ms</dd>
          <dt>Request id</dt><dd><code>{{ d.requestId }}</code></dd>
          <dt>Event id</dt><dd>{{ d.eventId ?? '—' }}</dd>
          <dt>Provider</dt><dd>{{ d.providerName ?? '—' }}</dd>
          <dt>Signed-in user</dt><dd>{{ d.actor ?? '—' }}</dd>
          <dt>API key id</dt><dd>{{ d.apiKeyId ?? '—' }}</dd>
          <dt>Client IP</dt><dd>{{ d.clientIp ?? '—' }}</dd>
          <dt>Error</dt><dd>{{ d.errorMessage ?? '—' }}</dd>
        </dl>
        <h3 class="sub-h">Processing result</h3>
        <mm-json [value]="d.processingResult" />
      }
    </mm-dialog>`,
})
export class ApiLogsPage {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);
  readonly providers = safeValue(this.api.providersResource(), []);
  readonly endpoints = safeValue(this.api.apiLogEndpointsResource(), []);
  readonly detail = signal<ApiLogDetail | null>(null);
  readonly statusOptions: SelectOption[] = [{ value: '', label: 'Any outcome' },
    ...['SUCCESS', 'DUPLICATE', 'REJECTED', 'FAILED'].map(s => ({ value: s, label: humanize(s) }))];
  readonly providerOptions = computed<SelectOption[]>(() => [{ value: '', label: 'All providers' }, ...this.providers().map(p => ({ value: p.id, label: p.name }))]);
  readonly endpointOptions = computed<SelectOption[]>(() => [{ value: '', label: 'All endpoints' }, ...this.endpoints().map(e => ({ value: e, label: e }))]);
  /** Starts collapsed on phones and short (landscape) screens, where an open form would push the table below the fold. */
  readonly collapsed = signal(typeof window !== 'undefined' && (window.innerWidth < 760 || window.innerHeight <= 500));
  readonly activeCount = signal(0);
  /** Id of the call whose detail is loading: repeat clicks are ignored and its row shows a spinner. */
  readonly opening = signal<string | null>(null);
  readonly fmt = fmtDateTime;
  readonly humanize = humanize;
  readonly search = signal('');
  readonly providerId = signal('');
  readonly endpoint = signal('');
  readonly status = signal('');
  readonly from = signal('');
  readonly to = signal('');

  constructor() {
    // A shared or refreshed link (the providers page links here with ?providerId=) restores the filters.
    const q = fromQuery(this.route.snapshot.queryParamMap, ['search', 'providerId', 'endpoint', 'status', 'from', 'to'] as const);
    this.search.set(q.search ?? ''); this.providerId.set(q.providerId ?? ''); this.endpoint.set(q.endpoint ?? '');
    this.status.set(q.status ?? ''); this.from.set(q.from ?? ''); this.to.set(q.to ?? '');
    this.apply(false);
  }

  /** Filters as of the last Apply, so paging and sorting never pick up half-typed values. */
  private applied: Parameters<ApiService['apiLogs']>[0] = {};
  readonly list = new PagedList<ApiLogRow>(paging => this.api.apiLogs({ ...this.applied, ...paging }), { field: 'receivedAt', dir: 'desc' }, 50);

  /** The fields as of the last Apply; differences are shown as not applied. */
  private readonly appliedKey = signal('');
  private readonly key = computed(() =>
    JSON.stringify([this.search(), this.providerId(), this.endpoint(), this.status(), this.from(), this.to()]));
  readonly pending = computed(() => this.key() !== this.appliedKey());
  private readonly dateRange = viewChild(DateRange);
  readonly rangeError = computed(() => this.dateRange()?.error() || dayRange(this.from(), this.to()).error || '');
  /** From-after-To is shown by the date range itself; this is only the server's own message. */
  readonly dateError = computed(() => this.list.fieldErrors()['from'] ?? '');

  apply(updateUrl = true): void {
    if (this.rangeError()) return;
    const [search, providerId, endpoint, status, from, to] =
      [this.search().trim(), this.providerId(), this.endpoint(), this.status(), this.from(), this.to()];
    const range = dayRange(from, to);
    this.applied = {
      search: search || undefined, providerId: providerId || undefined, endpoint: endpoint || undefined,
      status: status || undefined, from: range.from, to: range.to,
    };
    this.appliedKey.set(this.key());
    this.activeCount.set([search, providerId, endpoint, status, from || to].filter(Boolean).length);
    // First load keeps the page and sort that came with the URL; an applied filter starts over at page 1.
    if (updateUrl) this.list.reload(); else this.list.load();
    if (updateUrl) {
      toQuery(this.router, this.route, {
        search: search || null, providerId: providerId || null, endpoint: endpoint || null,
        status: status || null, from: from || null, to: to || null,
      });
    }
  }

  reset(): void {
    this.dateRange()?.setRange('', '');
    for (const f of [this.search, this.providerId, this.endpoint, this.status, this.from, this.to]) f.set('');
    this.apply();
  }

  open(l: ApiLogRow): void {
    if (this.opening()) return;
    this.opening.set(l.id);
    this.api.apiLog(l.id).subscribe({
      next: d => { this.opening.set(null); this.detail.set(d); },
      error: e => { this.opening.set(null); this.toasts.add({ severity: 'error', summary: 'Could not load this call', detail: apiError(e).message }); },
    });
  }
}
