import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {finalize} from 'rxjs';
import {LanguageService} from '../../core/i18n/language.service';
import {dateFormat, numberFormat} from '../../core/i18n/formatters';
import {ApiService} from '../../core/services/api.service';
import {apiErrorMessage} from '../../core/services/api-error';
import {ToastService} from '../../core/services/toast.service';
import {PageMeta, StorageProvider, StorageProviderUsage, StoredFile} from '../../shared/models/api.models';

const PREFERRED_KEY = 'kira.fileStorage.preferred';
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const BYTES_PER_GB = 1024 ** 3;

@Component({
  selector: 'app-admin-file-storage',
  templateUrl: './admin-file-storage.page.html', styleUrl: './admin-file-storage.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminFileStoragePage {
  readonly i18n = inject(LanguageService);
  readonly providers: StorageProvider[] = ['HUGGING_FACE', 'R2'];
  readonly usage = signal<StorageProviderUsage[]>([]);
  readonly files = signal<StoredFile[]>([]);
  readonly meta = signal<PageMeta | null>(null);
  readonly loadingUsage = signal(true);
  readonly syncedAt = signal<Date | null>(null);
  readonly loadingFiles = signal(true);
  readonly uploading = signal(false);
  readonly deletingId = signal<number | null>(null);
  readonly error = signal('');
  readonly preferred = signal<StorageProvider>(readPreferred());
  readonly selected = signal<File | null>(null);
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  constructor() { this.refresh(); }

  refresh(): void {
    this.error.set('');
    this.loadUsage();
    this.loadFiles(0);
  }

  loadUsage(): void {
    this.loadingUsage.set(true);
    this.api.get<StorageProviderUsage[]>('admin/file-storage/usage')
      .pipe(finalize(() => this.loadingUsage.set(false)))
      .subscribe({next: rows => { this.usage.set(rows); this.syncedAt.set(new Date()); }, error: () => this.error.set(this.i18n.t('fileStorage.loadFailed'))});
  }

  loadFiles(page: number): void {
    this.loadingFiles.set(true);
    this.api.page<StoredFile>('admin/file-storage/files', page, 20)
      .pipe(finalize(() => this.loadingFiles.set(false)))
      .subscribe({
        next: result => { this.files.set(result.data); this.meta.set(result.meta); },
        error: () => this.error.set(this.i18n.t('fileStorage.loadFailed'))
      });
  }

  choosePreferred(provider: StorageProvider): void {
    this.preferred.set(provider);
    try { localStorage.setItem(PREFERRED_KEY, provider); } catch { /* storage blocked: keep in memory only */ }
  }

  pick(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.error.set(file && file.size > MAX_FILE_BYTES ? this.i18n.t('fileStorage.tooLarge') : '');
    this.selected.set(file && file.size <= MAX_FILE_BYTES ? file : null);
  }

  upload(input: HTMLInputElement): void {
    const file = this.selected();
    if (!file) return;
    const preferred = this.preferred();
    this.uploading.set(true); this.error.set('');
    this.api.uploadStoredFile(file, preferred).pipe(finalize(() => this.uploading.set(false))).subscribe({
      next: stored => {
        const key = stored.provider === preferred ? 'fileStorage.uploaded' : 'fileStorage.uploadedFallback';
        this.toast.show(this.i18n.t(key).replace('{provider}', this.providerName(stored.provider)),
          stored.provider === preferred ? 'success' : 'info');
        input.value = ''; this.selected.set(null);
        this.refresh();
      },
      error: error => this.error.set(apiErrorMessage(error, this.i18n.t('fileStorage.uploadFailed')))
    });
  }

  download(file: StoredFile): void {
    this.api.storedFileContent(file.id).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url; link.download = file.originalName; link.click();
        setTimeout(() => URL.revokeObjectURL(url));
      },
      error: () => this.toast.show(this.i18n.t('fileStorage.downloadFailed'), 'error')
    });
  }

  remove(file: StoredFile): void {
    if (!window.confirm(this.i18n.t('fileStorage.deleteConfirm').replace('{name}', file.originalName))) return;
    this.deletingId.set(file.id); this.error.set('');
    this.api.delete<void>(`admin/file-storage/files/${file.id}`).pipe(finalize(() => this.deletingId.set(null))).subscribe({
      next: () => {
        this.toast.show(this.i18n.t('fileStorage.deleted'), 'success');
        const page = this.meta()?.page ?? 0;
        this.loadUsage();
        this.loadFiles(this.files().length === 1 && page > 0 ? page - 1 : page);
      },
      error: error => this.error.set(apiErrorMessage(error, this.i18n.t('fileStorage.deleteFailed')))
    });
  }

  providerName(provider: StorageProvider): string {
    return provider === 'HUGGING_FACE' ? 'Hugging Face' : 'Cloudflare R2';
  }

  percent(row: StorageProviderUsage): number {
    return this.ratio(row.usedBytes, row.freeLimitBytes);
  }

  ratio(used: number | null, limit: number): number {
    return used == null || !limit ? 0 : Math.min(100, used / limit * 100);
  }

  count(value: number | null): string {
    return value == null ? '—' : numberFormat(this.i18n.locale()).format(value);
  }

  gb(bytes: number | null): string {
    return bytes == null ? '—'
      : numberFormat(this.i18n.locale(), {maximumFractionDigits: 2}).format(bytes / BYTES_PER_GB) + ' GB';
  }

  size(bytes: number): string {
    return bytes < 1024 * 1024
      ? numberFormat(this.i18n.locale(), {maximumFractionDigits: 1}).format(bytes / 1024) + ' KB'
      : numberFormat(this.i18n.locale(), {maximumFractionDigits: 2}).format(bytes / 1024 / 1024) + ' MB';
  }

  formatDate(value: string | Date): string {
    return dateFormat(this.i18n.locale(), {dateStyle: 'short', timeStyle: 'short'}).format(new Date(value));
  }
}

function readPreferred(): StorageProvider {
  try { return localStorage.getItem(PREFERRED_KEY) === 'HUGGING_FACE' ? 'HUGGING_FACE' : 'R2'; } catch { return 'R2'; }
}
