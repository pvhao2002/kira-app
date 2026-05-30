import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
  HostListener,
} from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import {debounceTime, distinctUntilChanged, of, Subject, switchMap} from 'rxjs';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {
  EventsHistoryApiService,
  EventHistoryRow,
  EventHistoryPage,
  EventHistoryOddsInfo,
  OddsTimelineEntry,
} from '../../services/events-history-api.service';
import {ToastService} from '../../config/ToastService';

type OddsTab = 'handicap' | 'ou' | 'corner';

@Component({
  selector: 'app-events-history',
  templateUrl: './events-history.html',
  styleUrl: './events-history.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EventsHistory implements OnInit {
  private readonly api = inject(EventsHistoryApiService);
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);

  // ── Modal ──────────────────────────────────────────────────────────────────
  readonly isModalOpen = signal(false);
  readonly activeTab = signal<OddsTab>('handicap');
  readonly selectedEvent = signal<EventHistoryRow | null>(null);

  // ── Odds Timeline ──────────────────────────────────────────────────────────
  readonly timelineLoading = signal(false);
  readonly timelineError = signal<string | null>(null);
  readonly timelineData = signal<OddsTimelineEntry[]>([]);

  // ── Scroll to Top ──────────────────────────────────────────────────────────
  readonly showScrollTop = signal(false);

  readonly timelineForTab = computed(() => {
    const market = this.activeTab() === 'handicap' ? 'hdc' : this.activeTab();
    return this.timelineData().filter((e) => e.market === market);
  });

  // ── Date filter ────────────────────────────────────────────────────────────
  readonly selectedDate = signal(this.todayIso());

  // ── Search inputs ──────────────────────────────────────────────────────────
  readonly eventSearchQuery = signal('');
  readonly leagueSearchQuery = signal('');

  // ── Autocomplete suggestions ───────────────────────────────────────────────
  readonly eventSuggestions = signal<string[]>([]);
  readonly leagueSuggestions = signal<string[]>([]);
  readonly isEventPanelOpen = signal(false);
  readonly isLeaguePanelOpen = signal(false);

  private readonly leagueInput$ = new Subject<string>();

  // ── Server state ───────────────────────────────────────────────────────────
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly data = signal<EventHistoryPage | null>(null);

  // ── Pagination ─────────────────────────────────────────────────────────────
  readonly currentPage = signal(0);
  readonly pageSize = 10;

  readonly totalPages = computed(() => this.data()?.totalPages ?? 1);
  readonly totalElements = computed(() => this.data()?.totalElements ?? 0);

  readonly showingStart = computed(() => {
    const d = this.data();
    if (!d || d.content.length === 0) return 0;
    return this.currentPage() * this.pageSize + 1;
  });

  readonly showingEnd = computed(() => {
    const d = this.data();
    if (!d) return 0;
    return Math.min((this.currentPage() + 1) * this.pageSize, d.totalElements);
  });

  readonly pageNumbers = computed(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    const maxButtons = 5;

    let start = Math.max(0, current - Math.floor(maxButtons / 2));
    let end = start + maxButtons - 1;

    if (end >= total) {
      end = total - 1;
      start = Math.max(0, end - maxButtons + 1);
    }

    const pages: number[] = [];
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  });

  readonly skeletonRows = computed(() => Array.from({length: 5}, (_, i) => i));

  ngOnInit(): void {
    this.leagueInput$
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((q) => {
          if (!q || q.trim().length < 1) {
            return of({suggestions: [] as string[]});
          }
          const params = new HttpParams().set('q', q.trim()).set('limit', '10');
          return this.http.get<{suggestions: string[]}>('/data/leagues/suggestions/names', {params});
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((res) => {
        this.leagueSuggestions.set(res.suggestions ?? []);
      });

    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.api
      .list({
        date: this.selectedDate(),
        q: this.eventSearchQuery() || null,
        league: this.leagueSearchQuery() || null,
        page: this.currentPage(),
        size: this.pageSize,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.data.set(page);
          this.loading.set(false);
        },
        error: (err) => {
          const msg = err?.error?.message ?? err?.message ?? 'Failed to load data.';
          this.error.set(typeof msg === 'string' ? msg : 'Failed to load data.');
          this.loading.set(false);
        },
      });
  }

  changeDate(offsetDays: number): void {
    const d = new Date(this.selectedDate());
    d.setDate(d.getDate() + offsetDays);
    this.selectedDate.set(this.toIso(d));
    this.currentPage.set(0);
    this.load();
  }

  onDatePicked(value: string): void {
    if (value) {
      this.selectedDate.set(value);
      this.currentPage.set(0);
      this.load();
    }
  }

  getFormattedDate(dateStr: string): string {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  getFormattedDateWithDay(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return `${days[d.getDay()]}, ${this.getFormattedDate(dateStr)}`;
  }

  onEventSearchInput(val: string): void {
    this.eventSearchQuery.set(val);
    this.isEventPanelOpen.set(true);

    const q = val.trim().toLowerCase();
    if (!q) {
      this.eventSuggestions.set([]);
      return;
    }

    const page = this.data();
    if (page) {
      const suggestionsSet = new Set<string>();
      page.content.forEach((e) => {
        const home = e.homeTeam ?? '';
        const away = e.awayTeam ?? '';
        const name = e.eventName ?? '';
        if (home.toLowerCase().includes(q)) suggestionsSet.add(home);
        if (away.toLowerCase().includes(q)) suggestionsSet.add(away);
        if (name.toLowerCase().includes(q)) suggestionsSet.add(name);
      });
      this.eventSuggestions.set(Array.from(suggestionsSet).slice(0, 5));
    }
  }

  pickEvent(name: string): void {
    this.eventSearchQuery.set(name);
    this.isEventPanelOpen.set(false);
    this.eventSuggestions.set([]);
    this.currentPage.set(0);
    this.load();
  }

  closeEventPanel(): void {
    setTimeout(() => {
      this.isEventPanelOpen.set(false);
    }, 200);
  }

  applyEventSearch(): void {
    this.currentPage.set(0);
    this.load();
  }

  onLeagueSearchInput(val: string): void {
    this.leagueSearchQuery.set(val);
    this.isLeaguePanelOpen.set(true);
    this.leagueInput$.next(val);
  }

  pickLeague(name: string): void {
    this.leagueSearchQuery.set(name);
    this.isLeaguePanelOpen.set(false);
    this.leagueSuggestions.set([]);
    this.currentPage.set(0);
    this.load();
  }

  closeLeaguePanel(): void {
    setTimeout(() => {
      this.isLeaguePanelOpen.set(false);
    }, 200);
  }

  applyLeagueSearch(): void {
    this.currentPage.set(0);
    this.load();
  }

  resetFilters(): void {
    this.eventSearchQuery.set('');
    this.leagueSearchQuery.set('');
    this.eventSuggestions.set([]);
    this.leagueSuggestions.set([]);
    this.currentPage.set(0);
    this.load();
  }

  prevPage(): void {
    if (this.currentPage() > 0) {
      this.currentPage.update((p) => p - 1);
      this.load();
    }
  }

  nextPage(): void {
    const d = this.data();
    if (d && this.currentPage() < d.totalPages - 1) {
      this.currentPage.update((p) => p + 1);
      this.load();
    }
  }

  goToPage(index: number): void {
    this.currentPage.set(index);
    this.load();
  }

  openModalFor(event: EventHistoryRow): void {
    this.selectedEvent.set(event);
    this.isModalOpen.set(true);
    this.loadTimeline(event.eventId);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
    this.activeTab.set('handicap');
    this.selectedEvent.set(null);
    this.timelineData.set([]);
    this.timelineError.set(null);
  }

  setTab(tab: OddsTab): void {
    this.activeTab.set(tab);
  }

  loadTimeline(eventId: number): void {
    this.timelineLoading.set(true);
    this.timelineError.set(null);
    this.timelineData.set([]);
    this.api
      .getOddsTimeline(eventId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.timelineData.set(res.data ?? []);
          this.timelineLoading.set(false);
        },
        error: (err) => {
          const msg = err?.error?.message ?? err?.message ?? 'Failed to load timeline.';
          this.timelineError.set(typeof msg === 'string' ? msg : 'Failed to load timeline.');
          this.timelineLoading.set(false);
        },
      });
  }

  formatTimelinePriceA(entry: OddsTimelineEntry): string {
    return entry.priceA != null ? entry.priceA.toFixed(2) : '—';
  }

  formatTimelinePriceB(entry: OddsTimelineEntry): string {
    return entry.priceB != null ? entry.priceB.toFixed(2) : '—';
  }

  formatCrawledAt(entry: OddsTimelineEntry): string {
    if (!entry.crawledAt) return '—';
    const d = new Date(entry.crawledAt + (entry.crawledAt.endsWith('Z') ? '' : 'Z'));
    return d.toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  }

  getMinuteClass(matchMinute: string | null | undefined): string {
    if (!matchMinute) return '';
    let clean = matchMinute.trim();
    if (clean.endsWith("'")) {
      clean = clean.slice(0, -1);
    }
    if (clean === 'HT') {
      return 'bg-orange-500/15 text-orange-400 border border-orange-500/20';
    }
    let baseMinStr = clean;
    if (clean.includes('+')) {
      baseMinStr = clean.split('+')[0];
    }
    const baseMin = parseInt(baseMinStr, 10);
    if (isNaN(baseMin)) {
      return 'bg-slate-500/15 text-slate-400 border border-slate-500/20';
    }
    if (baseMin < 45) {
      return 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20';
    }
    if (baseMin === 45) {
      return 'bg-orange-500/15 text-orange-400 border border-orange-500/20';
    }
    return 'bg-blue-500/15 text-blue-400 border border-blue-500/20';
  }

  formatMatchMinute(matchMinute: string | null | undefined): string {
    if (!matchMinute) return '';
    if (matchMinute.endsWith("'") || matchMinute === 'HT') {
      return matchMinute;
    }
    return matchMinute + "'";
  }

  parseLineValue(line: string | null | undefined): number {
    if (!line) return NaN;
    const clean = line.replace('+', '').trim();
    if (clean.includes('/')) {
      const parts = clean.split('/');
      const val1 = parseFloat(parts[0]);
      const val2 = parseFloat(parts[1]);
      if (!isNaN(val1) && !isNaN(val2)) {
        if (parts[0].startsWith('-') && !parts[1].startsWith('-') && val2 > 0) {
          return (val1 - val2) / 2;
        }
        return (val1 + val2) / 2;
      }
    }
    return parseFloat(clean);
  }

  getHdcResultTag(event: EventHistoryRow): string {
    const preOdds = event.odds?.hdc?.pre;
    if (!preOdds?.line) return '';
    const goalStr = event.ftGoalStr;
    if (!goalStr) return '';
    const parts = goalStr.split('-');
    if (parts.length !== 2) return '';
    const homeGoal = parseFloat(parts[0].trim());
    const awayGoal = parseFloat(parts[1].trim());

    const linePart = preOdds.line.includes('#') ? preOdds.line.split('#')[0] : preOdds.line;
    const handicap = this.parseLineValue(linePart);
    if (isNaN(handicap) || isNaN(homeGoal) || isNaN(awayGoal)) return '';

    const diff = homeGoal + handicap - awayGoal;
    if (diff > 0) return 'W';
    if (diff < 0) return 'A';
    return '';
  }

  getGoalResultTag(event: EventHistoryRow): string {
    const preOdds = event.odds?.ou?.pre;
    if (!preOdds?.line) return '';
    const goalStr = event.ftGoalStr;
    if (!goalStr) return '';
    const parts = goalStr.split('-');
    if (parts.length !== 2) return '';
    const total = parseFloat(parts[0].trim()) + parseFloat(parts[1].trim());
    const line = this.parseLineValue(preOdds.line);
    if (isNaN(total) || isNaN(line)) return '';
    if (total > line) return 'O';
    if (total < line) return 'U';
    return '';
  }

  getCornerResultTag(event: EventHistoryRow): string {
    const preOdds = event.odds?.corner?.pre;
    if (!preOdds?.line) return '';
    const home = event.ftHomeCorner;
    const away = event.ftAwayCorner;
    if (home == null || away == null) return '';
    const total = home + away;
    const line = this.parseLineValue(preOdds.line);
    if (isNaN(line)) return '';
    if (total > line) return 'O';
    if (total < line) return 'U';
    return '';
  }

  getHdcLine(event: EventHistoryRow): string {
    return event.odds?.hdc?.pre?.line ?? '';
  }

  getGoalLine(event: EventHistoryRow): string {
    return event.odds?.ou?.pre?.line ?? '';
  }

  getCornerLine(event: EventHistoryRow): string {
    return event.odds?.corner?.pre?.line ?? '';
  }

  copyToClipboard(text: any, event: Event): void {
    event.stopPropagation();
    const str = String(text);
    navigator.clipboard.writeText(str).then(() => {
      this.toast.success(`Copied ID: ${str} to clipboard`);
    }).catch(err => {
      this.toast.error('Failed to copy ID to clipboard');
      console.error('Could not copy text: ', err);
    });
  }


  formatScore(row: EventHistoryRow): string {
    return row.ftGoalStr ?? '? - ?';
  }

  formatCornerScore(row: EventHistoryRow): string {
    if (row.ftHomeCorner == null || row.ftAwayCorner == null) return '? - ?';
    return `${row.ftHomeCorner} - ${row.ftAwayCorner}`;
  }

  formatYellowCardScore(row: EventHistoryRow): string {
    if (row.ftHomeYellowCard == null || row.ftAwayYellowCard == null) return '? - ?';
    return `${row.ftHomeYellowCard} - ${row.ftAwayYellowCard}`;
  }

  formatOddsLine(info: EventHistoryOddsInfo | null | undefined): string {
    return info?.line ?? '—';
  }

  formatPriceA(info: EventHistoryOddsInfo | null | undefined): string {
    return info?.priceA != null ? info.priceA.toFixed(2) : '—';
  }

  formatPriceB(info: EventHistoryOddsInfo | null | undefined): string {
    return info?.priceB != null ? info.priceB.toFixed(2) : '—';
  }

  formatEventDateTime(row: EventHistoryRow): string {
    if (!row.eventDate) return '—';
    const d = new Date(row.eventDate + (row.eventDate.endsWith('Z') ? '' : 'Z'));
    return d.toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  getHomeName(row: EventHistoryRow): string {
    if (row.homeTeam) return row.homeTeam;
    return row.eventName?.split(' - ')[0]?.trim() ?? '?';
  }

  getAwayName(row: EventHistoryRow): string {
    if (row.awayTeam) return row.awayTeam;
    return row.eventName?.split(' - ')[1]?.trim() ?? '?';
  }

  @HostListener('window:scroll', [])
  onWindowScroll(): void {
    const y = window.scrollY || document.documentElement.scrollTop;
    this.showScrollTop.set(y > 300);
  }

  scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private todayIso(): string {
    return this.toIso(new Date());
  }

  private toIso(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
}
