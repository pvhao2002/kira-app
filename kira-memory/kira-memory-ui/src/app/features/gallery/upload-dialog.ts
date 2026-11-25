import {Component, DestroyRef, HostListener, inject, input, OnInit, output, signal} from '@angular/core';
import {A11yModule} from '@angular/cdk/a11y';
import {FormsModule} from '@angular/forms';
import {Api, errorMessage, Group} from '../../core/api';
import {exifTakenAt} from '../../core/exif';
import {prepare} from '../../core/thumbs';
import {chunkedUpload, contentTypeOf, MAX_BYTES} from './chunked-upload';

interface Pick {
  file: File;
  preview: string;
  caption: string;
  state: 'waiting' | 'uploading' | 'storing' | 'done' | 'failed';
  progress: number;
  error: string;
}

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/avif,image/heic,image/heif,video/mp4,video/quicktime,video/webm';

@Component({
  selector: 'app-upload-dialog',
  imports: [FormsModule, A11yModule],
  template: `
    <div class="backdrop" (click)="close()"></div>
    <section class="dialog" role="dialog" aria-modal="true" aria-labelledby="up-title" cdkTrapFocus [cdkTrapFocusAutoCapture]="true">
      <header>
        <h2 id="up-title" class="script">Thêm kỷ niệm</h2>
        <button class="btn ghost" type="button" (click)="close()" aria-label="Đóng" [disabled]="running()">✕</button>
      </header>
      <label class="drop">
        <input type="file" multiple [accept]="accept" (change)="add($event)" [disabled]="running()">
        <span>Chọn ảnh hoặc video</span>
        <small class="muted">jpg, png, webp, gif, heic, mp4, mov, webm, tối đa 2GB mỗi file</small>
      </label>
      @if (picks().length) {
        <label class="field">Cho vào nhóm
          <select class="input" [(ngModel)]="groupId" [disabled]="running()">
            <option [ngValue]="null">Không thuộc nhóm nào</option>
            @for (g of groups(); track g.id) { <option [ngValue]="g.id">{{ g.name }}</option> }
          </select>
        </label>
        <ul class="picks">
          @for (p of picks(); track p.preview; let i = $index) {
            <li [class]="p.state">
              @if (p.file.type.startsWith('video/')) { <video [src]="p.preview" muted playsinline preload="metadata"></video> }
              @else { <img [src]="p.preview" alt=""> }
              <div class="pick-body">
                <textarea class="input" rows="2" maxlength="2000" placeholder="Lời nhắn hoặc caption (không bắt buộc)"
                          [(ngModel)]="p.caption" [disabled]="running() || p.state === 'done'"
                          [attr.aria-label]="'Lời nhắn cho ' + p.file.name"></textarea>
                <small class="muted">{{ p.file.name }}
                  @switch (p.state) {
                    @case ('uploading') { · đang gửi {{ p.progress }}% }
                    @case ('storing') { · đang cất vào kho… }
                    @case ('done') { · đã lưu ❤ }
                    @case ('failed') { <span class="error">· {{ p.error }}</span> }
                  }
                </small>
              </div>
              @if (!running() && p.state !== 'done') {
                <button class="btn ghost" type="button" (click)="remove(i)" aria-label="Bỏ file này">✕</button>
              }
            </li>
          }
        </ul>
      }
      <footer>
        <button class="btn primary" type="button" (click)="start()" [disabled]="running() || !pending()">
          {{ running() ? 'Đang tải lên…' : 'Tải lên ' + pending() + ' kỷ niệm' }}
        </button>
      </footer>
    </section>
  `,
  styles: `
    :host { position: fixed; inset: 0; z-index: 60; display: grid; place-items: center; padding: 16px; }
    .backdrop { position: absolute; inset: 0; background: rgb(60 8 22 / .6); }
    .dialog { position: relative; width: min(640px, 100%); max-height: 100%; overflow: auto; display: grid; gap: 16px;
      padding: 18px 20px 20px; background: var(--paper); border-radius: 24px; box-shadow: var(--shadow); }
    header { display: flex; align-items: center; justify-content: space-between; }
    h2 { margin: 0; font-size: 34px; color: var(--rose-deep); }
    .drop { display: grid; justify-items: center; gap: 4px; padding: 26px; border: 2px dashed var(--blush); border-radius: 18px;
      cursor: pointer; font-weight: 600; color: var(--rose-deep); }
    .drop:hover, .drop:focus-within { border-color: var(--rose); }
    .drop input { position: absolute; opacity: 0; width: 1px; height: 1px; }
    .picks { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
    .picks li { display: flex; gap: 12px; align-items: flex-start; padding: 8px; border: 1px solid var(--blush); border-radius: 16px; }
    .picks li.done { background: var(--petal); }
    .picks img, .picks video { width: 72px; height: 72px; object-fit: cover; border-radius: 10px; flex: none; background: var(--blush); }
    .pick-body { flex: 1; display: grid; gap: 4px; min-width: 0; }
    .pick-body small { overflow-wrap: anywhere; }
    footer { display: flex; justify-content: flex-end; }
  `
})
export class UploadDialog implements OnInit {
  private api = inject(Api);
  readonly groups = input.required<Group[]>();
  readonly defaultGroup = input<number | null>(null);
  readonly closed = output<void>();
  readonly done = output<void>();
  protected accept = ACCEPT;
  protected picks = signal<Pick[]>([]);
  protected running = signal(false);
  protected groupId: number | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.picks().forEach(p => URL.revokeObjectURL(p.preview)));
  }

  ngOnInit() {
    this.groupId = this.defaultGroup();
  }

  @HostListener('document:keydown.escape')
  protected close() {
    if (this.running()) return;
    if (this.picks().some(p => p.state === 'done')) this.done.emit();
    else this.closed.emit();
  }

  protected pending() {
    return this.picks().filter(p => p.state === 'waiting' || p.state === 'failed').length;
  }

  protected add(e: Event) {
    const input = e.target as HTMLInputElement;
    const files = [...(input.files ?? [])];
    input.value = '';
    this.picks.update(list => [...list, ...files.map(file => {
      const tooBig = file.size > MAX_BYTES;
      const known = contentTypeOf(file) !== 'application/octet-stream';
      return {
        file, preview: URL.createObjectURL(file), caption: '', progress: 0,
        state: tooBig || !known ? 'failed' as const : 'waiting' as const,
        error: tooBig ? 'File lớn hơn 2GB' : known ? '' : 'Định dạng không hỗ trợ'
      };
    })]);
  }

  protected remove(i: number) {
    URL.revokeObjectURL(this.picks()[i].preview);
    this.picks.update(list => list.filter((_, j) => j !== i));
  }

  /** One file at a time, so a big video never competes with photos for bandwidth. */
  protected async start() {
    this.running.set(true);
    for (const p of this.picks()) {
      if (p.state === 'done' || p.state === 'uploading' || p.file.size > MAX_BYTES) continue;
      this.patch(p, {state: 'uploading', progress: 0, error: ''});
      try {
        const prepared = await prepare(p.file);
        const form = new FormData();
        form.append('thumb', prepared.thumb, 'thumb.jpg');
        if (p.caption.trim()) form.append('caption', p.caption.trim());
        if (this.groupId !== null) form.append('groupId', String(this.groupId));
        if (prepared.width) form.append('width', String(prepared.width));
        if (prepared.height) form.append('height', String(prepared.height));
        // The real shot time from EXIF; otherwise the file date, which messaging apps often reset.
        const exif = p.file.type.startsWith('image/') ? await exifTakenAt(p.file) : null;
        form.append('takenAt', String(exif ?? (p.file.lastModified || Date.now())));
        await chunkedUpload(this.api, p.file, form, (phase, percent) =>
          this.patch(p, {state: phase === 'storing' ? 'storing' : 'uploading', progress: percent}));
        this.patch(p, {state: 'done', progress: 100});
      } catch (err) {
        this.patch(p, {state: 'failed', error: errorMessage(err, 'Tải lên thất bại')});
      }
    }
    this.running.set(false);
    if (this.picks().every(p => p.state === 'done')) this.done.emit();
  }

  private patch(p: Pick, change: Partial<Pick>) {
    Object.assign(p, change);
    this.picks.update(list => [...list]);
  }
}
