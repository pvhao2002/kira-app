import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../core/api.service';
import { apiError } from '../core/http';
import { ApiLogDetail, ApiLogRow } from '../core/models';
import { safeValue } from '../core/resource';
import { localDay } from '../shared/filter-bar';
import { dayEndExclusive, dayStart, fmtDateTime, humanize } from '../shared/format';
import { Dialog, Paginator, SortHeader, ToastService } from '../shared/kit';
import { PagedList } from '../shared/paged-list';
import { JsonView, ResultTag } from '../shared/ui';
import { fromQuery, toQuery } from '../shared/url-state';

@Component({
  selector: 'mm-api-logs',
  imports: [FormsModule, Dialog, Paginator, SortHeader, JsonView, ResultTag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stack">
      <form class="filter-bar" (ngSubmit)="apply()">
        <div class="filter-fields">
          <input class="input f-search" name="search" [(ngModel)]="search" placeholder="Request, event id or error" aria-label="Search logs" />
          <span class="date-range">
            <input class="input" type="date" name="from" [(ngModel)]="from" aria-label="Received from" />
            <span aria-hidden="true">–</span>
            <input class="input" type="date" name="to" [(ngModel)]="to" aria-label="Received to" />
          </span>
          <select class="input f-select" name="provider" [(ngModel)]="providerId" aria-label="Provider">
            <option value="">All providers</option>
            @for (p of providers(); track p.id) { <option [value]="p.id">{{ p.name }}</option> }
          </select>
          <select class="input f-select" name="endpoint" [(ngModel)]="endpoint" aria-label="Endpoint">
            <option value="">All endpoints</option>
            @for (e of endpoints(); track e) { <option [value]="e">{{ e }}</option> }
          </select>
          <select class="input f-select-sm" name="status" [(ngModel)]="status" aria-label="Outcome">
            <option value="">Any outcome</option>
            @for (s of statuses; track s.value) { <option [value]="s.value">{{ s.label }}</option> }
          </select>
          <span class="filter-actions"><button type="submit" class="btn btn-primary btn-sm"><i class="pi pi-check"></i> Apply</button></span>
        </div>
      </form>
      <section class="panel flush">
        <div class="table-wrap tall">
          <table class="dt compact-sm" [class.loading]="list.loading()" [attr.aria-busy]="list.loading()">
            <thead>
              <tr><th mmSort="receivedAt" [sort]="list.sort()" (sortChange)="list.setSort($event)">Received</th><th class="hide-sm">Provider</th>
                <th class="hide-sm" mmSort="endpoint" [sort]="list.sort()" (sortChange)="list.setSort($event)">Endpoint</th>
                <th mmSort="httpStatus" class="num" [sort]="list.sort()" (sortChange)="list.setSort($event)">HTTP</th><th>Outcome</th><th>Error</th><th class="hide-sm">Event / match id</th>
                <th mmSort="durationMs" class="num hide-sm" [sort]="list.sort()" (sortChange)="list.setSort($event)">ms</th><th class="hide-sm">Client IP</th></tr>
            </thead>
            <tbody>
              @for (l of list.rows(); track l.id) {
                <tr class="clickable" (click)="open(l)" tabindex="0" (keydown.enter)="open(l)">
                  <td class="nowrap">{{ fmt(l.receivedAt) }}</td><td class="hide-sm">{{ l.providerName ?? '—' }}</td><td class="hide-sm"><code>{{ l.httpMethod }} {{ l.endpoint }}</code></td>
                  <td class="num">{{ l.httpStatus }}</td><td><mm-result [value]="l.requestStatus" kind="status" /></td><td><span class="clamp" [title]="l.errorMessage ?? ''">{{ l.errorMessage ?? '' }}</span></td>
                  <td class="hide-sm"><span class="truncate" [title]="l.eventId ?? ''">{{ l.eventId ?? '—' }}</span></td><td class="num hide-sm">{{ l.durationMs }}</td><td class="hide-sm">{{ l.clientIp ?? '—' }}</td>
                </tr>
              } @empty {
                <tr><td colspan="9" class="empty">{{ list.loading() ? 'Loading…' : list.error() || 'No API calls match these filters.' }}</td></tr>
              }
            </tbody>
          </table>
        </div>
        <mm-paginator [page]="list.page()" [size]="list.size()" [total]="list.total()" [sizes]="[50, 100, 200]" unit="calls" (change)="list.setPage($event)" />
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
          <dt>Provider / key</dt><dd>{{ d.providerId ?? '—' }} / {{ d.apiKeyId ?? '—' }}</dd>
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
  readonly statuses = ['SUCCESS', 'DUPLICATE', 'REJECTED', 'FAILED'].map(s => ({ label: humanize(s), value: s }));
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

  apply(updateUrl = true): void {
    const [search, providerId, endpoint, status, from, to] =
      [this.search().trim(), this.providerId(), this.endpoint(), this.status(), this.from(), this.to()];
    const start = localDay(from) ?? localDay(to);
    const end = localDay(to) ?? start;
    this.applied = {
      search: search || undefined, providerId: providerId || undefined, endpoint: endpoint || undefined,
      status: status || undefined, from: start ? dayStart(start) : undefined, to: end ? dayEndExclusive(end) : undefined,
    };
    // First load keeps the page and sort that came with the URL; an applied filter starts over at page 1.
    if (updateUrl) this.list.reload(); else this.list.load();
    if (updateUrl) {
      toQuery(this.router, this.route, {
        search: search || null, providerId: providerId || null, endpoint: endpoint || null,
        status: status || null, from: from || null, to: to || null,
      });
    }
  }

  open(l: ApiLogRow): void {
    this.api.apiLog(l.id).subscribe({ next: d => this.detail.set(d), error: e => this.toasts.add({ severity: 'error', summary: 'Could not load this call', detail: apiError(e).message }) });
  }
}
