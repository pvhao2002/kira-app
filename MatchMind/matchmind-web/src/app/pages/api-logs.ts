import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../core/api.service';
import { apiError } from '../core/http';
import { ApiLogDetail, ApiLogRow } from '../core/models';
import { localDay } from '../shared/filter-bar';
import { dayEndExclusive, dayStart, fmtDateTime, humanize } from '../shared/format';
import { Dialog, Paginator, SortHeader } from '../shared/kit';
import { PagedList } from '../shared/paged-list';
import { JsonView, ResultTag } from '../shared/ui';

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
          <button type="submit" class="btn btn-primary btn-sm"><i class="pi pi-check"></i> Apply</button>
        </div>
      </form>
      <section class="panel flush">
        <div class="table-wrap tall">
          <table class="dt" [class.loading]="list.loading()" [attr.aria-busy]="list.loading()">
            <thead>
              <tr><th mmSort="receivedAt" [sort]="list.sort()" (sortChange)="list.setSort($event)">Received</th><th>Provider</th>
                <th mmSort="endpoint" [sort]="list.sort()" (sortChange)="list.setSort($event)">Endpoint</th>
                <th mmSort="httpStatus" class="num" [sort]="list.sort()" (sortChange)="list.setSort($event)">HTTP</th><th>Outcome</th><th>Event id</th>
                <th mmSort="durationMs" class="num" [sort]="list.sort()" (sortChange)="list.setSort($event)">ms</th><th>Error</th><th>Client IP</th></tr>
            </thead>
            <tbody>
              @for (l of list.rows(); track l.id) {
                <tr class="clickable" (click)="open(l)" tabindex="0" (keydown.enter)="open(l)">
                  <td class="nowrap">{{ fmt(l.receivedAt) }}</td><td>{{ l.providerName ?? '—' }}</td><td><code>{{ l.httpMethod }} {{ l.endpoint }}</code></td>
                  <td class="num">{{ l.httpStatus }}</td><td><mm-result [value]="l.requestStatus" kind="status" /></td><td><span class="truncate" [title]="l.eventId ?? ''">{{ l.eventId ?? '—' }}</span></td>
                  <td class="num">{{ l.durationMs }}</td><td><span class="truncate" [title]="l.errorMessage ?? ''">{{ l.errorMessage ?? '' }}</span></td><td>{{ l.clientIp ?? '—' }}</td>
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
        <h3 style="margin:1rem 0 .5rem">Processing result</h3>
        <mm-json [value]="d.processingResult" />
      }
    </mm-dialog>`,
})
export class ApiLogsPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  readonly providers = signal<{ id: string; name: string }[]>([]);
  readonly endpoints = signal<string[]>([]);
  readonly detail = signal<ApiLogDetail | null>(null);
  readonly statuses = ['SUCCESS', 'DUPLICATE', 'REJECTED', 'FAILED'].map(s => ({ label: humanize(s), value: s }));
  readonly fmt = fmtDateTime;
  readonly humanize = humanize;
  search = '';
  providerId = this.route.snapshot.queryParamMap.get('providerId') ?? '';
  endpoint = '';
  status = '';
  from = '';
  to = '';

  ngOnInit(): void {
    this.api.providers().subscribe({ next: p => this.providers.set(p), error: () => undefined });
    this.api.apiLogEndpoints().subscribe({ next: e => this.endpoints.set(e), error: () => undefined });
    this.apply();
  }

  /** Filters as of the last Apply, so paging and sorting never pick up half-typed values. */
  private applied: Parameters<ApiService['apiLogs']>[0] = {};
  readonly list = new PagedList<ApiLogRow>(paging => this.api.apiLogs({ ...this.applied, ...paging }), { field: 'receivedAt', dir: 'desc' }, 50);

  apply(): void {
    const start = localDay(this.from) ?? localDay(this.to);
    const end = localDay(this.to) ?? start;
    this.applied = {
      search: this.search.trim() || undefined, providerId: this.providerId || undefined, endpoint: this.endpoint || undefined,
      status: this.status || undefined, from: start ? dayStart(start) : undefined, to: end ? dayEndExclusive(end) : undefined,
    };
    this.list.reload();
  }

  open(l: ApiLogRow): void {
    this.api.apiLog(l.id).subscribe({ next: d => this.detail.set(d), error: e => this.list.error.set(apiError(e).message) });
  }
}
