import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {HttpClient, HttpParams} from '@angular/common/http';
import {DatePipe, DecimalPipe} from '@angular/common';
import {Subject} from 'rxjs';
import {catchError, debounceTime, distinctUntilChanged, finalize, map, of, switchMap} from 'rxjs';

import {flagUrlFromCountry} from './league-country-flag';

interface LeagueSuggestionsResponse {
  suggestions: string[];
}

export interface LeagueRow {
  leagueId: number;
  leagueName: string;
  logoUrl: string | null;
  country: string | null;
  isMain: boolean;
  totalEvents: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface LeaguePage {
  content: LeagueRow[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export type IsMainFilterMode = 'all' | 'main' | 'nonmain';

@Component({
  selector: 'app-leagues',
  imports: [DatePipe, DecimalPipe],
  templateUrl: './leagues.html',
  styleUrl: './leagues.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Leagues {
  private readonly http = inject(HttpClient);

  private readonly leagueNameSuggest$ = new Subject<string>();
  private readonly countrySuggest$ = new Subject<string>();
  private leagueNameBlurTimer: ReturnType<typeof setTimeout> | null = null;
  private countryBlurTimer: ReturnType<typeof setTimeout> | null = null;

  /** Flag image URL from `country` text (flagcdn); expose for template. */
  readonly flagUrlFromCountry = flagUrlFromCountry;

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly data = signal<LeaguePage | null>(null);

  readonly pageIndex = signal(0);
  readonly pageSize = signal(20);

  /** Draft inputs before user clicks Search */
  readonly draftQ = signal('');
  readonly draftCountry = signal('');

  readonly leagueNameSuggestions = signal<string[]>([]);
  readonly countrySuggestions = signal<string[]>([]);
  readonly leagueNameSuggestLoading = signal(false);
  readonly countrySuggestLoading = signal(false);
  readonly leagueNamePanelOpen = signal(false);
  readonly countryPanelOpen = signal(false);

  readonly appliedQ = signal('');
  readonly appliedCountry = signal('');
  readonly isMainFilter = signal<IsMainFilterMode>('all');

  readonly patchingId = signal<number | null>(null);
  readonly patchError = signal<string | null>(null);

  constructor() {
    this.load();

    this.leagueNameSuggest$
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap(q => {
          const t = q.trim();
          if (t.length < 1) {
            return of([] as string[]);
          }
          this.leagueNameSuggestLoading.set(true);
          return this.http
            .get<LeagueSuggestionsResponse>('/data/leagues/suggestions/names', {
              params: new HttpParams().set('q', t).set('limit', '15'),
            })
            .pipe(
              map(r => r.suggestions),
              catchError(() => of([] as string[])),
              finalize(() => this.leagueNameSuggestLoading.set(false)),
            );
        }),
        takeUntilDestroyed(),
      )
      .subscribe(list => this.leagueNameSuggestions.set(list));

    this.countrySuggest$
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap(q => {
          const t = q.trim();
          if (t.length < 1) {
            return of([] as string[]);
          }
          this.countrySuggestLoading.set(true);
          return this.http
            .get<LeagueSuggestionsResponse>('/data/leagues/suggestions/countries', {
              params: new HttpParams().set('q', t).set('limit', '15'),
            })
            .pipe(
              map(r => r.suggestions),
              catchError(() => of([] as string[])),
              finalize(() => this.countrySuggestLoading.set(false)),
            );
        }),
        takeUntilDestroyed(),
      )
      .subscribe(list => this.countrySuggestions.set(list));
  }

  onLeagueNameInput(value: string): void {
    this.draftQ.set(value);
    this.leagueNameSuggest$.next(value);
  }

  onLeagueNameFocus(): void {
    if (this.leagueNameBlurTimer !== null) {
      clearTimeout(this.leagueNameBlurTimer);
      this.leagueNameBlurTimer = null;
    }
    this.leagueNamePanelOpen.set(true);
    this.leagueNameSuggest$.next(this.draftQ());
  }

  onLeagueNameBlur(): void {
    this.leagueNameBlurTimer = setTimeout(() => {
      this.leagueNamePanelOpen.set(false);
      this.leagueNameBlurTimer = null;
    }, 200);
  }

  pickLeagueName(name: string): void {
    this.draftQ.set(name);
    this.leagueNameSuggestions.set([]);
    this.leagueNamePanelOpen.set(false);
  }

  closeLeagueNamePanel(): void {
    this.leagueNamePanelOpen.set(false);
  }

  onCountryInput(value: string): void {
    this.draftCountry.set(value);
    this.countrySuggest$.next(value);
  }

  onCountryFocus(): void {
    if (this.countryBlurTimer !== null) {
      clearTimeout(this.countryBlurTimer);
      this.countryBlurTimer = null;
    }
    this.countryPanelOpen.set(true);
    this.countrySuggest$.next(this.draftCountry());
  }

  onCountryBlur(): void {
    this.countryBlurTimer = setTimeout(() => {
      this.countryPanelOpen.set(false);
      this.countryBlurTimer = null;
    }, 200);
  }

  pickCountry(country: string): void {
    this.draftCountry.set(country);
    this.countrySuggestions.set([]);
    this.countryPanelOpen.set(false);
  }

  closeCountryPanel(): void {
    this.countryPanelOpen.set(false);
  }

  readonly showLeagueNameDropdown = computed(
    () =>
      this.leagueNamePanelOpen() &&
      (this.leagueNameSuggestions().length > 0 || this.leagueNameSuggestLoading()),
  );

  readonly showCountryDropdown = computed(
    () =>
      this.countryPanelOpen() &&
      (this.countrySuggestions().length > 0 || this.countrySuggestLoading()),
  );

  initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) {
      return '?';
    }
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  applySearch(): void {
    this.appliedQ.set(this.draftQ().trim());
    this.appliedCountry.set(this.draftCountry().trim());
    this.pageIndex.set(0);
    this.load();
  }

  setMainFilter(mode: IsMainFilterMode): void {
    this.isMainFilter.set(mode);
    this.pageIndex.set(0);
    this.load();
  }

  setMainLeague(row: LeagueRow, isMain: boolean): void {
    if (this.patchingId() !== null) {
      return;
    }
    this.patchingId.set(row.leagueId);
    this.patchError.set(null);
    this.http
      .patch<{ status: string }>(`/data/leagues/${row.leagueId}/main`, {isMain})
      .subscribe({
        next: () => {
          this.patchingId.set(null);
          this.load();
        },
        error: err => {
          this.patchingId.set(null);
          const msg = err?.error?.message ?? err?.message ?? 'Không cập nhật được.';
          this.patchError.set(typeof msg === 'string' ? msg : 'Không cập nhật được.');
        }
      });
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.patchError.set(null);

    let params = new HttpParams()
      .set('page', String(this.pageIndex()))
      .set('size', String(this.pageSize()));

    const q = this.appliedQ();
    if (q) {
      params = params.set('q', q);
    }
    const country = this.appliedCountry();
    if (country) {
      params = params.set('country', country);
    }
    const main = this.isMainFilter();
    if (main === 'main') {
      params = params.set('isMain', 'true');
    } else if (main === 'nonmain') {
      params = params.set('isMain', 'false');
    }

    this.http.get<LeaguePage>('/data/leagues', {params}).subscribe({
      next: body => {
        this.data.set(body);
        this.loading.set(false);
      },
      error: err => {
        const msg = err?.error?.message ?? err?.message ?? 'Không tải được dữ liệu.';
        this.error.set(typeof msg === 'string' ? msg : 'Không tải được dữ liệu.');
        this.loading.set(false);
      }
    });
  }

  prev(): void {
    if (this.pageIndex() <= 0) {
      return;
    }
    this.pageIndex.update(p => p - 1);
    this.load();
  }

  next(): void {
    const d = this.data();
    if (!d || this.pageIndex() >= d.totalPages - 1) {
      return;
    }
    this.pageIndex.update(p => p + 1);
    this.load();
  }
}
