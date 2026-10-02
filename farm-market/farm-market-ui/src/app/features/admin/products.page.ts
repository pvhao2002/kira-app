import {ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal} from '@angular/core';
import {Api, apiResource} from '../../core/api';
import {AuthStore} from '../../core/auth.store';
import {BranchStore} from '../../core/branch.store';
import {StateBox} from '../../shared/state-box';
import {VndPipe} from '../../shared/vnd.pipe';
import {Paged, UNIT_CHIPS, errMsg} from './admin.data';

type PStatus = 'ACTIVE' | 'DRAFT' | 'HIDDEN';

interface Product {
  id: number;
  branchId: number;
  groupName: string | null;
  category: string;
  sku: string;
  name: string;
  slug: string;
  description: string | null;
  origin: string | null;
  imageUrl: string | null;
  badge: string | null;
  price: number;
  oldPrice: number | null;
  unit: string;
  status: PStatus;
  suggestToOtherBranches: boolean;
  onHand: number;
  reserved: number;
  available: number;
}

interface Draft {
  id: number | null;
  sku: string;
  name: string;
  slug: string;
  category: string;
  groupName: string;
  description: string;
  origin: string;
  imageUrl: string;
  badge: string;
  unit: string;
  price: number;
  oldPrice: number | null;
  status: PStatus;
  suggest: boolean;
  stock: number;
  onHand: number;
  reserved: number;
  reason: string;
}

const STATUS: Record<PStatus, {label: string; cls: string}> = {
  ACTIVE: {label: 'Đang bán', cls: 'ok'},
  DRAFT: {label: 'Nháp', cls: ''},
  HIDDEN: {label: 'Ẩn', cls: ''}
};
const TABS: {key: PStatus | ''; name: string}[] = [
  {key: '', name: 'Tất cả'},
  {key: 'ACTIVE', name: 'Đang bán'},
  {key: 'DRAFT', name: 'Nháp'},
  {key: 'HIDDEN', name: 'Ẩn'}
];
const SIZE = 20;
const IMAGE_MAX_BYTES = 5 * 1024 * 1024;

