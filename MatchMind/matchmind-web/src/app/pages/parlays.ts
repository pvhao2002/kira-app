import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { apiErrorText } from '../core/http';
import { errorMessage, keepPrevious, viewState } from '../core/resource';
import { fmtDateTime, num, pickText } from '../shared/format';
import { Paginator, ToastService } from '../shared/kit';
import { ResultTag, StateView } from '../shared/ui';

/** The signed-in user's saved parlays, newest first, each settled from its legs' current results. */
@Component({
  selector: 'mm-parlays',
  imports: [Paginator, ResultTag, RouterLink, StateView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stack">
      <p class="page-note">Build a parlay from a prediction's Picks tab with <strong>Add to parlay</strong>, one pick per match.
        A parlay loses on any losing pick; a half win pays (1 + price) / 2, a push or void pays 1, a half loss 0.5.</p>
      @if (data(); as page) {
        @for (x of page.data; track x.id) {
          <section class="panel stack parlay" data-testid="parlay">
            <div class="parlay-head">
              <div><strong>{{ x.legs.length }}-pick parlay</strong><span class="cell-sub">{{ fmt(x.createdAt) }}</span></div>
              <div class="figures">
                <span>Odds <strong>{{ num(x.totalOdds) }}</strong></span>
                @if (x.stake !== null) { <span>Stake <strong>{{ num(x.stake) }}</strong></span> }
                @if (x.payout !== null) { <span>Payout <strong>{{ num(x.payout) }}</strong></span>
                  <span>Profit <strong [class.win]="x.profit! > 0" [class.loss]="x.profit! < 0">{{ num(x.profit) }}</strong></span> }
                <mm-result [value]="x.result" />
                <button type="button" class="btn btn-text btn-icon" [disabled]="deleting() === x.id" [attr.aria-label]="'Delete parlay of ' + fmt(x.createdAt)"
                  (click)="remove(x.id)"><i class="pi pi-trash" aria-hidden="true"></i></button>
              </div>
            </div>
            <div class="table-wrap"><table class="dt compact-sm" aria-label="Parlay picks">
              <thead><tr><th>Match</th><th class="hide-sm">Kick-off</th><th>Pick</th><th class="num">Price</th><th>Result</th></tr></thead>
              <tbody>@for (l of x.legs; track l.pickId) {
                <tr><td><a [routerLink]="['/predictions', l.predictionId]">{{ l.homeTeam }} – {{ l.awayTeam }}</a><span class="cell-sub">{{ l.league }}</span></td>
                  <td class="hide-sm nowrap">{{ fmt(l.startTime) }}</td><td class="nowrap">{{ pickText(l.market, l.pick, l.line, l.lineDisplay) }}</td>
                  <td class="num">{{ num(l.price) }}</td><td><mm-result [value]="l.result" /></td></tr>
              }</tbody>
            </table></div>
          </section>
        } @empty {
          <div class="panel empty-state"><i class="pi pi-ticket" aria-hidden="true"></i><strong>No parlays yet</strong>
            <span>Open a prediction and use Add to parlay on its picks.</span></div>
        }
        @if (page.meta.totalElements > page.meta.size) {
          <mm-paginator [page]="page.meta.page" [size]="page.meta.size" [total]="page.meta.totalElements"
            [sizes]="[]" unit="parlays" (pageChange)="pageNo.set($event.page)" />
        }
      } @else {
        <mm-state [state]="state()" [message]="error()" retryable (retry)="resource.reload()" />
      }
    </div>`,
  styles: `
    .parlay-head { display: flex; justify-content: space-between; gap: .75rem; flex-wrap: wrap; align-items: center; }
    .parlay-head > div:first-child { display: grid; }
    .figures { display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; font-size: var(--fs-sm); color: var(--mm-ink-2); }
    .figures strong { color: var(--mm-ink); font-variant-numeric: tabular-nums; }`,
})
export class ParlaysPage {
  private readonly api = inject(ApiService);
  private readonly toasts = inject(ToastService);
  private readonly destroy = inject(DestroyRef);
  readonly pageNo = signal(0);
  readonly resource = this.api.parlaysResource(this.pageNo);
  readonly data = keepPrevious(this.resource);
  readonly state = viewState(this.resource);
  readonly error = errorMessage(this.resource);
  readonly deleting = signal<string | null>(null);
  readonly fmt = fmtDateTime;
  readonly num = num;
  readonly pickText = pickText;

  remove(id: string): void {
    if (!confirm('Delete this parlay?')) return;
    this.deleting.set(id);
    this.api.deleteParlay(id).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: () => { this.deleting.set(null); this.resource.reload(); },
      error: e => { this.deleting.set(null); this.toasts.add({ severity: 'error', summary: 'Delete failed', detail: apiErrorText(e) }); },
    });
  }
}
