import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {RouterLink} from '@angular/router';
import {HttpClient, HttpParams} from '@angular/common/http';
import {DatePipe, DecimalPipe} from '@angular/common';
import {Subject} from 'rxjs';
import {catchError, debounceTime, distinctUntilChanged, finalize, map, of, switchMap} from 'rxjs';

interface TeamSuggestionsResponse {
  suggestions: string[];
}

export interface TeamRow {
  teamId: number;
  teamName: string;
  logoUrl: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface TeamPage {
  content: TeamRow[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

@Component({
  selector: 'app-teams',
  imports: [RouterLink, DatePipe, DecimalPipe],
  templateUrl: './teams.html',
  styleUrl: './teams.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Teams {
  private readonly http = inject(HttpClient);

  private readonly teamNameSuggest$ = new Subject<string>();
  private teamNameBlurTimer: ReturnType<typeof setTimeout> | null = null;

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly data = signal<TeamPage | null>(null);

  readonly pageIndex = signal(0);
  readonly pageSize = signal(20);

  readonly draftQ = signal('');
  readonly appliedQ = signal('');

  readonly teamNameSuggestions = signal<string[]>([]);
  readonly teamNameSuggestLoading = signal(false);
  readonly teamNamePanelOpen = signal(false);

  readonly showTeamNameDropdown = computed(
    () =>
      this.teamNamePanelOpen() &&
      (this.teamNameSuggestions().length > 0 || this.teamNameSuggestLoading()),
  );

  constructor() {
    this.load();

    this.teamNameSuggest$
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap(q => {
          const t = q.trim();
          if (t.length < 1) {
            return of([] as string[]);
          }
          this.teamNameSuggestLoading.set(true);
          return this.http
            .get<TeamSuggestionsResponse>('/data/teams/suggestions/names', {
              params: new HttpParams().set('q', t).set('limit', '15'),
            })
            .pipe(
              map(r => r.suggestions),
              catchError(() => of([] as string[])),
              finalize(() => this.teamNameSuggestLoading.set(false)),
            );
        }),
        takeUntilDestroyed(),
      )
      .subscribe(list => this.teamNameSuggestions.set(list));
  }

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
    this.pageIndex.set(0);
    this.load();
  }

  onTeamNameInput(value: string): void {
    this.draftQ.set(value);
    this.teamNameSuggest$.next(value);
  }

  onTeamNameFocus(): void {
    if (this.teamNameBlurTimer !== null) {
      clearTimeout(this.teamNameBlurTimer);
      this.teamNameBlurTimer = null;
    }
    this.teamNamePanelOpen.set(true);
    this.teamNameSuggest$.next(this.draftQ());
  }

  onTeamNameBlur(): void {
    this.teamNameBlurTimer = setTimeout(() => {
      this.teamNamePanelOpen.set(false);
      this.teamNameBlurTimer = null;
    }, 200);
  }

  pickTeamName(name: string): void {
    this.draftQ.set(name);
    this.teamNameSuggestions.set([]);
    this.teamNamePanelOpen.set(false);
  }

  closeTeamNamePanel(): void {
    this.teamNamePanelOpen.set(false);
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);

    let params = new HttpParams()
      .set('page', String(this.pageIndex()))
      .set('size', String(this.pageSize()));

    const q = this.appliedQ();
    if (q) {
      params = params.set('q', q);
    }

    this.http.get<TeamPage>('/data/teams', {params}).subscribe({
      next: body => {
        this.data.set(body);
        this.loading.set(false);
      },
      error: err => {
        const msg = err?.error?.message ?? err?.message ?? 'Unable to load data.';
        this.error.set(typeof msg === 'string' ? msg : 'Unable to load data.');
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
