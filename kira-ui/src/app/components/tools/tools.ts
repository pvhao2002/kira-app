import {Component} from '@angular/core';
import {HttpClient} from '@angular/common/http';

@Component({
  selector: 'app-tools',
  imports: [],
  standalone: true,
  templateUrl: './tools.html',
  styleUrl: './tools.css',
})
export class Tools {
  previewImageSrc: string | null = null;

  constructor(protected readonly http: HttpClient) {
  }

  openImagePreview(src: string): void {
    this.previewImageSrc = src;
    document.body.style.overflow = 'hidden';
  }

  closeImagePreview(): void {
    this.previewImageSrc = null;
    document.body.style.overflow = '';
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).id === 'image-preview-backdrop') {
      this.closeImagePreview();
    }
  }
}
