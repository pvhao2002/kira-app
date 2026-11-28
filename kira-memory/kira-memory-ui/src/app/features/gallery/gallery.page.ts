import {ScrollingModule} from '@angular/cdk/scrolling';
import {Component, computed, DestroyRef, ElementRef, HostListener, inject, signal, viewChild} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {Router, RouterLink} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {Api, errorMessage, Filter, Group, Media} from '../../core/api';
import {AuthStore} from '../../core/auth';
import {CycleCard} from './cycle-card';
import {LoveDays} from './love-days';
import {MediaViewer} from './media-viewer';
import {UploadDialog} from './upload-dialog';

const GAP = 18;
const PAGE = 60;
/** Ids per delete request: each Hugging Face delete is its own commit, and Cloudflare cuts requests at 100 s. */
const DELETE_BATCH = 20;

@Component({
  selector: 'app-gallery-page',
  imports: [ScrollingModule, FormsModule, RouterLink, MediaViewer, UploadDialog, LoveDays, CycleCard],
  templateUrl: './gallery.page.html',
  styleUrl: './gallery.page.css'
})
export class GalleryPage {
  private api = inject(Api);
  private router = inject(Router);
  protected auth = inject(AuthStore);

  protected groups = signal<Group[]>([]);
  protected filter = signal<Filter>('all');
  protected items = signal<Media[]>([]);
  private cursor: string | null = null;
  protected done = signal(false);
  protected loading = signal(false);
  protected error = signal('');
  private generation = 0;

  protected width = signal(0);
  protected cols = computed(() => {
    const w = this.width();
    return w < 560 ? 2 : w < 900 ? 3 : w < 1280 ? 4 : 5;
  });
  protected tileWidth = computed(() => Math.max(100, (this.width() - GAP * (this.cols() - 1)) / this.cols()));
  /** Square photo inside an 8px frame, plus a 58px strip for caption and date. */
  protected rowHeight = computed(() => Math.round(this.tileWidth() + 50 + GAP));
  protected rows = computed(() => {
    const out: Media[][] = [];
    const list = this.items();
    for (let i = 0; i < list.length; i += this.cols()) out.push(list.slice(i, i + this.cols()));
    return out;
  });

  protected activeGroup = computed(() => {
    const f = this.filter();
    return typeof f === 'number' ? this.groups().find(g => g.id === f) ?? null : null;
  });

  protected viewing = signal<number | null>(null);
  protected uploading = signal(false);
  /** Files dropped on the page, handed to the upload dialog. */
  protected dropped = signal<File[]>([]);
  protected dragging = signal(false);
  private dragDepth = 0;
  protected deleting = signal('');
  protected selecting = signal(false);
  protected selected = signal<Set<number>>(new Set());
  protected moveTarget: string = '';
  protected newGroupName = '';
  protected creatingGroup = signal(false);
  protected renaming = signal(false);
  protected renameValue = '';

  private gridEl = viewChild.required<ElementRef<HTMLElement>>('grid');

  constructor() {
    const ro = new ResizeObserver(entries => this.width.set(entries[0].contentRect.width));
    queueMicrotask(() => ro.observe(this.gridEl().nativeElement));
    inject(DestroyRef).onDestroy(() => ro.disconnect());
    this.loadGroups();
    this.reload();
  }

  protected loadGroups() {
    this.api.groups().subscribe(g => this.groups.set(g));
  }

  protected setFilter(f: Filter) {
    if (this.filter() === f) return;
    this.filter.set(f);
    this.renaming.set(false);
    this.reload();
  }

  protected reload() {
    this.generation++;
    this.items.set([]);
    this.cursor = null;
    this.done.set(false);
    this.loading.set(false);
    this.more();
  }

  protected more() {
    if (this.loading() || this.done()) return;
    const gen = this.generation;
    this.loading.set(true);
    this.error.set('');
    this.api.media(this.filter(), this.cursor, PAGE).subscribe({
      next: page => {
        if (gen !== this.generation) return;
        this.items.update(list => [...list, ...page.items]);
        this.cursor = page.nextCursor;
        this.done.set(!page.nextCursor);
        this.loading.set(false);
      },
      error: err => {
        if (gen !== this.generation) return;
        this.error.set(errorMessage(err, 'Không tải được kỷ niệm'));
        this.loading.set(false);
      }
    });
  }

  /** Fetch the next page when the first visible row gets within ~2 screens of the end. */
  protected onScroll(firstRow: number) {
    const perScreen = Math.ceil(window.innerHeight / this.rowHeight());
    if (firstRow + perScreen * 3 >= this.rows().length) this.more();
  }

  protected tilt(index: number) {
    return [-1.2, 0.7, -0.4, 1, -0.8, 0.5][index % 6];
  }

  protected open(m: Media) {
    if (this.selecting()) {
      this.selected.update(s => {
        const n = new Set(s);
        n.has(m.id) ? n.delete(m.id) : n.add(m.id);
        return n;
      });
      return;
    }
    this.viewing.set(this.items().findIndex(x => x.id === m.id));
  }

