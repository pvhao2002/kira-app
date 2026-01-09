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
  url = signal<string>('');
  previewImageSrc: string | null = null;
  destroy$ = new Subject<void>();


  constructor(protected readonly http: HttpClient,
              protected readonly toastService: ToastService) {
  }

  ngOnInit(): void {
    interval(5000)
      .pipe(
        startWith(0),
        switchMap(() =>
          this.http.get<CustomFileModel[]>('tool-service/scribd')
        ),
        takeUntil(this.destroy$)
      )
      .subscribe(res => {
        this.data.update(files => [...res]);
      });
  }

  decodeUrl(): void {
    this.url.set(decodeURIComponent(this.url()));
  }

  test(): void {
    this.http.post('tool-service/scribd', {url: this.url()})
      .subscribe(res => {
        this.toastService.info('Please wait...', 'Processing started');
        this.url.set('');
      });
  }

  openPdf(fileName: string): void {
    this.http.get(`tool-service/scribd/download/${encodeURIComponent(fileName)}`, {
      responseType: 'blob'
    })
      .subscribe(res => {
        this.toastService.success('Preparing PDF...', 'Please wait');
        const blobUrl = URL.createObjectURL(res);
        window.open(blobUrl, '_blank');
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
      })
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
