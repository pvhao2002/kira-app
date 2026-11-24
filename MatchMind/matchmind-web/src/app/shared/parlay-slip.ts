import { ChangeDetectionStrategy, Component, DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { apiErrorText } from '../core/http';
import { num } from './format';
import { ToastService } from './kit';

/** One pick on the draft slip, with what the slip shows of it. */
export interface SlipLeg { pickId: string; matchId: string; match: string; pick: string; price: number; }

const KEY = 'matchmind.parlay-slip';

/** The draft parlay, kept in this browser until it is saved. One pick per match: adding another replaces it. */
@Injectable({ providedIn: 'root' })
export class ParlaySlip {
  readonly legs = signal<SlipLeg[]>(this.restore());
  readonly open = signal(false);
  readonly totalOdds = computed(() => this.legs().reduce((p, l) => p * l.price, 1));

  has(pickId: string): boolean { return this.legs().some(l => l.pickId === pickId); }

  add(leg: SlipLeg): void {
    this.set([...this.legs().filter(l => l.matchId !== leg.matchId), leg]);
  }

  remove(pickId: string): void { this.set(this.legs().filter(l => l.pickId !== pickId)); }

  clear(): void { this.set([]); this.open.set(false); }

  private set(legs: SlipLeg[]): void {
    this.legs.set(legs);
    try { localStorage.setItem(KEY, JSON.stringify(legs)); } catch { /* storage off: the slip lasts this visit */ }
  }

  private restore(): SlipLeg[] {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? '[]');
      return Array.isArray(saved) ? saved.filter(l => l && typeof l.pickId === 'string' && typeof l.price === 'number') : [];
    } catch { return []; }
  }
}

/** Floating slip: the draft's legs, total odds, an optional stake and Save. */
@Component({
  selector: 'mm-parlay-slip',
  imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (slip.legs().length) {
      <div class="slip" [class.open]="slip.open()">
        <button type="button" class="btn btn-primary slip-toggle" data-testid="slip-toggle" [attr.aria-expanded]="slip.open()"
          aria-controls="parlay-slip" (click)="slip.open.set(!slip.open())">
          <i class="pi pi-ticket" aria-hidden="true"></i> Parlay ({{ slip.legs().length }}) · {{ num(slip.totalOdds()) }}</button>
        @if (slip.open()) {
          <section class="panel slip-panel stack" id="parlay-slip" aria-label="Parlay slip">
            <ul class="slip-legs">
              @for (l of slip.legs(); track l.pickId) {
                <li><span><strong>{{ l.pick }}</strong><span class="cell-sub">{{ l.match }}</span></span>
                  <span class="num">{{ num(l.price) }}</span>
                  <button type="button" class="btn btn-text btn-icon" [attr.aria-label]="'Remove ' + l.pick" (click)="slip.remove(l.pickId)"><i class="pi pi-times" aria-hidden="true"></i></button></li>
              }
            </ul>
            <div class="slip-total"><span>Total odds</span><strong data-testid="slip-odds">{{ num(slip.totalOdds()) }}</strong></div>
            <label class="field">Stake (optional)
              <input type="number" min="0" step="any" inputmode="decimal" [(ngModel)]="stake" name="stake" data-testid="slip-stake"></label>
            @if (stake && stake > 0) { <p class="muted-text">Returns {{ num(stake * slip.totalOdds()) }} if every pick wins.</p> }
            @if (slip.legs().length < 2) { <p class="muted-text">Add a pick of another match: a parlay needs at least 2.</p> }
            @if (error()) { <p role="alert" class="alert alert-error">{{ error() }}</p> }
            <div class="slip-actions">
              <button type="button" class="btn btn-sm" (click)="slip.clear()">Clear</button>
              <a class="btn btn-sm btn-text" routerLink="/parlays" (click)="slip.open.set(false)">My parlays</a>
              <button type="button" class="btn btn-primary btn-sm" data-testid="slip-save" [disabled]="saving() || slip.legs().length < 2" (click)="save()">
                @if (saving()) { <i class="pi pi-spin pi-spinner" aria-hidden="true"></i> } Save parlay</button>
            </div>
          </section>
        }
      </div>
    }`,
  styles: `
    .slip { position: fixed; right: 16px; bottom: 16px; z-index: 40; display: grid; justify-items: end; gap: .5rem; }
    .slip-toggle { box-shadow: var(--mm-shadow); }
    .slip-panel { width: min(360px, calc(100vw - 32px)); max-height: 70vh; overflow: auto; order: -1; }
    .slip-legs { list-style: none; margin: 0; padding: 0; display: grid; gap: .4rem; }
    .slip-legs li { display: grid; grid-template-columns: 1fr auto auto; gap: .5rem; align-items: center; }
    .slip-total { display: flex; justify-content: space-between; align-items: baseline; border-top: 1px solid var(--mm-line); padding-top: .5rem; }
    .slip-total strong { font-size: 1.25rem; font-variant-numeric: tabular-nums; }
    .slip-actions { display: flex; gap: .5rem; justify-content: flex-end; flex-wrap: wrap; }
    .field { display: grid; gap: .25rem; font-size: var(--fs-sm); }`,
})
export class ParlaySlipPanel {
  readonly slip = inject(ParlaySlip);
  private readonly api = inject(ApiService);
  private readonly toasts = inject(ToastService);
  private readonly destroy = inject(DestroyRef);
  readonly num = num;
  readonly saving = signal(false);
  readonly error = signal('');
  stake: number | null = null;

  save(): void {
    this.saving.set(true);
    this.error.set('');
    const stake = this.stake && this.stake > 0 ? this.stake : null;
    this.api.createParlay(this.slip.legs().map(l => l.pickId), stake).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: () => {
        this.saving.set(false);
        this.stake = null;
        this.slip.clear();
        this.toasts.add({ severity: 'success', summary: 'Parlay saved', detail: 'See it under My parlays.' });
      },
      error: e => { this.saving.set(false); this.error.set(apiErrorText(e)); },
    });
  }
}