  protected changed(m: Media) {
    const f = this.filter();
    const stays = f === 'all' || (f === 'ungrouped' ? m.groupId === null : m.groupId === f);
    this.items.update(list => stays ? list.map(x => (x.id === m.id ? m : x)) : list.filter(x => x.id !== m.id));
    if (!stays) this.viewing.set(null);
    this.loadGroups();
  }

  protected deleted(id: number) {
    this.items.update(list => list.filter(x => x.id !== id));
    this.viewing.set(null);
    this.loadGroups();
  }

  protected uploaded() {
    this.uploading.set(false);
    this.dropped.set([]);
    this.loadGroups();
    this.reload();
  }

  protected toggleSelect() {
    this.selecting.update(v => !v);
    this.selected.set(new Set());
  }

  protected moveSelected() {
    const ids = [...this.selected()];
    if (!ids.length || this.moveTarget === '') return;
    const groupId = this.moveTarget === 'none' ? null : Number(this.moveTarget);
    this.api.moveMedia(ids, groupId).subscribe({
      next: () => {
        this.toggleSelect();
        this.loadGroups();
        this.reload();
      },
      error: err => this.error.set(errorMessage(err))
    });
  }

  protected async deleteSelected() {
    const ids = [...this.selected()];
    if (!ids.length || !confirm(`Xoá vĩnh viễn ${ids.length} kỷ niệm? Ảnh và video sẽ bị xoá khỏi nơi lưu trữ và không khôi phục được.`)) return;
    this.error.set('');
    try {
      for (let i = 0; i < ids.length; i += DELETE_BATCH) {
        this.deleting.set(`Đang xoá ${i}/${ids.length}…`);
        await firstValueFrom(this.api.deleteMany(ids.slice(i, i + DELETE_BATCH)));
      }
    } catch (err) {
      this.error.set(errorMessage(err, 'Chưa xoá được hết, thử lại nhé'));
    }
    // Reload either way: a failed batch keeps what was deleted before it.
    this.deleting.set('');
    this.toggleSelect();
    this.loadGroups();
    this.reload();
  }

  // Dropping files anywhere on the page opens the upload dialog with them (admin). Files dropped where they are not
  // taken never make the browser leave the page.
  private hasFiles(e: DragEvent) {
    return !!e.dataTransfer?.types.includes('Files');
  }

  private canDrop() {
    return this.auth.isAdmin() && !this.uploading();
  }

  @HostListener('window:dragenter', ['$event'])
  protected dragEnter(e: DragEvent) {
    if (!this.hasFiles(e) || !this.canDrop()) return;
    this.dragDepth++;
    this.dragging.set(true);
  }

  @HostListener('window:dragleave', ['$event'])
  protected dragLeave(e: DragEvent) {
    if (!this.hasFiles(e) || !this.dragging()) return;
    if (--this.dragDepth <= 0) this.endDrag();
  }

  @HostListener('window:dragover', ['$event'])
  protected dragOver(e: DragEvent) {
    if (!this.hasFiles(e)) return;
    // Already taken by the upload dialog's own drop area.
    const taken = e.defaultPrevented;
    e.preventDefault();
    if (!taken && !this.canDrop() && e.dataTransfer) e.dataTransfer.dropEffect = 'none';
  }

  @HostListener('window:drop', ['$event'])
  protected drop(e: DragEvent) {
    if (!this.hasFiles(e)) return;
    e.preventDefault();
    this.endDrag();
    const files = [...(e.dataTransfer?.files ?? [])];
    if (!this.canDrop() || !files.length) return;
    this.dropped.set(files);
    this.uploading.set(true);
  }

  private endDrag() {
    this.dragDepth = 0;
    this.dragging.set(false);
  }

  protected faded(e: Event) {
    (e.target as HTMLElement).classList.add('in');
  }

  protected createGroup() {
    const name = this.newGroupName.trim();
    if (!name) return;
    this.api.createGroup(name, false).subscribe({
      next: g => {
        this.newGroupName = '';
        this.creatingGroup.set(false);
        this.loadGroups();
        this.setFilter(g.id);
      },
      error: err => this.error.set(errorMessage(err))
    });
  }

  protected togglePin(g: Group) {
    this.api.updateGroup(g.id, g.name, !g.pinned).subscribe({next: () => this.loadGroups(), error: err => this.error.set(errorMessage(err))});
  }

  protected rename(g: Group) {
    const name = this.renameValue.trim();
    if (!name) return;
    this.api.updateGroup(g.id, name, g.pinned).subscribe({
      next: () => {
        this.renaming.set(false);
        this.loadGroups();
      },
      error: err => this.error.set(errorMessage(err))
    });
  }

  protected deleteGroup(g: Group) {
    if (!confirm(`Xoá nhóm "${g.name}"? Ảnh trong nhóm vẫn được giữ lại.`)) return;
    this.api.deleteGroup(g.id).subscribe({
      next: () => {
        this.loadGroups();
        this.setFilter('all');
      },
      error: err => this.error.set(errorMessage(err))
    });
  }

  private dayFormat = new Intl.DateTimeFormat('vi-VN', {day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh'});
  protected day = (iso: string) => this.dayFormat.format(new Date(iso));

  protected trackRow = (_: number, row: Media[]) => row[0]?.id;

  protected logout() {
    this.auth.logout().subscribe(() => this.router.navigateByUrl('/dang-nhap'));
  }
}
