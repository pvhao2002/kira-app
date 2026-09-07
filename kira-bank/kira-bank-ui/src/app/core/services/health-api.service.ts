import {inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {HealthProfile, HealthProfileView, HealthWeight, HealthSummary, HealthDevice, HealthPlan, HealthPlanData, HealthJournal, HealthJournalData, HealthAiJob} from '../../shared/models/health.models';

@Injectable({providedIn: 'root'})
export class HealthApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/v1/health';
  profile() { return this.http.get<HealthProfileView | null>(`${this.base}/profile`); }
  saveProfile(data: HealthProfile, version: number) { return this.http.put<HealthProfileView>(`${this.base}/profile`, {data, version}); }
  weights() { return this.http.get<HealthWeight[]>(`${this.base}/weights`); }
  saveWeight(data: HealthWeight) { return this.http.put<void>(`${this.base}/weights`, data); }
  deleteWeight(date: string) { return this.http.delete<void>(`${this.base}/weights/${date}`); }
  summary(date: string) { return this.http.get<HealthSummary>(`${this.base}/summary`, {params: {date}}); }
  statistics(from: string, to: string) { return this.http.get<HealthSummary[]>(`${this.base}/statistics`, {params: {from, to}}); }
  connection() { return this.http.get<HealthDevice | null>(`${this.base}/connection`); }
  disconnect(deleteData: boolean) { return this.http.delete<void>(`${this.base}/connection`, {params: {deleteData}}); }
  plans(weekStart: string) { return this.http.get<HealthPlan[]>(`${this.base}/plans`, {params: {weekStart}}); }
  savePlan(id: string | null, weekStart: string, data: HealthPlanData, version: number) {
    const body = {weekStart, data, version};
    return id ? this.http.put<HealthPlan>(`${this.base}/plans/${id}`, body) : this.http.post<HealthPlan>(`${this.base}/plans`, body);
  }
  approve(plan: HealthPlan) { return this.http.post<HealthPlan>(`${this.base}/plans/${plan.id}/approve`, {version: plan.version, restrictionsReviewed: true}); }
  complete(plan: HealthPlan, index: number, completed: boolean) {
    return this.http.put<HealthPlan>(`${this.base}/plans/${plan.id}/items/${index}/completion`, {}, {params: {version: plan.version, completed}});
  }
  journals(from: string, to: string) { return this.http.get<HealthJournal[]>(`${this.base}/journals`, {params: {from, to}}); }
  saveJournal(id: string | null, date: string, data: HealthJournalData, version: number) {
    const body = {date, data, version};
    return id ? this.http.put<HealthJournal>(`${this.base}/journals/${id}`, body) : this.http.post<HealthJournal>(`${this.base}/journals`, body);
  }
  deleteJournal(entry: HealthJournal) { return this.http.delete<void>(`${this.base}/journals/${entry.id}`, {params: {version: entry.version}}); }
  jobs() { return this.http.get<HealthAiJob[]>(`${this.base}/ai-jobs`); }
  generate(weekStart: string, fromDate: string, language: 'en' | 'vi') {
    return this.http.post<HealthAiJob>(`${this.base}/ai-jobs`, {weekStart, fromDate, language, consent: true});
  }
}
