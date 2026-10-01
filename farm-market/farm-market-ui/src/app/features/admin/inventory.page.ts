import {ChangeDetectionStrategy, Component, computed, inject, resource, signal} from '@angular/core';
import {Api} from '../../core/api';
import {BranchStore} from '../../core/branch.store';
import {LOW_STOCK_LIMIT, Paged, errMsg, fmtDateTime} from './admin.data';

type Level = 'OK' | 'LOW' | 'OUT';

interface Stock {
  productId: number;
  sku: string;
  name: string;
  unit: string;
  onHand: number;
  reserved: number;
  available: number;
  level: Level;
}
interface Movement {
  id: number;
  productId: number;
  type: string;
  delta: number;
  onHandAfter: number;
  reason: string | null;
  refId: string | null;
  createdAt: string;
}

const LEVELS: Record<Level, {label: string; cls: string; pct: number}> = {
  OK: {label: 'Đủ hàng', cls: 'ok', pct: 0},
  LOW: {label: 'Sắp hết', cls: 'warn', pct: 0},
  OUT: {label: 'Hết hàng', cls: 'bad', pct: 0}
};
const MOVE_LABEL: Record<string, string | undefined> = {RECEIPT: 'Nhập kho', SALE: 'Bán hàng', ADJUSTMENT: 'Điều chỉnh', RESERVE: 'Giữ hàng', RELEASE: 'Trả hàng giữ', RETURN: 'Hoàn kho'};
const SIZE = 20;

