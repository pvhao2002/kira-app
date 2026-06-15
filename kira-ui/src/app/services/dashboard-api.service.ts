import {inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';

export interface DashboardCardHighlight {
  cardLabel: string;
  lastFour: string;
}

export interface DashboardFinance {
  totalOutstandingBalance: number;
  activeCardCount: number;
  totalCreditLimit: number;
  utilizationPercent: number;
  nextDueLabel: string;
  daysUntilDue: number;
  cardHighlights: DashboardCardHighlight[];
}

export interface DashboardSoccer {
  trackedMatchCount: number;
  trackedThisWeek: number;
  winRatePercent: number;
  netProfit: number;
  wins: number;
  losses: number;
}

export interface DashboardProfitPoint {
  label: string;
  date: string;
  amount: number;
}

export interface DashboardActivityItem {
  type: 'transaction' | 'prediction' | 'card_payment';
  title: string;
  subtitle: string;
  amount: number;
  occurredAt: string | null;
  positive: boolean;
}

export interface DashboardResponse {
  username: string;
  role: string;
  finance: DashboardFinance;
  soccer: DashboardSoccer | null;
  profitChart: DashboardProfitPoint[] | null;
  recentActivity: DashboardActivityItem[];
}

@Injectable({providedIn: 'root'})
export class DashboardApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/gateway/dashboard';

  get(): Observable<DashboardResponse> {
    return this.http.get<DashboardResponse>(this.base);
  }
}
