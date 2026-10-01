import {ChangeDetectionStrategy, Component, computed, inject, resource, signal} from '@angular/core';
import {Api} from '../../core/api';
import {AuthStore} from '../../core/auth.store';
import {BranchStore} from '../../core/branch.store';
import {vnd} from '../../core/format';
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

@Component({
  selector: 'app-admin-products-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="head">
      <div>
        <div class="eyebrow">Sản phẩm</div>
        <h1 class="page-title">{{ branch.current().name }}</h1>
      </div>
      @if (canWrite()) {<button type="button" class="btn" (click)="create()">+ Thêm sản phẩm</button>}
    </header>

    <div class="row wrap chips">
      @for (i of auth.allowedBranches(); track i) {
        <button type="button" class="chipb" [class.on]="i === branch.index()" (click)="pick(i)">
          <i class="dot" [style.background]="branch.themeOf(i).primary"></i>{{ branch.branches[i].short }}
        </button>
      }
    </div>

    <div class="layout" [class.open]="draft() !== null">
      <div class="card panel">
        <div class="row wrap bar">
          <div class="row wrap" role="tablist">
            @for (t of tabs; track t.key) {
              <button type="button" role="tab" class="tab-pill" [class.on]="tab() === t.key" [attr.aria-selected]="tab() === t.key" (click)="setTab(t.key)">{{ t.name }}</button>
            }
          </div>
          <input class="input search" type="search" placeholder="Tìm tên, SKU…" aria-label="Tìm sản phẩm" [value]="qInput()" (input)="onSearch($any($event.target).value)">
        </div>
        @if (list.error()) {
          <div class="state-box nb" role="alert"><b>{{ msg(list.error()) }}</b><button type="button" class="btn secondary" (click)="list.reload()">Thử lại</button></div>
        } @else if (!list.hasValue()) {
          <div class="state-box nb" role="status">Đang tải sản phẩm…</div>
        } @else if (list.value().data.length) {
          <div class="table-wrap">
            <table class="table">
              <thead><tr><th>Sản phẩm</th><th>Nhóm tương tự</th><th>Giá</th><th>Tồn</th><th>Trạng thái</th></tr></thead>
              <tbody>
                @for (p of list.value().data; track p.id) {
                  <tr [class.clickable]="canWrite()" [class.sel]="draft()?.id === p.id" tabindex="0" (click)="edit(p)" (keydown.enter)="edit(p)">
                    <td>
                      <div class="row"><i class="thumb" aria-hidden="true"></i><div><div>{{ p.name }}</div><div class="muted small mono">{{ p.sku }}</div></div></div>
                    </td>
                    <td><span class="pill">{{ p.groupName || '—' }}</span></td>
                    <td><b>{{ money(p.price) }}</b>@if (p.oldPrice) { <s class="muted small">{{ money(p.oldPrice) }}</s>} <span class="muted small">/ {{ p.unit }}</span></td>
                    <td [class.low]="p.available < 10" [class.bad]="p.available === 0">{{ p.available }}</td>
                    <td><span class="pill" [class]="statusMap[p.status].cls">{{ statusMap[p.status].label }}</span></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <div class="row foot">
            <span class="muted">{{ list.value().data.length }} / {{ list.value().meta.totalElements }} sản phẩm</span>
            <span class="spacer"></span>
            <button type="button" class="pg" aria-label="Trang trước" [disabled]="page() === 0" (click)="page.set(page() - 1)">‹</button>
            <span class="muted">Trang {{ page() + 1 }} / {{ list.value().meta.totalPages || 1 }}</span>
            <button type="button" class="pg" aria-label="Trang sau" [disabled]="page() + 1 >= list.value().meta.totalPages" (click)="page.set(page() + 1)">›</button>
          </div>
        } @else {
          <div class="state-box nb">Không có sản phẩm phù hợp.</div>
        }
      </div>

      @if (draft(); as d) {
        <aside class="card drawer" [attr.aria-label]="d.id ? 'Sửa sản phẩm' : 'Thêm sản phẩm'">
          <div class="row between"><b>{{ d.id ? 'Sửa sản phẩm' : 'Thêm sản phẩm' }}</b><button type="button" class="x" aria-label="Đóng" (click)="close()">✕</button></div>
          <div class="field"><label for="pn">Tên sản phẩm</label><input id="pn" class="input" maxlength="200" [value]="d.name" (input)="patch('name', $any($event.target).value)"></div>
          <div class="grid2">
            <div class="field"><label for="pk">SKU</label><input id="pk" class="input mono" maxlength="40" [value]="d.sku" (input)="patch('sku', $any($event.target).value)"></div>
            <div class="field">
              <label for="pc">Danh mục</label>
              <select id="pc" class="input" (change)="patch('category', $any($event.target).value)">
                @for (c of categories(); track c.slug) {<option [value]="c.slug" [selected]="c.slug === d.category">{{ c.name }}</option>}
              </select>
            </div>
            <div class="field"><label for="pp">Giá (₫)</label><input id="pp" class="input" inputmode="numeric" [value]="d.price" (input)="patchNum('price', $any($event.target).value)"></div>
            <div class="field"><label for="ps">Giá gốc gạch ngang (₫)</label><input id="ps" class="input" inputmode="numeric" placeholder="Không" [value]="d.oldPrice ?? ''" (input)="patchOld($any($event.target).value)"></div>
            <div class="field"><label for="pt">Tồn kho{{ d.id ? ' (' + d.reserved + ' đang giữ)' : ' ban đầu' }}</label><input id="pt" class="input" inputmode="numeric" [value]="d.stock" (input)="patchNum('stock', $any($event.target).value)"></div>
            <div class="field">
              <label for="pst">Trạng thái</label>
              <select id="pst" class="input" (change)="patch('status', $any($event.target).value)">
                @for (s of statusKeys; track s) {<option [value]="s" [selected]="s === d.status">{{ statusMap[s].label }}</option>}
              </select>
            </div>
          </div>
          @if (d.id && d.stock !== d.onHand) {
            <div class="field">
              <label for="pr">Lý do điều chỉnh tồn kho ({{ d.onHand }} → {{ d.stock }})</label>
              <input id="pr" class="input" maxlength="255" placeholder="Ví dụ: kiểm kho cuối ngày" [value]="d.reason" (input)="patch('reason', $any($event.target).value)">
            </div>
          }
          <div class="field">
            <span class="label">Đơn vị</span>
            <div class="row wrap">
              @for (u of units; track u) {
                <button type="button" class="chipb" [class.on]="d.unit.toLowerCase() === u.toLowerCase()" (click)="patch('unit', u.toLowerCase())">{{ u }}</button>
              }
            </div>
          </div>
          <div class="row rec">
            <span class="grow">Gợi ý sản phẩm của chi nhánh khác khi khách xem sản phẩm này</span>
            <button type="button" class="toggle" [class.on]="d.suggest" role="switch" [attr.aria-checked]="d.suggest" aria-label="Gợi ý sản phẩm của chi nhánh khác" (click)="patch('suggest', !d.suggest)"></button>
          </div>
          @if (err()) {<p class="err small" role="alert">{{ err() }}</p>}
          <div class="row foot2">
            @if (d.id) {<button type="button" class="btn danger" [disabled]="busy()" (click)="hide()">Ẩn</button>}
            <button type="button" class="btn secondary grow" (click)="close()">Hủy</button>
            <button type="button" class="btn grow" [disabled]="busy()" (click)="save()">{{ busy() ? 'Đang lưu…' : 'Lưu' }}</button>
          </div>
        </aside>
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; margin-bottom: 20px; }
    .chips { margin-bottom: 20px; }
    .chipb { display: inline-flex; align-items: center; gap: 8px; padding: 8px 14px; border-radius: 999px; background: transparent; border: 1px solid var(--line); font-size: 13px; font-weight: 500; }
    .chipb.on { background: var(--surface); border: 1.5px solid var(--primary); }
    .dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
    .layout { display: grid; grid-template-columns: minmax(0, 1fr); gap: 20px; align-items: start; }
    .layout.open { grid-template-columns: minmax(0, 1fr) 360px; }
    .panel { padding: 0; overflow: hidden; }
    .bar { justify-content: space-between; padding: 16px; border-bottom: 1px solid var(--border); }
    .search { max-width: 240px; padding: 9px 14px; }
    .small { font-size: 12px; }
    .err { color: var(--danger); }
    .thumb { width: 40px; height: 40px; border-radius: 10px; background: var(--tint); flex: none; }
    tr.sel td { background: color-mix(in oklch, var(--primary) 7%, #fffdf8); }
    td.low { color: var(--brown); font-weight: 600; }
    td.bad { color: var(--danger); }
    .nb { border: 0; border-radius: 0; }
    .foot { padding: 14px 16px; }
    .pg { min-width: 32px; height: 32px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); }
    .pg:disabled { opacity: .4; }
    .drawer { display: flex; flex-direction: column; gap: 14px; position: sticky; top: 16px; }
    .between { justify-content: space-between; }
    .x { background: transparent; border: 0; font-size: 16px; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .grid2 .input { padding: 10px 12px; }
    .grow { flex: 1; }
    .foot2 { gap: 10px; }
    .rec { padding: 12px; background: var(--surface-2); border-radius: 12px; font-size: 13px; gap: 14px; }
    @media (max-width: 767px) {
      .layout.open { grid-template-columns: minmax(0, 1fr); }
      .drawer { position: static; }
      .search { max-width: none; flex: 1; }
    }
  `
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
  readonly money = vnd;
  readonly msg = errMsg;

  readonly tab = signal<PStatus | ''>('');
  readonly qInput = signal('');
  readonly q = signal('');
  readonly page = signal(0);
  readonly draft = signal<Draft | null>(null);
  readonly busy = signal(false);
  readonly err = signal('');
  private timer?: ReturnType<typeof setTimeout>;

  readonly list = resource({
    params: () => ({branchId: this.branch.branchId(), status: this.tab(), q: this.q(), page: this.page()}),
    loader: ({params}) => this.api.get<Paged<Product>>('/admin/products', {...params, size: SIZE})
  });
  private readonly cats = resource({loader: () => this.api.get<{slug: string; name: string}[]>('/categories')});
  readonly categories = computed(() => (this.cats.hasValue() ? this.cats.value() : []));

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
    this.page.set(0);
    this.close();
  }

  create(): void {
    if (!this.canWrite()) return;
    this.err.set('');
    this.draft.set({
      id: null, sku: '', name: '', slug: '', category: this.categories()[0]?.slug ?? '', groupName: '', description: '',
      origin: '', imageUrl: '', badge: '', unit: 'hộp', price: 0, oldPrice: null, status: 'ACTIVE', suggest: true,
      stock: 0, onHand: 0, reserved: 0, reason: ''
    });
  }

  edit(p: Product): void {
    if (!this.canWrite()) return;
    this.err.set('');
    this.draft.set({
      id: p.id, sku: p.sku, name: p.name, slug: p.slug, category: p.category, groupName: p.groupName ?? '',
      description: p.description ?? '', origin: p.origin ?? '', imageUrl: p.imageUrl ?? '', badge: p.badge ?? '',
      unit: p.unit, price: p.price, oldPrice: p.oldPrice, status: p.status, suggest: p.suggestToOtherBranches,
      stock: p.onHand, onHand: p.onHand, reserved: p.reserved, reason: ''
    });
  }

  close(): void {
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
    if (!d?.id || !confirm('Ẩn sản phẩm này khỏi cửa hàng?')) return;
    this.busy.set(true);
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
