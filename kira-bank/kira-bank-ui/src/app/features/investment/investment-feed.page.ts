import {ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {ApiService} from '../../core/services/api.service';
import {LanguageService} from '../../core/i18n/language.service';
import {dateFormat, numberFormat} from '../../core/i18n/formatters';
import {CustomSelectComponent, SelectOption} from '../../shared/custom-select/custom-select';
import {InvestmentAccountSummary, InvestmentTransaction, PageMeta} from '../../shared/models/api.models';

interface FeedDay {
  label: string;
  rows: InvestmentTransaction[]
}

type Tone = 'pending' | 'failed' | 'out' | 'in';

const PAGE_SIZE = 30;
const GLYPHS: Record<Tone, string> = {pending: '◷', failed: '×', out: '−', in: '+'};

@Component({
  selector: 'app-investment-feed',
  imports: [FormsModule, CustomSelectComponent],
  templateUrl: './investment-feed.page.html',
  styleUrl: './investment-feed.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InvestmentFeedPage {
  readonly i18n = inject(LanguageService);
  readonly accounts = signal<InvestmentAccountSummary[]>([]);
  readonly accountId = signal<number | null>(null);
  readonly rows = signal<InvestmentTransaction[]>([]);
  readonly meta = signal<PageMeta>({page: 0, size: PAGE_SIZE, totalElements: 0, totalPages: 0});
  readonly loading = signal(false);
  readonly error = signal(false);
  readonly accountOptions = computed<SelectOption[]>(() =>
    this.accounts().map(a => ({value: a.id, label: `${a.accountName} · ${a.currency}`})));
  readonly hasMore = computed(() => this.meta().page + 1 < this.meta().totalPages);
  readonly days = computed<FeedDay[]>(() => {
    const byDay = new Map<string, FeedDay>();
    const fmt = dateFormat(this.i18n.locale(), {dateStyle: 'medium'});
    for (const row of this.rows()) {
      const date = new Date(row.transactionAt);
      const label = Number.isNaN(date.getTime()) ? '—' : fmt.format(date);
      const day = byDay.get(label) ?? {label, rows: []};
      day.rows.push(row);
      byDay.set(label, day);
    }
    return [...byDay.values()];
  });

  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    this.api.page<InvestmentAccountSummary>('investment/accounts', 0, 100)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.accounts.set(res.data);
          if (res.data.length) this.chooseAccount(res.data[0].id);
        },
        error: () => this.error.set(true)
      });
  }

  chooseAccount(value: number | string): void {
    const id = Number(value);
    if (!Number.isFinite(id)) return;
    this.accountId.set(id);
    this.rows.set([]);
    this.load(0);
  }

  loadMore(): void {
    if (this.hasMore() && !this.loading()) this.load(this.meta().page + 1);
  }

  time(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : dateFormat(this.i18n.locale(), {hour: '2-digit', minute: '2-digit', hourCycle: 'h23'}).format(date);
  }

  money(row: InvestmentTransaction): string {
    const sign = row.transactionType === 'WITHDRAWAL' ? '−' : '+';
    const n = numberFormat(this.i18n.locale(), {minimumFractionDigits: 0, maximumFractionDigits: 2}).format(row.amount);
    return `${sign}${n} ${row.currency}`;
  }

  tone(row: InvestmentTransaction): Tone {
    if (row.transactionStatus === 'PENDING') return 'pending';
    if (row.transactionStatus === 'FAILED' || row.transactionStatus === 'CANCELLED') return 'failed';
    return row.transactionType === 'WITHDRAWAL' ? 'out' : 'in';
  }

  glyph(row: InvestmentTransaction): string {
    return GLYPHS[this.tone(row)];
  }

  title(row: InvestmentTransaction): string {
    return row.description || row.rawText
      || this.i18n.t(`investmentTransactions.type.${row.transactionType.toLowerCase()}`);
  }

  statusLabel(row: InvestmentTransaction): string {
    return this.i18n.t(`investmentTransactions.status.${row.transactionStatus.toLowerCase()}`);
  }

  private load(page: number): void {
    const id = this.accountId();
    if (!id) return;
    this.loading.set(true);
    this.error.set(false);
    this.api.investmentTransactions(id, {page, size: PAGE_SIZE, sort: 'transactionAt,desc'})
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          if (id !== this.accountId()) return;
          this.rows.update(prev => page === 0 ? res.data : [...prev, ...res.data]);
          this.meta.set(res.meta);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set(true);
        }
      });
  }
}
