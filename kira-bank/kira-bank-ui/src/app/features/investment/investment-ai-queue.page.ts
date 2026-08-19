import {ChangeDetectionStrategy, Component, computed, DestroyRef, HostListener, inject, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {Router} from '@angular/router';
import {catchError, of, Subscription, switchMap, timer} from 'rxjs';
import {ApiService} from '../../core/services/api.service';
import {AuthStore} from '../../core/auth/auth.store';
import {LanguageService} from '../../core/i18n/language.service';
import {ToastService} from '../../core/services/toast.service';
import {
  InvestmentAiJob,
  InvestmentAiJobStatus,
  InvestmentAiReviewTarget,
  InvestmentImportBatchStatus,
  PageMeta,
  PageResponse
} from '../../shared/models/api.models';
import {IconComponent, type IconName} from '../../shared/icon/icon';

type QueueScope = 'all' | 'mine';

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

  readonly auth = inject(AuthStore);
  readonly i18n = inject(LanguageService);
  readonly jobs = signal<InvestmentAiJob[]>([]);
  readonly meta = signal<PageMeta>({page: 0, size: InvestmentAiQueuePage.PAGE_SIZE, totalElements: 0, totalPages: 0});
  readonly scope = signal<QueueScope>(this.auth.admin() ? 'all' : 'mine');
  readonly status = signal('');
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly actingIds = signal<Set<number>>(new Set());
  readonly pendingCancel = signal<InvestmentAiJob | null>(null);
  readonly jsonJob = signal<InvestmentAiJob | null>(null);
  readonly imageJob = signal<InvestmentAiJob | null>(null);
  readonly reviewJob = signal<InvestmentAiJob | null>(null);
  readonly imageUrl = signal<string | null>(null);
  readonly imageLoading = signal(false);
  readonly imageError = signal<string | null>(null);
  readonly isAdminScope = computed(() => this.auth.admin() && this.scope() === 'all');
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
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly previousStatuses = new Map<number, InvestmentAiJobStatus>();
  private polling?: Subscription;
  private imageRequest?: Subscription;
  private reviewTrigger?: HTMLElement;
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

  @HostListener('document:keydown', ['$event'])
  modalKeydown(event: KeyboardEvent): void {
    if (!this.reviewJob()) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeReviewTargets();
      return;
    }
    if (event.key !== 'Tab') return;

    const dialog = document.querySelector<HTMLElement>('.review-target-dialog');
    const controls = Array.from(dialog?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ) ?? []);
    if (!controls.length) return;
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (!dialog?.contains(document.activeElement)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  changeScope(scope: QueueScope): void {
    if (!this.auth.admin() || this.scope() === scope) return;
    this.scope.set(scope);
    this.closeDialogs();
    this.meta.update(meta => ({...meta, page: 0}));
    this.startPolling(true);
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
    this.api.cancelInvestmentAiJob(id, this.isAdminScope())
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
    this.api.runInvestmentAiJob(id, this.isAdminScope())
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

  review(job: InvestmentAiJob, event: Event): void {
    if (job.status !== 'READY' || this.reviewDisabledReason(job) || this.isActing(job.attachmentId)) return;
    if (job.reviewTargets.length === 1) {
      void this.openReviewTarget(job.reviewTargets[0]);
      return;
    }
    this.reviewTrigger = event.currentTarget as HTMLElement;
    this.reviewJob.set(job);
    setTimeout(() => document.querySelector<HTMLElement>('.review-target-card')?.focus());
  }

  reviewDisabledReason(job: InvestmentAiJob): string | null {
    if (this.isAdminScope() && job.owner?.userId !== this.auth.user()?.id) {
      return this.i18n.t('investmentAiQueue.reviewOwnerOnly');
    }
    if (!job.reviewTargets.length) return this.i18n.t('investmentAiQueue.reviewUnavailable');
    return null;
  }

  reviewAriaLabel(job: InvestmentAiJob): string {
    const reason = this.reviewDisabledReason(job);
    return reason
      ? `${this.i18n.t('investmentAiQueue.reviewAndConfirm')}. ${reason}`
      : this.i18n.t('investmentAiQueue.reviewAndConfirm');
  }

  closeReviewTargets(restoreFocus = true): void {
    this.reviewJob.set(null);
    const trigger = this.reviewTrigger;
    this.reviewTrigger = undefined;
    if (restoreFocus && trigger?.isConnected) setTimeout(() => trigger.focus());
  }

  openReviewTarget(target: InvestmentAiReviewTarget): Promise<boolean> {
    this.closeReviewTargets(false);
    return this.router.navigate(['/app/investment/transactions'], {
      queryParams: {accountId: target.accountId, batchId: target.batchId},
      fragment: 'review'
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
    this.imageRequest = this.api.investmentAiJobContent(job.attachmentId, this.isAdminScope())
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

  batchStatusLabel(status: InvestmentImportBatchStatus): string {
    const aliases: Record<InvestmentImportBatchStatus, string> = {
      QUEUED: 'queued', PROCESSING: 'processing', READY: 'ready', READY_WITH_ERRORS: 'readyWithErrors',
      PARTIALLY_CONFIRMED: 'partiallyConfirmed', CONFIRMED: 'confirmed', FAILED: 'failed', CANCELLED: 'cancelled'
    };
    return this.i18n.t(`investmentTransactions.importStatus.${aliases[status]}`);
  }

  formatDateTime(value: string | null): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat(this.i18n.language() === 'vi' ? 'vi-VN' : 'en-US', {
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
        this.isAdminScope(), this.status(), this.meta().page, InvestmentAiQueuePage.PAGE_SIZE
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
    const review = this.reviewJob();
    if (review) {
      const latest = jobs.find(job => job.attachmentId === review.attachmentId);
      if (!latest || latest.status !== 'READY' || !latest.reviewTargets.length) {
        this.closeReviewTargets();
      } else {
        this.reviewJob.set(latest);
      }
    }
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
    this.closeReviewTargets(false);
  }

  private revokeImageUrl(): void {
    const url = this.imageUrl();
    if (url) URL.revokeObjectURL(url);
    this.imageUrl.set(null);
  }
}
