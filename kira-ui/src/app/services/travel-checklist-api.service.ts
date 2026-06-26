import {inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';

export type TravelChecklistScheduleType = 'CHECK_LIST' | 'DAY' | 'TIME_SLOT';

export interface TravelChecklistItemDto {
  itemId: number;
  content?: string | null;
  activityTime: string | null;
  activity: string;
  address: string | null;
  cost: number | null;
  note: string | null;
  checked: boolean;
  sortOrder: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface TravelChecklistGroupDto {
  groupId: number;
  scheduleType: TravelChecklistScheduleType;
  scheduleDate: string | null;
  startTime: string | null;
  endTime: string | null;
  title: string;
  sortOrder: number;
  items: TravelChecklistItemDto[];
  createdAt: string | null;
  updatedAt: string | null;
}

export interface TravelChecklistPlanDto {
  planId: number;
  planName: string;
  published: boolean;
  groups: TravelChecklistGroupDto[];
  createdAt: string | null;
  updatedAt: string | null;
}

export interface UpdateTravelChecklistPlanPayload {
  planName?: string | null;
  published?: boolean | null;
}

export interface CreateTravelChecklistGroupPayload {
  scheduleType: TravelChecklistScheduleType;
  scheduleDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  title: string;
  sortOrder?: number | null;
}

export interface UpdateTravelChecklistGroupPayload {
  scheduleType?: TravelChecklistScheduleType | null;
  scheduleDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  title?: string | null;
  sortOrder?: number | null;
}

export interface CreateTravelChecklistItemPayload {
  activityTime?: string | null;
  activity: string;
  address?: string | null;
  cost?: number | null;
  note?: string | null;
  checked?: boolean | null;
  sortOrder?: number | null;
}

export interface UpdateTravelChecklistItemPayload {
  activityTime?: string | null;
  activity?: string | null;
  address?: string | null;
  cost?: number | null;
  note?: string | null;
  checked?: boolean | null;
  sortOrder?: number | null;
}

@Injectable({providedIn: 'root'})
export class TravelChecklistApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/gateway/travel-checklists';

  list(): Observable<TravelChecklistPlanDto[]> {
    return this.http.get<TravelChecklistPlanDto[]>(this.base);
  }

  listPublished(): Observable<TravelChecklistPlanDto[]> {
    return this.http.get<TravelChecklistPlanDto[]>(`${this.base}/public`);
  }

  createPlan(planName: string): Observable<TravelChecklistPlanDto> {
    return this.http.post<TravelChecklistPlanDto>(this.base, {planName});
  }

  updatePlan(planId: number, body: UpdateTravelChecklistPlanPayload): Observable<TravelChecklistPlanDto> {
    return this.http.patch<TravelChecklistPlanDto>(`${this.base}/${planId}`, body);
  }

  deletePlan(planId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${planId}`);
  }

  createGroup(planId: number, body: CreateTravelChecklistGroupPayload): Observable<TravelChecklistGroupDto> {
    return this.http.post<TravelChecklistGroupDto>(`${this.base}/${planId}/groups`, body);
  }

  updateGroup(planId: number, groupId: number, body: UpdateTravelChecklistGroupPayload): Observable<TravelChecklistGroupDto> {
    return this.http.patch<TravelChecklistGroupDto>(`${this.base}/${planId}/groups/${groupId}`, body);
  }

  deleteGroup(planId: number, groupId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${planId}/groups/${groupId}`);
  }

  createItem(planId: number, groupId: number, body: CreateTravelChecklistItemPayload): Observable<TravelChecklistItemDto> {
    return this.http.post<TravelChecklistItemDto>(`${this.base}/${planId}/groups/${groupId}/items`, body);
  }

  updateItem(
    planId: number,
    groupId: number,
    itemId: number,
    body: UpdateTravelChecklistItemPayload
  ): Observable<TravelChecklistItemDto> {
    return this.http.patch<TravelChecklistItemDto>(`${this.base}/${planId}/groups/${groupId}/items/${itemId}`, body);
  }

  deleteItem(planId: number, groupId: number, itemId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${planId}/groups/${groupId}/items/${itemId}`);
  }
}
