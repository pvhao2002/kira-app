import {inject, Injectable} from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import {Observable} from 'rxjs';

export interface PredictionVersionOption {
  predictionVersionId: number;
  code: string;
  displayName: string;
  active: boolean;
}

export interface PredictionStatsSummary {
  predictionCount: number;
  settledMarketCount: number;
  totalWins: number;
  totalLosses: number;
  totalVoids: number;
  totalWinRate: number;
  hdcWins: number;
  hdcLosses: number;
  hdcVoids: number;
  hdcWinRate: number;
  ouWins: number;
  ouLosses: number;
  ouVoids: number;
  ouWinRate: number;
  bothWinCount: number;
  bothWinRate: number;
}

export interface PredictionPeriodStats {
  periodStart: string;
  label: string;
  predictionCount: number;
  totalWins: number;
  totalLosses: number;
  totalVoids: number;
  totalWinRate: number;
  hdcWins: number;
  hdcLosses: number;
  hdcWinRate: number;
  ouWins: number;
  ouLosses: number;
  ouWinRate: number;
  bothWinCount: number;
  bothWinRate: number;
}

export interface PredictionLinePairStats {
  prematchHdcLine: string;
  prematchOuLine: string;
  openHdcLine: string;
  openOuLine: string;
  bothWinCount: number;
  bothSettledCount: number;
  bothWinRate: number;
  hdcHomePickCount: number;
  hdcAwayPickCount: number;
  ouOverPickCount: number;
  ouUnderPickCount: number;
}

export interface PredictionStatisticsResponse {
  versions: PredictionVersionOption[];
  selectedVersion: PredictionVersionOption;
  from: string | null;
  to: string | null;
  latestSettledAt: string | null;
  summary: PredictionStatsSummary;
  daily: PredictionPeriodStats[];
  weekly: PredictionPeriodStats[];
  monthly: PredictionPeriodStats[];
  linePairs: PredictionLinePairStats[];
}

export interface PredictionStatisticsFilter {
  versionId?: number | null;
  from?: string | null;
  to?: string | null;
}

@Injectable({providedIn: 'root'})
export class PredictionStatisticsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/gateway/prediction-statistics';

  get(filter: PredictionStatisticsFilter): Observable<PredictionStatisticsResponse> {
    let params = new HttpParams();
    if (filter.versionId) {
      params = params.set('versionId', filter.versionId);
    }
    if (filter.from) {
      params = params.set('from', filter.from);
    }
    if (filter.to) {
      params = params.set('to', filter.to);
    }
    return this.http.get<PredictionStatisticsResponse>(this.base, {params});
  }
}
