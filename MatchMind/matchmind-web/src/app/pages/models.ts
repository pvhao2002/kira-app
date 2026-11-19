import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { apiError } from '../core/http';
import { AiModel } from '../core/models';
import { fmtDateTime, pct } from '../shared/format';
import { Sort, SortHeader, sortRows } from '../shared/kit';
import { StateView } from '../shared/ui';

@Component({
  selector: 'mm-models',
  imports: [RouterLink, SortHeader, StateView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stack">
      <p class="muted-text">Models are added automatically the first time an agent sends a prediction with them
        (<code>X-Provider</code> and <code>X-Model-Name</code> headers).</p>
      <mm-state [state]="state()" [message]="error()" />
      @if (state() === 'ready') {
        <section class="panel flush">
          <div class="table-wrap"><table class="dt">
            <thead>
              <tr><th mmSort="name" [(sort)]="sort">Model</th><th mmSort="providerName" [(sort)]="sort">Provider</th>
                <th mmSort="totalPredictions" class="num" [(sort)]="sort">Predictions</th>
                <th class="num">Settled</th><th class="num">W / L</th><th mmSort="winRate" class="num" [(sort)]="sort">Win rate</th>
                <th class="num">Pending</th><th mmSort="lastPredictionAt" [(sort)]="sort">Last prediction</th></tr>
            </thead>
            <tbody>
              @for (m of sorted(); track m.id) {
              <tr>
                <td><a [routerLink]="['/models', m.id]">{{ m.name }}</a> <span class="cell-sub">{{ m.version }}</span></td>
                <td>{{ m.providerName }}</td>
                <td class="num">{{ m.totalPredictions }}</td>
                <td class="num">{{ m.settledPicks }}</td>
                <td class="num"><span class="win">{{ m.wins }}</span> / <span class="loss">{{ m.losses }}</span></td>
                <td class="num">{{ pct(m.winRate) }}</td>
                <td class="num">{{ m.pendingPicks }}</td>
                <td class="nowrap">{{ fmt(m.lastPredictionAt) }}</td>
              </tr>
              } @empty { <tr><td colspan="8" class="empty">No models yet. They appear after an agent's first prediction.</td></tr> }
            </tbody>
          </table></div>
        </section>
      }
    </div>`,
})
export class ModelsPage implements OnInit {
  private readonly api = inject(ApiService);
  readonly state = signal<'loading' | 'error' | 'ready'>('loading');
  readonly error = signal('');
  readonly models = signal<AiModel[]>([]);
  readonly sort = signal<Sort>({ field: 'name', dir: 'asc' });
  readonly sorted = computed(() => sortRows(this.models(), this.sort()));
  readonly pct = pct;
  readonly fmt = fmtDateTime;

  ngOnInit(): void {
    this.api.models().subscribe({
      next: m => { this.models.set(m); this.state.set('ready'); },
      error: e => { this.error.set(apiError(e).message); this.state.set('error'); },
    });
  }
}
