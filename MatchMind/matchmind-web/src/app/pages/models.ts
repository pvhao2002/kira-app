import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { errorMessage, safeValue, viewState } from '../core/resource';
import { fmtDateTime, pct } from '../shared/format';
import { Sort, SortHeader, sortRows } from '../shared/kit';
import { StateView } from '../shared/ui';

@Component({
  selector: 'mm-models',
  imports: [RouterLink, SortHeader, StateView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stack">
      <p class="page-note">Models are added automatically the first time an agent sends a prediction with them
        (<code>X-Provider</code> and <code>X-Model-Name</code> headers).</p>
      <mm-state [state]="state()" [message]="error()" />
      @if (state() === 'ready') {
        <section class="panel flush">
          <div class="table-wrap tall"><table class="dt compact-sm">
            <thead>
              <tr><th mmSort="name" [(sort)]="sort">Model</th><th class="hide-sm" mmSort="providerName" [(sort)]="sort">Provider</th>
                <th mmSort="totalPredictions" class="num hide-sm" [(sort)]="sort">Predictions</th>
                <th class="num hide-sm">Settled</th><th class="num">W / L</th><th mmSort="winRate" class="num" [(sort)]="sort" title="(Win + half win) divided by settled picks. Push and void are left out.">Win rate</th>
                <th class="num hide-sm">Pending</th><th class="hide-sm" mmSort="lastPredictionAt" [(sort)]="sort">Last prediction</th></tr>
            </thead>
            <tbody>
              @for (m of sorted(); track m.id) {
              <tr class="clickable" [routerLink]="['/models', m.id]">
                <td><a [routerLink]="['/models', m.id]">{{ m.name }}</a> @if (m.status === 'DISABLED') { <span class="tag tag-secondary">Disabled</span> }<span class="cell-sub">{{ m.version }}<span class="show-sm"> · {{ m.providerName }}</span></span></td>
                <td class="hide-sm">{{ m.providerName }}</td>
                <td class="num hide-sm">{{ m.totalPredictions }}</td>
                <td class="num hide-sm">{{ m.settledPicks }}</td>
                <td class="num"><span class="win">{{ m.wins }}</span> / <span class="loss">{{ m.losses }}</span></td>
                <td class="num">{{ pct(m.winRate) }}</td>
                <td class="num hide-sm">{{ m.pendingPicks }}</td>
                <td class="nowrap hide-sm">{{ fmt(m.lastPredictionAt) }}</td>
              </tr>
              } @empty { <tr><td colspan="8" class="empty"><div class="empty-state"><i class="pi pi-microchip-ai" aria-hidden="true"></i><strong>No models yet</strong><span>They appear after an agent's first prediction.</span></div></td></tr> }
            </tbody>
          </table></div>
        </section>
      }
    </div>`,
})
export class ModelsPage {
  private readonly api = inject(ApiService);
  private readonly resource = this.api.modelsResource();
  readonly state = viewState(this.resource);
  readonly error = errorMessage(this.resource);
  readonly models = safeValue(this.resource, []);
  readonly sort = signal<Sort>({ field: 'name', dir: 'asc' });
  readonly sorted = computed(() => sortRows(this.models(), this.sort()));
  readonly pct = pct;
  readonly fmt = fmtDateTime;
}