@Component({
  selector: 'app-admin-products-page',
  imports: [StateBox, VndPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './products.page.html',
  styleUrl: './products.page.css'
})
export class AdminProductsPage {
  private readonly api = inject(Api);
  readonly branch = inject(BranchStore);
  readonly auth = inject(AuthStore);
  /** Staff are read-only on the catalogue (server enforces the same: manager/admin only). */
  readonly canWrite = computed(() => this.auth.user()?.role === 'manager' || this.auth.user()?.role === 'admin');

  readonly tabs = TABS;
  readonly statusMap = STATUS;
  readonly statusKeys: PStatus[] = ['ACTIVE', 'DRAFT', 'HIDDEN'];
  readonly units = UNIT_CHIPS;

  readonly tab = signal<PStatus | ''>('');
  readonly qInput = signal('');
  readonly q = signal('');
  /** Back to the first page whenever the working branch changes. */
  readonly page = linkedSignal({source: () => this.branch.branchId(), computation: () => 0});
  readonly draft = signal<Draft | null>(null);
  readonly busy = signal(false);
  readonly uploading = signal(false);
  readonly err = signal('');
  private timer?: ReturnType<typeof setTimeout>;
  /** Bumped whenever the draft is opened/closed so an in-flight upload can tell it is stale. */
  private seq = 0;

  readonly list = apiResource<Paged<Product>>(() => ({
    path: '/admin/products',
    params: {branchId: this.branch.branchId(), status: this.tab(), q: this.q(), page: this.page(), size: SIZE}
  }));
  readonly error = computed(() => (this.list.error() ? errMsg(this.list.error()) : ''));
  private readonly cats = apiResource<{slug: string; name: string}[]>(() => ({path: '/categories'}), {defaultValue: []});
  readonly categories = this.cats.value;

  setTab(t: PStatus | ''): void {
    this.tab.set(t);
    this.page.set(0);
  }

  onSearch(v: string): void {
    this.qInput.set(v);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.q.set(v.trim());
      this.page.set(0);
    }, 300);
  }

  pick(i: number): void {
    this.branch.select(i);
    this.close();
  }

  create(): void {
    if (!this.canWrite()) return;
    this.seq++;
    this.err.set('');
    this.draft.set({
      id: null, sku: '', name: '', slug: '', category: this.categories()[0]?.slug ?? '', groupName: '', description: '',
      origin: '', imageUrl: '', badge: '', unit: 'hộp', price: 0, oldPrice: null, status: 'ACTIVE', suggest: true,
      stock: 0, onHand: 0, reserved: 0, reason: ''
    });
  }

  edit(p: Product): void {
    if (!this.canWrite()) return;
    this.seq++;
    this.err.set('');
    this.draft.set({
      id: p.id, sku: p.sku, name: p.name, slug: p.slug, category: p.category, groupName: p.groupName ?? '',
      description: p.description ?? '', origin: p.origin ?? '', imageUrl: p.imageUrl ?? '', badge: p.badge ?? '',
      unit: p.unit, price: p.price, oldPrice: p.oldPrice, status: p.status, suggest: p.suggestToOtherBranches,
      stock: p.onHand, onHand: p.onHand, reserved: p.reserved, reason: ''
    });
  }

  close(): void {
    this.seq++;
    this.draft.set(null);
    this.err.set('');
  }

  patch<K extends keyof Draft>(key: K, value: Draft[K]): void {
    this.draft.update(d => (d ? {...d, [key]: value} : d));
  }

  patchNum(key: 'price' | 'stock', raw: string): void {
    this.patch(key, Math.max(0, Math.round(Number(raw.replace(/\D/g, '')) || 0)));
  }

  patchOld(raw: string): void {
    const n = Math.round(Number(raw.replace(/\D/g, '')) || 0);
    this.patch('oldPrice', n > 0 ? n : null);
  }

  async pickImage(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    input.value = '';
    if (!file || this.uploading()) return;
    // Type is checked by the server (magic bytes) and the accept attribute; file.type can be empty/odd in browsers.
    if (file.size > IMAGE_MAX_BYTES) {
      this.err.set('Ảnh tối đa 5MB.');
      return;
    }
    // ponytail: orphaned uploads are not swept; upgrade = scheduled sweep of files not referenced by products.image_url / reviews.photo_url.
    const seq = this.seq;
    this.uploading.set(true);
    this.err.set('');
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await this.api.postForm<{url: string}>('/admin/media/products', form);
      if (seq === this.seq) this.patch('imageUrl', res.url); // drawer changed meanwhile: drop the result
    } catch (e) {
      this.err.set(errMsg(e));
    } finally {
      this.uploading.set(false);
    }
  }

  async save(): Promise<void> {
    const d = this.draft();
    if (!d || this.busy()) return;
    const delta = d.id ? d.stock - d.onHand : 0;
    if (delta !== 0 && !d.reason.trim()) {
      this.err.set('Vui lòng nhập lý do điều chỉnh tồn kho.');
      return;
    }
    this.busy.set(true);
    this.err.set('');
    const body = {
      branchId: this.branch.branchId(), sku: d.sku.trim(), name: d.name.trim(), slug: d.slug, category: d.category || this.categories()[0]?.slug || '',
      groupName: d.groupName || null, description: d.description || null, origin: d.origin || null,
      imageUrl: d.imageUrl || null, badge: d.badge || null, price: d.price, oldPrice: d.oldPrice, unit: d.unit,
      status: d.status, suggestToOtherBranches: d.suggest, initialStock: d.id ? null : d.stock
    };
    try {
      if (d.id) {
        await this.api.put(`/admin/products/${d.id}`, body);
        if (delta !== 0) {
          await this.api.post('/admin/inventory/adjustments', {branchId: this.branch.branchId(), productId: d.id, delta, reason: d.reason.trim()});
        }
      } else {
        await this.api.post('/admin/products', body);
      }
      this.close();
      this.list.reload();
    } catch (e) {
      this.err.set(errMsg(e));
    } finally {
      this.busy.set(false);
    }
  }

  async hide(): Promise<void> {
    const d = this.draft();
    if (!d?.id || this.busy() || !confirm('Ẩn sản phẩm này khỏi cửa hàng?')) return;
    this.busy.set(true);
    this.err.set('');
    try {
      await this.api.delete(`/admin/products/${d.id}`);
      this.close();
      this.list.reload();
    } catch (e) {
      this.err.set(errMsg(e));
    } finally {
      this.busy.set(false);
    }
  }
}