@Component({
  selector: 'app-inventory-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="head">
      <div>
        <div class="eyebrow">Kho hàng</div>
        <h1 class="page-title">Kho · {{ branch.current().name }}</h1>
      </div>
      <div class="row wrap">
        <button type="button" class="btn secondary" (click)="toggleView()">{{ view() === 'stock' ? 'Lịch sử nhập xuất' : '← Tồn kho' }}</button>
      </div>
    </header>

    @if (view() === 'stock') {
      <div class="row wrap tabs" role="tablist">
        @for (t of tabs; track t.key) {
          <button type="button" role="tab" class="tab-pill" [class.on]="level() === t.key" [attr.aria-selected]="level() === t.key" (click)="setLevel(t.key)">{{ t.name }}</button>
        }
        <input class="input search" type="search" placeholder="Tìm tên, SKU…" aria-label="Tìm sản phẩm" [value]="qInput()" (input)="onSearch($any($event.target).value)">
      </div>

      @if (action(); as a) {
        <form class="card form" (submit)="$event.preventDefault(); submit()">
          <b>{{ a.kind === 'receipt' ? 'Phiếu nhập kho' : 'Điều chỉnh tồn kho' }} · {{ a.row.name }} <span class="mono muted">{{ a.row.sku }}</span></b>
          <div class="muted small">Tồn hiện tại: {{ a.row.onHand }} {{ a.row.unit }} · Đang giữ: {{ a.row.reserved }}</div>
          <div class="grid2">
            <div class="field">
              <label for="aq">{{ a.kind === 'receipt' ? 'Số lượng nhập' : 'Chênh lệch (+/−)' }}</label>
              <input id="aq" class="input" inputmode="numeric" [value]="qty()" (input)="qty.set($any($event.target).value)">
            </div>
            <div class="field">
              <label for="ar">{{ a.kind === 'receipt' ? 'Ghi chú (tuỳ chọn)' : 'Lý do (bắt buộc)' }}</label>
              <input id="ar" class="input" maxlength="255" [value]="reason()" (input)="reason.set($any($event.target).value)">
            </div>
          </div>
          @if (err()) {<p class="err small" role="alert">{{ err() }}</p>}
          <div class="row">
            <button type="button" class="btn secondary" (click)="action.set(null)">Hủy</button>
            <button type="submit" class="btn" [disabled]="busy()">{{ busy() ? 'Đang lưu…' : 'Xác nhận' }}</button>
          </div>
        </form>
      }

      <div class="card panel">
        @if (list.error()) {
          <div class="state-box nb" role="alert"><b>{{ msg(list.error()) }}</b><button type="button" class="btn secondary" (click)="list.reload()">Thử lại</button></div>
        } @else if (!list.hasValue()) {
          <div class="state-box nb" role="status">Đang tải tồn kho…</div>
        } @else if (list.value().data.length) {
          <div class="table-wrap">
            <table class="table">
              <thead><tr><th>Sản phẩm</th><th>Tồn kho</th><th>Đang giữ</th><th>Khả dụng</th><th>Tình trạng</th><th></th></tr></thead>
              <tbody>
                @for (r of list.value().data; track r.productId) {
                  <tr>
                    <td><div>{{ r.name }}</div><div class="muted small mono">{{ r.sku }}</div></td>
                    <td>{{ r.onHand }}</td>
                    <td>{{ r.reserved }}</td>
                    <td [class.bad]="r.level !== 'OK'"><b>{{ r.available }}</b></td>
                    <td><span class="pill" [class]="levels[r.level].cls">{{ levels[r.level].label }}</span></td>
                    <td class="acts">
                      <button type="button" class="btn secondary sm" (click)="open('receipt', r)">Nhập kho</button>
                      <button type="button" class="btn ghost sm" (click)="open('adjust', r)">Điều chỉnh</button>
                    </td>
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
          <div class="state-box nb">Không có sản phẩm nào ở mức này.</div>
        }
        <div class="muted foot2">Khả dụng = Tồn kho − Đang giữ (đơn đã đặt chưa giao). Cảnh báo khi khả dụng dưới {{ limit }}.</div>
      </div>
    } @else {
      <div class="card panel">
        @if (moves.error()) {
          <div class="state-box nb" role="alert"><b>{{ msg(moves.error()) }}</b><button type="button" class="btn secondary" (click)="moves.reload()">Thử lại</button></div>
        } @else if (!moves.hasValue()) {
          <div class="state-box nb" role="status">Đang tải lịch sử…</div>
        } @else if (moves.value().data.length) {
          <div class="table-wrap">
            <table class="table">
              <thead><tr><th>Thời gian</th><th>Sản phẩm</th><th>Loại</th><th>Thay đổi</th><th>Tồn sau</th><th>Lý do</th></tr></thead>
              <tbody>
                @for (m of moves.value().data; track m.id) {
                  <tr>
                    <td>{{ time(m.createdAt) }}</td>
                    <td>{{ names().get(m.productId) ?? 'SP #' + m.productId }}</td>
                    <td>{{ moveLabel[m.type] ?? m.type }}</td>
                    <td [class.bad]="m.delta < 0"><b>{{ m.delta > 0 ? '+' + m.delta : m.delta }}</b></td>
                    <td>{{ m.onHandAfter }}</td>
                    <td>{{ m.reason || '—' }}@if (m.refId) { <span class="muted small mono">{{ m.refId }}</span>}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <div class="row foot">
            <span class="muted">{{ moves.value().data.length }} / {{ moves.value().meta.totalElements }} dòng</span>
            <span class="spacer"></span>
            <button type="button" class="pg" aria-label="Trang trước" [disabled]="mpage() === 0" (click)="mpage.set(mpage() - 1)">‹</button>
            <span class="muted">Trang {{ mpage() + 1 }} / {{ moves.value().meta.totalPages || 1 }}</span>
            <button type="button" class="pg" aria-label="Trang sau" [disabled]="mpage() + 1 >= moves.value().meta.totalPages" (click)="mpage.set(mpage() + 1)">›</button>
          </div>
        } @else {
          <div class="state-box nb">Chưa có biến động kho.</div>
        }
      </div>
    }
  `,
  styles: `
    :host { display: block; }
    .head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; margin-bottom: 20px; }
    .tabs { margin-bottom: 16px; align-items: center; }
    .search { max-width: 260px; padding: 9px 14px; margin-left: auto; }
    .form { display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px; }
    .grid2 { display: grid; grid-template-columns: 1fr 2fr; gap: 12px; }
    .grid2 .input { padding: 10px 12px; }
    .err { color: var(--danger); }
    .panel { padding: 0; overflow: hidden; }
    .small { font-size: 12px; }
    td.bad { color: var(--danger); }
    .acts { white-space: nowrap; }
    .nb { border: 0; border-radius: 0; }
    .foot { padding: 14px 16px; }
    .foot2 { padding: 14px 16px; font-size: 12px; }
    .pg { min-width: 32px; height: 32px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); }
    .pg:disabled { opacity: .4; }
    @media (max-width: 767px) { .grid2 { grid-template-columns: 1fr; } .search { max-width: none; margin-left: 0; flex: 1 1 100%; } }
  `
})
export class InventoryPage {
  private readonly api = inject(Api);
  readonly branch = inject(BranchStore);

  readonly levels = LEVELS;
  readonly limit = LOW_STOCK_LIMIT;
  readonly moveLabel = MOVE_LABEL;
  readonly time = fmtDateTime;
  readonly msg = errMsg;
  readonly tabs: {key: '' | Level; name: string}[] = [
    {key: '', name: 'Tất cả'},
    {key: 'LOW', name: 'Sắp hết'},
    {key: 'OUT', name: 'Hết hàng'}
  ];

  readonly view = signal<'stock' | 'history'>('stock');
  readonly level = signal<'' | Level>('');
  readonly qInput = signal('');
  readonly q = signal('');
  readonly page = signal(0);
  readonly mpage = signal(0);
  readonly action = signal<{kind: 'receipt' | 'adjust'; row: Stock} | null>(null);
  readonly qty = signal('');
  readonly reason = signal('');
  readonly busy = signal(false);
  readonly err = signal('');
  private timer?: ReturnType<typeof setTimeout>;

  readonly list = resource({
    params: () => ({branchId: this.branch.branchId(), level: this.level(), q: this.q(), page: this.page()}),
    loader: ({params}) => this.api.get<Paged<Stock>>('/admin/inventory', {...params, size: SIZE})
  });
  /** Only fetched while the history view is open; used to show product names next to movements. */
  private readonly all = resource({
    params: () => (this.view() === 'history' ? {branchId: this.branch.branchId()} : undefined),
    loader: ({params}) => this.api.get<Paged<Stock>>('/admin/inventory', {...params, size: 200})
  });
  readonly moves = resource({
    params: () => (this.view() === 'history' ? {branchId: this.branch.branchId(), page: this.mpage()} : undefined),
    loader: ({params}) => this.api.get<Paged<Movement>>('/admin/inventory/movements', {...params, size: 30})
  });
  readonly names = computed(() => new Map((this.all.hasValue() ? this.all.value().data : []).map(s => [s.productId, s.name])));

  toggleView(): void {
    this.view.update(v => (v === 'stock' ? 'history' : 'stock'));
    this.mpage.set(0);
  }

  setLevel(l: '' | Level): void {
    this.level.set(l);
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

  open(kind: 'receipt' | 'adjust', row: Stock): void {
    this.action.set({kind, row});
    this.qty.set('');
    this.reason.set('');
    this.err.set('');
  }

  async submit(): Promise<void> {
    const a = this.action();
    if (!a || this.busy()) return;
    const n = Math.trunc(Number(this.qty().replace(/\s/g, '')));
    if (!Number.isFinite(n) || n === 0 || (a.kind === 'receipt' && n < 0)) {
      this.err.set(a.kind === 'receipt' ? 'Số lượng nhập phải lớn hơn 0.' : 'Chênh lệch phải khác 0.');
      return;
    }
    if (a.kind === 'adjust' && !this.reason().trim()) {
      this.err.set('Vui lòng nhập lý do điều chỉnh.');
      return;
    }
    this.busy.set(true);
    this.err.set('');
    try {
      const branchId = this.branch.branchId();
      if (a.kind === 'receipt') {
        await this.api.post('/admin/inventory/receipts', {branchId, lines: [{productId: a.row.productId, quantity: n}], note: this.reason().trim() || null});
      } else {
        await this.api.post('/admin/inventory/adjustments', {branchId, productId: a.row.productId, delta: n, reason: this.reason().trim()});
      }
      this.action.set(null);
      this.list.reload();
    } catch (e) {
      this.err.set(errMsg(e));
    } finally {
      this.busy.set(false);
    }
  }
}
