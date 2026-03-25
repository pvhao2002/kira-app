import {Component, OnDestroy, OnInit, signal} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {CustomFileModel} from './CustomFile.model';
import {ToastService} from '../../config/ToastService';
import {interval, startWith, Subject, switchMap, takeUntil} from 'rxjs';
import {FormsModule} from '@angular/forms';

@Component({
  selector: 'app-tools',
  imports: [
    FormsModule
  ],
  standalone: true,
  templateUrl: './tools.html',
  styleUrl: './tools.css',
})
export class Tools implements OnInit, OnDestroy {
  data = signal<CustomFileModel[]>([]);
  driveData = signal<CustomFileModel[]>([]);
  url = signal<string>('');
  driveUrl = signal<string>('');
  scribdProcessing = signal(false);
  driveProcessing = signal(false);
  expectedScribdFileName = signal<string | null>(null);
  expectedDriveFileName = signal<string | null>(null);
  previewImageSrc: string | null = null;
  destroy$ = new Subject<void>();

  constructor(protected readonly http: HttpClient,
              protected readonly toastService: ToastService) {
  }

  ngOnInit(): void {
    interval(7000)
      .pipe(
        startWith(0),
        switchMap(() =>
          this.http.get<CustomFileModel[]>('tool-service/scribd')
        ),
        takeUntil(this.destroy$)
      )
      .subscribe(res => {
        if (this.scribdProcessing() && this.expectedScribdFileName() && res.some(file => file.name === this.expectedScribdFileName())) {
          this.scribdProcessing.set(false);
          this.expectedScribdFileName.set(null);
          this.toastService.success('Done!', 'Scribd PDF is ready');
        }
        this.data.set(res);
      });

    interval(7000)
      .pipe(
        startWith(0),
        switchMap(() =>
          this.http.get<CustomFileModel[]>('tool-service/google-drive')
        ),
        takeUntil(this.destroy$)
      )
      .subscribe(res => {
        const expectedName = this.expectedDriveFileName();
        if (this.driveProcessing() && expectedName) {
          const failedMarker = res.find(file => file.name === expectedName + '.failed');
          if (failedMarker) {
            this.driveProcessing.set(false);
            this.expectedDriveFileName.set(null);
            this.toastService.error('Export failed', 'Could not extract pages from this Drive link');
            this.http.delete(`tool-service/google-drive/${encodeURIComponent(failedMarker.name)}`).subscribe();
          } else if (res.some(file => file.name === expectedName)) {
            this.driveProcessing.set(false);
            this.expectedDriveFileName.set(null);
            this.toastService.success('Done!', 'Google Drive PDF is ready');
          }
        }
        this.driveData.set(res.filter(f => !f.name.endsWith('.failed')));
      });
  }

  refreshScribdFiles(): void {
    this.http.get<CustomFileModel[]>('tool-service/scribd')
      .subscribe(res => this.data.set(res));
  }

  refreshDriveFiles(): void {
    this.http.get<CustomFileModel[]>('tool-service/google-drive')
      .subscribe(res => this.driveData.set(res));
  }

  decodeUrl(): void {
    this.url.set(decodeURIComponent(this.url()));
  }

  test(): void {
    this.http.post<{ status: boolean; fileName: string }>('tool-service/scribd', {url: this.url()})
      .subscribe(res => {
        this.expectedScribdFileName.set(res.fileName);
        this.scribdProcessing.set(true);
        this.url.set('');
      });
  }

  submitDriveUrl(): void {
    this.http.post<{ status: boolean; fileName: string }>('tool-service/google-drive', {url: this.driveUrl()})
      .subscribe(res => {
        this.expectedDriveFileName.set(res.fileName);
        this.driveProcessing.set(true);
        this.driveUrl.set('');
      });
  }

  openPdf(fileName: string): void {
    this.http.get(`tool-service/scribd/download/${encodeURIComponent(fileName)}`, {
      responseType: 'blob'
    })
      .subscribe(res => {
        const blobUrl = URL.createObjectURL(res);
        window.open(blobUrl, '_blank');
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
      });
  }

  openDrivePdf(fileName: string): void {
    this.http.get(`tool-service/google-drive/download/${encodeURIComponent(fileName)}`, {
      responseType: 'blob'
    })
      .subscribe(res => {
        const blobUrl = URL.createObjectURL(res);
        window.open(blobUrl, '_blank');
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
      });
  }

  deleteScribdFile(event: MouseEvent, fileName: string): void {
    event.stopPropagation();
    this.http.delete(`tool-service/scribd/${encodeURIComponent(fileName)}`)
      .subscribe(() => {
        this.toastService.success('Deleted', fileName);
        this.refreshScribdFiles();
      });
  }

  deleteDriveFile(event: MouseEvent, fileName: string): void {
    event.stopPropagation();
    this.http.delete(`tool-service/google-drive/${encodeURIComponent(fileName)}`)
      .subscribe(() => {
        this.toastService.success('Deleted', fileName);
        this.refreshDriveFiles();
      });
  }


  openImagePreview(src: string): void {
    this.previewImageSrc = src;
    // @ts-ignore
    document.body.style.overflow = 'hidden';
  }

  closeImagePreview(): void {
    this.previewImageSrc = null;
    // @ts-ignore
    document.body.style.overflow = '';
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).id === 'image-preview-backdrop') {
      this.closeImagePreview();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
