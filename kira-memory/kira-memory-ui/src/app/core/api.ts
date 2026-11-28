import {HttpClient, HttpEvent} from '@angular/common/http';
import {inject, Injectable} from '@angular/core';
import {Observable} from 'rxjs';

export type Role = 'ADMIN' | 'VIEWER';
export type Shape = 'heart' | 'circle' | 'star' | 'flower' | 'cloud' | 'envelope' | 'bubble';
/** What the admin picks: one shape, or 'auto' to change it every minute. */
export type WidgetShape = Shape | 'auto';
export type StorageProvider = 'HUGGING_FACE' | 'R2';

export interface User { id: number; username: string; role: Role; displayName: string; }
export interface Media {
  id: number; kind: 'IMAGE' | 'VIDEO'; contentType: string; width: number | null; height: number | null;
  caption: string | null; groupId: number | null; takenAt: string; createdAt: string; provider: StorageProvider;
  url: string; thumbUrl: string;
}
export interface MediaPage { items: Media[]; nextCursor: string | null; }
export interface Group { id: number; name: string; pinned: boolean; count: number; coverUrl: string | null; }
export interface Message { id: number; author: string; authorName: string; body: string; createdAt: string; }
export interface AdminSettings {
  widgetShape: WidgetShape; storageProvider: StorageProvider; bannerMediaId: number | null;
  huggingFaceConfigured: boolean; r2Configured: boolean;
}
/** Em's period start days (YYYY-MM-DD), newest first. */
export interface Cycle { starts: string[]; }
export interface UploadStatus {
  uploadId: string; state: 'RECEIVING' | 'PROCESSING' | 'DONE' | 'FAILED'; size: number; chunkSize: number;
  totalChunks: number; receivedChunks: number; missingChunks: number[]; media: Media | null; error: string | null;
}
/** 'all', 'ungrouped' or an album id. */
export type Filter = 'all' | 'ungrouped' | number;

@Injectable({providedIn: 'root'})
export class Api {
  private http = inject(HttpClient);

  login(username: string, password: string) { return this.http.post<User>('/api/auth/login', {username, password}); }
  logout() { return this.http.post<void>('/api/auth/logout', {}); }
  me() { return this.http.get<User>('/api/auth/me'); }
  changePassword(currentPassword: string, newPassword: string) {
    return this.http.put<User>('/api/auth/password', {currentPassword, newPassword});
  }
  resetPassword(username: string, newPassword: string) {
    return this.http.put<void>(`/api/admin/users/${encodeURIComponent(username)}/password`, {newPassword});
  }
  loginBanner() { return this.http.get<{since: string; imageUrl: string | null}>('/api/public/login-banner'); }

  media(filter: Filter, cursor: string | null, limit = 60) {
    const params: Record<string, string | number> = {limit};
    if (filter === 'ungrouped') params['ungrouped'] = 'true';
    else if (filter !== 'all') params['groupId'] = filter;
    if (cursor) params['cursor'] = cursor;
    return this.http.get<MediaPage>('/api/media', {params});
  }
  createUpload(contentType: string, size: number) {
    return this.http.post<UploadStatus>('/api/admin/uploads', {contentType, size});
  }
  putChunk(id: string, index: number, chunk: Blob): Observable<HttpEvent<UploadStatus>> {
    return this.http.put<UploadStatus>(`/api/admin/uploads/${id}/chunks/${index}`, chunk,
      {headers: {'Content-Type': 'application/octet-stream'}, reportProgress: true, observe: 'events'});
  }
  completeUpload(id: string, form: FormData) { return this.http.post<UploadStatus>(`/api/admin/uploads/${id}/complete`, form); }
  uploadStatus(id: string) { return this.http.get<UploadStatus>(`/api/admin/uploads/${id}`); }
  updateMedia(id: number, caption: string | null, groupId: number | null) {
    return this.http.put<Media>(`/api/admin/media/${id}`, {caption, groupId});
  }
  moveMedia(ids: number[], groupId: number | null) { return this.http.post<{moved: number}>('/api/admin/media/move', {ids, groupId}); }
  deleteMedia(id: number) { return this.http.delete<void>(`/api/admin/media/${id}`); }
  /** 1–200 ids; unknown ones are skipped. */
  deleteMany(ids: number[]) { return this.http.post<{deleted: number}>('/api/admin/media/delete', {ids}); }

  groups() { return this.http.get<Group[]>('/api/groups'); }
  createGroup(name: string, pinned: boolean) { return this.http.post<Group>('/api/admin/groups', {name, pinned}); }
  updateGroup(id: number, name: string, pinned: boolean) { return this.http.put<Group>(`/api/admin/groups/${id}`, {name, pinned}); }
  deleteGroup(id: number) { return this.http.delete<void>(`/api/admin/groups/${id}`); }

  messages(before?: number) {
    return this.http.get<Message[]>('/api/messages', {params: before ? {before} : {}});
  }
  sendMessage(body: string) { return this.http.post<Message>('/api/messages', {body}); }

  settings() { return this.http.get<{widgetShape: WidgetShape}>('/api/settings'); }

  cycle() { return this.http.get<Cycle>('/api/cycle'); }
  addCycleStart(day: string) { return this.http.post<Cycle>('/api/cycle', {day}); }
  deleteCycleStart(day: string) { return this.http.delete<Cycle>(`/api/cycle/${day}`); }
  adminSettings() { return this.http.get<AdminSettings>('/api/admin/settings'); }
  updateSettings(patch: Partial<{widgetShape: WidgetShape; storageProvider: StorageProvider; bannerMediaId: number; clearBanner: boolean}>) {
    return this.http.put<AdminSettings>('/api/admin/settings', patch);
  }
}

/** The server's Vietnamese message, or a fallback. */
export function errorMessage(err: unknown, fallback = 'Có lỗi xảy ra, thử lại nhé'): string {
  const e = err as {error?: {message?: string}; status?: number};
  if (e?.status === 0) return 'Không kết nối được máy chủ';
  return e?.error?.message ?? fallback;
}
