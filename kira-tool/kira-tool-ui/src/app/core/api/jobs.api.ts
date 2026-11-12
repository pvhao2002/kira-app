import {HttpClient} from '@angular/common/http';
import {Injectable, inject} from '@angular/core';
import {Observable} from 'rxjs';

export const API = '/tool-service/api/v1';

export type JobStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'EXPIRED';

export interface Job {
  id: string;
  provider: 'DRIVE' | 'SCRIBD';
  status: JobStatus;
  stage: string | null;
  progress: number;
  errorCode: string | null;
  attempts: number;
  retryable: boolean;
  displayName: string | null;
  fileSize: number | null;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
  expiresAt: string | null;
  hasScreenshot?: boolean;
  currentUrl?: string | null;
}

/** RFC 9457 problem body; `code` is the stable machine-readable error code. */
export interface ProblemDetail {
  code?: string;
}

export const isActive = (j: Job): boolean => j.status === 'QUEUED' || j.status === 'RUNNING';

@Injectable({providedIn: 'root'})
export class JobsApi {
  private readonly http = inject(HttpClient);

  list(): Observable<Job[]> {
    return this.http.get<Job[]>(`${API}/jobs`);
  }

  submit(url: string): Observable<Job> {
    return this.http.post<Job>(`${API}/jobs`, {url});
  }

  retry(id: string): Observable<Job> {
    return this.http.post<Job>(`${API}/jobs/${id}/retry`, {});
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${API}/jobs/${id}`);
  }

  fileUrl(id: string): string {
    return `${API}/jobs/${id}/file`;
  }

  screenshotUrl(id: string): string {
    return `${API}/jobs/${id}/screenshot`;
  }
}
