import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {RouterLink} from '@angular/router';
import {catchError, forkJoin, of} from 'rxjs';
import {CreditCardApiService, CreditCardDto, CreditCardSummary} from '../../services/credit-card-api.service';
import {ToastService} from '../../config/ToastService';
import {formatVnd} from '../../utils/format-vnd';

@Component({
  selector: 'app-cards',
  imports: [RouterLink],
  templateUrl: './cards.html',
  styleUrl: './cards.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Cards {
  private readonly api = inject(CreditCardApiService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly summary = signal<CreditCardSummary | null>(null);
  readonly cards = signal<CreditCardDto[]>([]);

  readonly togglingId = signal<number | null>(null);

  constructor() {
    this.reload();
  }

  protected formatVnd(n: number): string {
    return formatVnd(n);
  }

  reload(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      summary: this.api.summary().pipe(catchError(() => of<CreditCardSummary | null>(null))),
      list: this.api.list().pipe(
        catchError(err => {
          const msg = err?.error?.message ?? err?.message ?? 'Unable to load card list.';
          this.error.set(typeof msg === 'string' ? msg : 'Unable to load card list.');
          return of<CreditCardDto[]>([]);
        })
      )
    }).subscribe(({summary, list}) => {
      this.summary.set(summary);
      this.cards.set(list);
      this.loading.set(false);
    });
  }

  toggleStatement(card: CreditCardDto): void {
    if (this.togglingId() !== null) {
      return;
    }
    this.togglingId.set(card.creditCardId);
    this.api.patchCycle(card.creditCardId, {cycleStatementDone: !card.cycleStatementDone}).subscribe({
      next: () => {
        this.togglingId.set(null);
        this.reload();
      },
      error: err => {
        this.togglingId.set(null);
        const raw = err?.error?.message ?? err?.message ?? 'Unable to update.';
        this.toast.error(typeof raw === 'string' ? raw : 'Unable to update.');
      }
    });
  }

  togglePaid(card: CreditCardDto): void {
    if (this.togglingId() !== null) {
      return;
    }
    this.togglingId.set(card.creditCardId);
    this.api.patchCycle(card.creditCardId, {cycleDuePaid: !card.cycleDuePaid}).subscribe({
      next: () => {
        this.togglingId.set(null);
        this.reload();
      },
      error: err => {
        this.togglingId.set(null);
        const raw = err?.error?.message ?? err?.message ?? 'Unable to update.';
        this.toast.error(typeof raw === 'string' ? raw : 'Unable to update.');
      }
    });
  }

  deleteCard(card: CreditCardDto): void {
    if (!globalThis.confirm(`Delete card "${card.cardLabel}"? This action cannot be undone.`)) {
      return;
    }
    this.api.deleteCard(card.creditCardId).subscribe({
      next: () => {
        this.toast.success('Card deleted.');
        this.reload();
      },
      error: err => {
        const raw = err?.error?.message ?? err?.message ?? 'Unable to delete.';
        this.toast.error(typeof raw === 'string' ? raw : 'Unable to delete.');
      }
    });
  }

  dueUrgency(card: CreditCardDto): 'ok' | 'soon' | 'overdue' {
    if (card.cycleDuePaid) {
      return 'ok';
    }
    const d = card.daysUntilDue;
    if (d < 0) {
      return 'overdue';
    }
    if (d <= 3) {
      return 'soon';
    }
    return 'ok';
  }

  bankInitials(bankName: string): string {
    const s = (bankName ?? '').trim();
    if (!s) {
      return '?';
    }
    const parts = s.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 3);
    }
    return s.slice(0, 3).toUpperCase();
  }
}
