import {ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal} from '@angular/core';
import {Api, apiResource} from '../../core/api';
import {BranchStore} from '../../core/branch.store';
import {StateBox} from '../../shared/state-box';
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
  imports: [StateBox],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './inventory.page.html',
  styleUrl: './inventory.page.css'
})
export class InventoryPage {
  private readonly api = inject(Api);
  readonly branch = inject(BranchStore);

  readonly levels = LEVELS;
  readonly limit = LOW_STOCK_LIMIT;
  readonly tabs: {key: '' | Level; name: string}[] = [
    {key: '', name: 'Tất cả'},
    {key: 'LOW', name: 'Sắp hết'},
    {key: 'OUT', name: 'Hết hàng'}
  ];

  readonly view = signal<'stock' | 'history'>('stock');
  readonly level = signal<'' | Level>('');
  readonly qInput = signal('');
  readonly q = signal('');
  /** Both pagers go back to page 1 whenever the working branch changes. */
  readonly page = linkedSignal({source: () => this.branch.branchId(), computation: () => 0});
  readonly mpage = linkedSignal({source: () => this.branch.branchId(), computation: () => 0});
  readonly action = signal<{kind: 'receipt' | 'adjust'; row: Stock} | null>(null);
  readonly qty = signal('');
  readonly reason = signal('');
  readonly busy = signal(false);
  readonly err = signal('');
  private timer?: ReturnType<typeof setTimeout>;

  readonly list = apiResource<Paged<Stock>>(() => ({
    path: '/admin/inventory',
    params: {branchId: this.branch.branchId(), level: this.level(), q: this.q(), page: this.page(), size: SIZE}
  }));
  /** Only fetched while the history view is open; used to show product names next to movements. */
  private readonly all = apiResource<Paged<Stock>>(() =>
    this.view() === 'history' ? {path: '/admin/inventory', params: {branchId: this.branch.branchId(), size: 200}} : undefined
  );
  readonly moves = apiResource<Paged<Movement>>(() =>
    this.view() === 'history' ? {path: '/admin/inventory/movements', params: {branchId: this.branch.branchId(), page: this.mpage(), size: 30}} : undefined
  );
  readonly names = computed(() => new Map((this.all.hasValue() ? this.all.value().data : []).map(s => [s.productId, s.name])));

  readonly error = computed(() => (this.list.error() ? errMsg(this.list.error()) : ''));
  readonly movesError = computed(() => (this.moves.error() ? errMsg(this.moves.error()) : ''));
  readonly moveRows = computed(() =>
    this.moves.hasValue()
      ? this.moves.value().data.map(m => ({
          ...m,
          time: fmtDateTime(m.createdAt),
          product: this.names().get(m.productId) ?? 'SP #' + m.productId,
          label: MOVE_LABEL[m.type] ?? m.type,
          change: m.delta > 0 ? '+' + m.delta : String(m.delta)
        }))
      : []
  );

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
      this.all.reload();
      this.moves.reload();
    } catch (e) {
      this.err.set(errMsg(e));
    } finally {
      this.busy.set(false);
    }
  }
}
