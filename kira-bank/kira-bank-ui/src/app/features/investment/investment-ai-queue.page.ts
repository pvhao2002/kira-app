import {ChangeDetectionStrategy, Component, computed, DestroyRef, HostListener, inject, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {catchError, of, Subscription, switchMap, timer} from 'rxjs';
import {ApiService} from '../../core/services/api.service';
import {LanguageService} from '../../core/i18n/language.service';
import {ToastService} from '../../core/services/toast.service';
import {
  InvestmentAiJob,
  InvestmentAiJobStatus,
  PageMeta,
  PageResponse
} from '../../shared/models/api.models';
import {IconComponent, type IconName} from '../../shared/icon/icon';
import {dateFormat} from '../../core/i18n/formatters';

@Component({
  selector: 'app-investment-ai-queue',
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './investment-ai-queue.page.html',
  styleUrl: './investment-ai-queue.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InvestmentAiQueuePage {
  private static readonly PAGE_SIZE = 20;
  private static readonly ACTIVE_STATUSES = new Set<InvestmentAiJobStatus>(['PENDING', 'PROCESSING']);

  readonly i18n = inject(LanguageService);
  readonly jobs = signal<InvestmentAiJob[]>([]);
  readonly meta = signal<PageMeta>({page: 0, size: InvestmentAiQueuePage.PAGE_SIZE, totalElements: 0, totalPages: 0});
  readonly status = signal('');
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly actingIds = signal<Set<number>>(new Set());
  readonly pendingCancel = signal<InvestmentAiJob | null>(null);
  readonly jsonJob = signal<InvestmentAiJob | null>(null);
  readonly imageJob = signal<InvestmentAiJob | null>(null);
  readonly imageUrl = signal<string | null>(null);
  readonly imageLoading = signal(false);
  readonly imageError = signal<string | null>(null);
  readonly jsonText = computed(() => JSON.stringify(this.jsonJob()?.detectedJson ?? {}, null, 2));
  readonly rangeStart = computed(() => this.meta().totalElements ? this.meta().page * this.meta().size + 1 : 0);
  readonly rangeEnd = computed(() => Math.min((this.meta().page + 1) * this.meta().size, this.meta().totalElements));
  readonly statusOptions: Array<{value: '' | InvestmentAiJobStatus; key: string}> = [
    {value: '', key: 'investmentAiQueue.status.all'},
    {value: 'PENDING', key: 'investmentAiQueue.status.pending'},
    {value: 'PROCESSING', key: 'investmentAiQueue.status.processing'},
    {value: 'READY', key: 'investmentAiQueue.status.ready'},
    {value: 'FAILED', key: 'investmentAiQueue.status.failed'},
    {value: 'CANCELLED', key: 'investmentAiQueue.status.cancelled'},
    {value: 'CONFIRMED', key: 'investmentAiQueue.status.confirmed'}
  ];

  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly previousStatuses = new Map<number, InvestmentAiJobStatus>();
  private polling?: Subscription;
  private imageRequest?: Subscription;
  private hasSnapshot = false;

  constructor() {
    this.startPolling(true);
    this.destroyRef.onDestroy(() => {
      this.polling?.unsubscribe();
      this.imageRequest?.unsubscribe();
      this.revokeImageUrl();
    });
  }

  @HostListener('document:visibilitychange')
  visibilityChanged(): void {
    if (document.hidden) {
      this.polling?.unsubscribe();
    } else {
      this.startPolling(false);
    }
  }

  changeStatus(status: string): void {
    this.status.set(status);
    this.meta.update(meta => ({...meta, page: 0}));
    this.startPolling(true);
  }

  goToPage(page: number): void {
    const meta = this.meta();
    if (page < 0 || page >= meta.totalPages || page === meta.page) return;
    this.meta.update(current => ({...current, page}));
    this.startPolling(true);
  }

  refresh(): void {
    this.loading.set(true);
    this.startPolling(false);
  }

  requestCancel(job: InvestmentAiJob): void {
    if (this.isActing(job.attachmentId)) return;
    this.pendingCancel.set(job);
  }

  confirmCancel(): void {
    const job = this.pendingCancel();
    if (!job) return;
    const id = job.attachmentId;
    this.setActing(id, true);
    this.api.cancelInvestmentAiJob(id, true)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: job => {
        this.updateJob(job);
        this.previousStatuses.set(job.attachmentId, job.status);
        this.pendingCancel.set(null);
        this.setActing(id, false);
        this.toast.show(this.i18n.t('investmentAiQueue.cancelledToast', {id}), 'success');
        this.startPolling(false);
      },
      error: () => {
        this.setActing(id, false);
        this.error.set(this.i18n.t('investmentAiQueue.actionError'));
      }
    });
  }

  run(job: InvestmentAiJob): void {
    const id = job.attachmentId;
    if (!job.canRun || this.isActing(id)) return;
    this.setActing(id, true);
    this.api.runInvestmentAiJob(id, true)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: runningJob => {
        this.updateJob(runningJob);
        this.previousStatuses.set(runningJob.attachmentId, runningJob.status);
        this.setActing(id, false);
        this.toast.show(this.i18n.t('investmentAiQueue.runningToast', {id}), 'info');
        this.startPolling(false);
      },
      error: () => {
        this.setActing(id, false);
        this.error.set(this.i18n.t('investmentAiQueue.actionError'));
      }
    });
  }

  viewJson(job: InvestmentAiJob): void {
    if (job.detectedJson) this.jsonJob.set(job);
  }

  closeJson(): void {
    this.jsonJob.set(null);
  }

  viewImage(job: InvestmentAiJob): void {
    if (!job.contentAvailable) return;
    this.revokeImageUrl();
    this.imageJob.set(job);
    this.imageLoading.set(true);
    this.imageError.set(null);
    this.imageRequest?.unsubscribe();
    this.imageRequest = this.api.investmentAiJobContent(job.attachmentId, true)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: blob => {
          this.imageUrl.set(URL.createObjectURL(blob));
          this.imageLoading.set(false);
        },
        error: () => {
          this.imageLoading.set(false);
          this.imageError.set(this.i18n.t('investmentAiQueue.imageError'));
        }
      });
  }

  closeImage(): void {
    this.imageRequest?.unsubscribe();
    this.imageRequest = undefined;
    this.revokeImageUrl();
    this.imageJob.set(null);
    this.imageError.set(null);
    this.imageLoading.set(false);
  }

  isActing(id: number): boolean {
    return this.actingIds().has(id);
  }

  statusLabel(status: InvestmentAiJobStatus): string {
    return this.i18n.t(`investmentAiQueue.status.${status.toLowerCase()}`);
  }

  statusIcon(status: InvestmentAiJobStatus): IconName {
    switch (status) {
      case 'PENDING': return 'clock';
      case 'PROCESSING': return 'loader';
      case 'READY': return 'check-circle';
      case 'FAILED': return 'alert-circle';
      case 'CANCELLED': return 'x-circle';
      case 'CONFIRMED': return 'shield-check';
    }
  }

  formatDateTime(value: string | null): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return dateFormat(this.i18n.locale(), {
      dateStyle: 'medium', timeStyle: 'short'
    }).format(date);
  }

  formatBytes(value: number): string {
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }

  private startPolling(resetStatuses: boolean): void {
    this.polling?.unsubscribe();
    if (resetStatuses) {
      this.previousStatuses.clear();
      this.hasSnapshot = false;
    }
    if (document.hidden) return;
    if (resetStatuses || !this.jobs().length) this.loading.set(true);
    this.polling = timer(0, 5000).pipe(
      switchMap(() => this.api.investmentAiJobs(
        true, this.status(), this.meta().page, InvestmentAiQueuePage.PAGE_SIZE
      ).pipe(catchError(() => {
        this.loading.set(false);
        this.error.set(this.i18n.t('investmentAiQueue.loadError'));
        return of(null);
      }))),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(response => {
      if (response) this.applyResponse(response);
    });
  }

  private applyResponse(response: PageResponse<InvestmentAiJob>): void {
    if (this.hasSnapshot) {
      for (const job of response.data) {
        const previous = this.previousStatuses.get(job.attachmentId);
        if (previous && InvestmentAiQueuePage.ACTIVE_STATUSES.has(previous)
          && !InvestmentAiQueuePage.ACTIVE_STATUSES.has(job.status)) {
          this.toast.show(this.i18n.t('investmentAiQueue.completedToast', {
            id: job.attachmentId, status: this.statusLabel(job.status)
          }), job.status === 'FAILED' ? 'error' : 'success');
        }
      }
    }
    this.jobs.set(response.data);
    this.meta.set(response.meta);
    this.error.set(null);
    this.loading.set(false);
    this.previousStatuses.clear();
    response.data.forEach(job => this.previousStatuses.set(job.attachmentId, job.status));
    this.hasSnapshot = true;
    this.syncOpenDialogs(response.data);
  }

  private syncOpenDialogs(jobs: InvestmentAiJob[]): void {
    const json = this.jsonJob();
    if (json) this.jsonJob.set(jobs.find(job => job.attachmentId === json.attachmentId) ?? json);
    const image = this.imageJob();
    if (image) this.imageJob.set(jobs.find(job => job.attachmentId === image.attachmentId) ?? image);
  }

  private updateJob(updated: InvestmentAiJob): void {
    this.jobs.update(jobs => jobs.map(job => job.attachmentId === updated.attachmentId ? updated : job));
    this.syncOpenDialogs(this.jobs());
  }

  private setActing(id: number, active: boolean): void {
    this.actingIds.update(current => {
      const next = new Set(current);
      active ? next.add(id) : next.delete(id);
      return next;
    });
  }

  private closeDialogs(): void {
    this.pendingCancel.set(null);
    this.closeJson();
    this.closeImage();
  }

  private revokeImageUrl(): void {
    const url = this.imageUrl();
    if (url) URL.revokeObjectURL(url);
    this.imageUrl.set(null);
  }
}
