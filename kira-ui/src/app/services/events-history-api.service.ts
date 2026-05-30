import {inject, Injectable} from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import {Observable} from 'rxjs';

export interface EventHistoryOddsInfo {
  line: string | null;
  priceA: number | null;
  priceB: number | null;
}

export interface EventHistoryOddsSection {
  open: EventHistoryOddsInfo | null;
  pre: EventHistoryOddsInfo | null;
  ht: EventHistoryOddsInfo | null;
}

export interface EventHistoryOdds {
  hdc: EventHistoryOddsSection | null;
  ou: EventHistoryOddsSection | null;
  corner: EventHistoryOddsSection | null;
}

export interface EventHistoryRow {
  eventId: number;
  eventName: string | null;
  eventDate: string | null;
  status: string | null;
  leagueName: string | null;
  leagueLogoUrl: string | null;
  homeTeam: string | null;
  homeLogoUrl: string | null;
  awayTeam: string | null;
  awayLogoUrl: string | null;
  ftGoalStr: string | null;
  ftHomeCorner: number | null;
  ftAwayCorner: number | null;
  ftHomeYellowCard: number | null;
  ftAwayYellowCard: number | null;
  odds: EventHistoryOdds | null;
  link: string | null;
}

export interface EventHistoryPage {
  content: EventHistoryRow[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface OddsTimelineEntry {
  market: 'hdc' | 'ou' | 'corner';
  line: string | null;
  priceA: number | null;
  priceB: number | null;
  matchMinute: string | null;
  crawledAt: string | null;
}

@Injectable({providedIn: 'root'})
export class EventsHistoryApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/data/events/history';

  list(params: {
    date: string;
    q?: string | null;
    league?: string | null;
    page?: number;
    size?: number;
  }): Observable<EventHistoryPage> {
    let httpParams = new HttpParams()
      .set('date', params.date)
      .set('page', String(params.page ?? 0))
      .set('size', String(params.size ?? 10));

    if (params.q && params.q.trim()) {
      httpParams = httpParams.set('q', params.q.trim());
    }
    if (params.league && params.league.trim()) {
      httpParams = httpParams.set('league', params.league.trim());
    }

    return this.http.get<EventHistoryPage>(this.base, {params: httpParams});
  }

  getOddsTimeline(eventId: number): Observable<{data: OddsTimelineEntry[]}> {
    return this.http.get<{data: OddsTimelineEntry[]}>(`${this.base}/${eventId}/odds-timeline`);
  }
}
