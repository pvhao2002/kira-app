import {ChangeDetectionStrategy, Component, computed, inject, resource, signal} from '@angular/core';
import {Api} from '../../core/api';
import {AuthStore} from '../../core/auth.store';
import {BranchStore} from '../../core/branch.store';
import {vnd} from '../../core/format';
import {Paged, errMsg, fmtDayMonth, toDateInput} from './admin.data';

type PType = 'PERCENT' | 'FIXED' | 'FREE_SHIP';

interface Promo {
  id: number;
  code: string;
  type: PType;
  value: number;
  minOrder: number;
  maxDiscount: number | null;
  startsAt: string;
  endsAt: string;
  usageLimit: number | null;
  perUserLimit: number | null;
  usedCount: number;
  active: boolean;
  allBranches: boolean;
  branchIds: number[];
  status: 'RUNNING' | 'UPCOMING' | 'ENDED' | 'DISABLED';
}

const PROMO_STATUS: Record<Promo['status'], {label: string; cls: string}> = {
  RUNNING: {label: 'Đang chạy', cls: 'ok'},
  UPCOMING: {label: 'Sắp diễn ra', cls: 'warn'},
  ENDED: {label: 'Đã kết thúc', cls: ''},
  DISABLED: {label: 'Đã tắt', cls: 'bad'}
};
const TYPES: {key: PType; label: string}[] = [
  {key: 'PERCENT', label: 'Phần trăm'},
  {key: 'FIXED', label: 'Số tiền cố định'},
  {key: 'FREE_SHIP', label: 'Miễn phí ship'}
];
const SIZE = 20;

const iso = (date: string, end: boolean): string => new Date(`${date}T${end ? '23:59:59' : '00:00:00'}+07:00`).toISOString();
const plusDays = (d: number): string => toDateInput(new Date(Date.now() + d * 86400000).toISOString());

@Component({
  selector: 'app-promotions-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="head">
      <div>
        <div class="eyebrow">Khuyến mãi</div>
        <h1 class="page-title">Mã khuyến mãi</h1>
      </div>
    </header>

    <div class="layout" [class.ro]="!canWrite()">
      <div class="card panel">
        @if (list.error()) {
          <div class="state-box nb" role="alert"><b>{{ msg(list.error()) }}</b><button type="button" class="btn secondary" (click)="list.reload()">Thử lại</button></div>
        } @else if (!list.hasValue()) {
          <div class="state-box nb" role="status">Đang tải khuyến mãi…</div>
        } @else if (list.value().data.length) {
          <div class="table-wrap">
            <table class="table">
              <thead><tr><th>Mã</th><th>Ưu đãi</th><th>Áp dụng</th><th>Đã dùng</th><th>Trạng thái</th>@if (canWrite()) {<th></th>}</tr></thead>
              <tbody>
                @for (p of list.value().data; track p.id) {
                  <tr>
                    <td><div class="mono code">{{ p.code }}</div><div class="muted small">{{ day(p.startsAt) }} – {{ day(p.endsAt) }}</div></td>
                    <td><div>{{ deal(p) }}</div><div class="muted small">{{ p.minOrder ? 'Đơn từ ' + money(p.minOrder) : 'Không tối thiểu' }}</div></td>
                    <td>{{ where(p) }}</td>
                    <td>
                      <div class="small">{{ p.usedCount }}{{ p.usageLimit ? ' / ' + p.usageLimit : '' }}</div>
                      @if (p.usageLimit) {
                        <div class="track" role="img" [attr.aria-label]="'Đã dùng ' + pct(p) + '%'"><i [style.width.%]="pct(p)"></i></div>
                      }
                    </td>
                    <td><span class="pill" [class]="statusMap[p.status].cls">{{ statusMap[p.status].label }}</span></td>
                    @if (canWrite()) {
                      <td class="acts">
                        <button type="button" class="btn secondary sm" (click)="edit(p)">Sửa</button>
                        <button type="button" class="btn ghost sm" (click)="remove(p)">Xóa</button>
                      </td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <div class="state-box nb">Chưa có mã khuyến mãi nào.</div>
        }
      </div>

      @if (canWrite()) {
        <form class="card form" (submit)="$event.preventDefault(); save()">
          <b>{{ editingId() ? 'Sửa mã' : 'Tạo mã mới' }}</b>
          <div class="preview">
            <div><div class="small">Xem trước</div><div class="mono pcode">{{ code() || 'MÃ MỚI' }}</div></div>
            <div class="serif pval">{{ preview() }}</div>
          </div>
          <div class="field"><label for="pc">Mã</label><input id="pc" class="input mono" maxlength="40" [value]="code()" (input)="code.set($any($event.target).value.toUpperCase().replace(' ', ''))"></div>
          <div class="field">
            <span class="label">Loại ưu đãi</span>
            <div class="seg" role="radiogroup" aria-label="Loại ưu đãi">
              @for (t of types; track t.key) {
                <button type="button" role="radio" [attr.aria-checked]="type() === t.key" [class.on]="type() === t.key" (click)="type.set(t.key)">{{ t.label }}</button>
              }
            </div>
          </div>
          <div class="grid2">
            @if (type() !== 'FREE_SHIP') {
              <div class="field">
                <label for="pv">{{ type() === 'PERCENT' ? 'Phần trăm giảm (%)' : 'Số tiền giảm (₫)' }}</label>
                <input id="pv" class="input" inputmode="numeric" [value]="value()" (input)="value.set(digits($any($event.target).value))">
              </div>
            }
            @if (type() === 'PERCENT') {
              <div class="field"><label for="pmx">Giảm tối đa (₫)</label><input id="pmx" class="input" inputmode="numeric" placeholder="Không giới hạn" [value]="maxDiscount()" (input)="maxDiscount.set(digits($any($event.target).value))"></div>
            }
            <div class="field"><label for="pm">Đơn tối thiểu (₫)</label><input id="pm" class="input" inputmode="numeric" [value]="min()" (input)="min.set(digits($any($event.target).value))"></div>
            <div class="field"><label for="ps">Bắt đầu</label><input id="ps" class="input" type="date" [value]="start()" (change)="start.set($any($event.target).value)"></div>
            <div class="field"><label for="pe">Kết thúc</label><input id="pe" class="input" type="date" [value]="end()" (change)="end.set($any($event.target).value)"></div>
            <div class="field"><label for="pl">Tổng lượt dùng</label><input id="pl" class="input" inputmode="numeric" placeholder="Không giới hạn" [value]="limit()" (input)="limit.set(digits($any($event.target).value))"></div>
            <div class="field"><label for="pu">Lượt / khách</label><input id="pu" class="input" inputmode="numeric" placeholder="Không giới hạn" [value]="perUser()" (input)="perUser.set(digits($any($event.target).value))"></div>
          </div>
          <div class="field">
            <span class="label">Áp dụng tại chi nhánh</span>
            <div class="row wrap">
              <button type="button" class="chipb" [class.on]="allBranches()" [attr.aria-pressed]="allBranches()" (click)="allBranches.set(!allBranches())">Tất cả chi nhánh</button>
              @if (!allBranches()) {
                @for (b of branch.branches; track b.id; let i = $index) {
                  <button type="button" class="chipb" [class.on]="branchSel().includes(i + 1)" [attr.aria-pressed]="branchSel().includes(i + 1)" (click)="toggleBranch(i + 1)">
                    <i class="dot" [style.background]="branch.themeOf(i).primary"></i>{{ b.short }}
                  </button>
                }
              }
            </div>
          </div>
          <div class="row rec">
            <span class="grow">Đang hoạt động</span>
            <button type="button" class="toggle" [class.on]="active()" role="switch" [attr.aria-checked]="active()" aria-label="Đang hoạt động" (click)="active.set(!active())"></button>
          </div>
          @if (err()) {<p class="err small" role="alert">{{ err() }}</p>}
          <div class="row">
            @if (editingId()) {<button type="button" class="btn secondary grow" (click)="reset()">Hủy sửa</button>}
            <button type="submit" class="btn grow" [disabled]="!valid() || busy()">{{ busy() ? 'Đang lưu…' : editingId() ? 'Lưu thay đổi' : 'Kích hoạt mã' }}</button>
          </div>
        </form>
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .head { margin-bottom: 20px; }
    .layout { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr); gap: 20px; align-items: start; }
    .layout.ro { grid-template-columns: minmax(0, 1fr); }
    .panel { padding: 0; overflow: hidden; }
    .small { font-size: 12px; }
    .code { font-weight: 700; }
    .acts { white-space: nowrap; }
    .track { width: 120px; height: 6px; border-radius: 999px; background: var(--surface-2); margin-top: 6px; overflow: hidden; }
    .track i { display: block; height: 100%; background: var(--primary); border-radius: 999px; }
    .nb { border: 0; border-radius: 0; }
    .form { display: flex; flex-direction: column; gap: 16px; }
    .preview { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 16px 18px; border-radius: 14px; background: var(--primary); color: #fff; }
    .pcode { font-size: 18px; font-weight: 700; letter-spacing: .04em; }
    .pval { font-size: 28px; color: var(--accent); }
    .seg { display: flex; background: var(--surface-2); border-radius: 999px; padding: 3px; }
    .seg button { flex: 1; border: 0; background: transparent; border-radius: 999px; padding: 8px 6px; font-size: 13px; font-weight: 500; color: var(--muted); }
    .seg button.on { background: var(--surface); color: var(--primary); font-weight: 600; box-shadow: 0 1px 2px rgba(31, 42, 28, .12); }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .grid2 .input { padding: 10px 12px; }
    .chipb { display: inline-flex; align-items: center; gap: 8px; padding: 7px 12px; border-radius: 999px; background: var(--surface); border: 1px solid var(--line); font-size: 13px; }
    .chipb.on { background: var(--ink); color: #fff; border-color: var(--ink); }
    .dot { width: 9px; height: 9px; border-radius: 50%; display: inline-block; border: 1px solid rgba(255, 255, 255, .6); }
    .rec { padding: 12px; background: var(--surface-2); border-radius: 12px; font-size: 13px; gap: 14px; }
    .err { color: var(--danger); }
    .grow { flex: 1; }
    @media (max-width: 767px) { .layout { grid-template-columns: 1fr; } }
  `
})
export class PromotionsPage {
  private readonly api = inject(Api);
  private readonly auth = inject(AuthStore);
  readonly branch = inject(BranchStore);

  readonly statusMap = PROMO_STATUS;
  readonly types = TYPES;
  readonly money = vnd;
  readonly day = fmtDayMonth;
  readonly msg = errMsg;
  /** Backend: only manager/admin may create, edit or delete promotions. */
  readonly canWrite = computed(() => {
    const r = this.auth.user()?.role;
    return r === 'manager' || r === 'admin';
  });

  readonly page = signal(0);
  readonly list = resource({
    params: () => ({page: this.page()}),
    loader: ({params}) => this.api.get<Paged<Promo>>('/admin/promotions', {...params, size: SIZE})
  });

  readonly editingId = signal<number | null>(null);
  readonly code = signal('');
  readonly type = signal<PType>('PERCENT');
  readonly value = signal('10');
  readonly maxDiscount = signal('');
  readonly min = signal('200000');
  readonly start = signal(plusDays(0));
  readonly end = signal(plusDays(30));
  readonly limit = signal('');
  readonly perUser = signal('');
  readonly active = signal(true);
  readonly allBranches = signal(true);
  readonly branchSel = signal<number[]>([]);
  readonly busy = signal(false);
  readonly err = signal('');

  readonly preview = computed(() => {
    if (this.type() === 'FREE_SHIP') return 'Freeship';
    const n = Number(this.value()) || 0;
    return this.type() === 'PERCENT' ? `−${n}%` : `−${vnd(n)}`;
  });

  readonly valid = computed(() =>
    /^[A-Z0-9_-]{3,40}$/i.test(this.code()) && (this.allBranches() || this.branchSel().length > 0) &&
    (this.type() === 'FREE_SHIP' || Number(this.value()) > 0) && !!this.start() && !!this.end() && this.start() <= this.end()
  );

  pct(p: Promo): number {
    return p.usageLimit ? Math.min(100, Math.round((p.usedCount / p.usageLimit) * 100)) : 0;
  }

  deal(p: Promo): string {
    return p.type === 'FREE_SHIP' ? 'Miễn phí giao hàng' : p.type === 'PERCENT' ? `Giảm ${p.value}%` : `Giảm ${vnd(p.value)}`;
  }

  where(p: Promo): string {
    if (p.allBranches) return 'Tất cả chi nhánh';
    return p.branchIds.map(id => this.branch.branches[id - 1]?.short ?? `#${id}`).join(', ') || '—';
  }

  digits(raw: string): string {
    return raw.replace(/\D/g, '');
  }

  toggleBranch(id: number): void {
    this.branchSel.update(a => (a.includes(id) ? a.filter(x => x !== id) : [...a, id]));
  }

  edit(p: Promo): void {
    this.editingId.set(p.id);
    this.code.set(p.code);
    this.type.set(p.type);
    this.value.set(String(p.value));
    this.maxDiscount.set(p.maxDiscount ? String(p.maxDiscount) : '');
    this.min.set(String(p.minOrder));
    this.start.set(toDateInput(p.startsAt));
    this.end.set(toDateInput(p.endsAt));
    this.limit.set(p.usageLimit ? String(p.usageLimit) : '');
    this.perUser.set(p.perUserLimit ? String(p.perUserLimit) : '');
    this.active.set(p.active);
    this.allBranches.set(p.allBranches);
    this.branchSel.set([...p.branchIds]);
    this.err.set('');
  }

  reset(): void {
    this.editingId.set(null);
    this.code.set('');
    this.type.set('PERCENT');
    this.value.set('10');
    this.maxDiscount.set('');
    this.min.set('200000');
    this.start.set(plusDays(0));
    this.end.set(plusDays(30));
    this.limit.set('');
    this.perUser.set('');
    this.active.set(true);
    this.allBranches.set(true);
    this.branchSel.set([]);
    this.err.set('');
  }

  async save(): Promise<void> {
    if (!this.valid() || this.busy()) return;
    this.busy.set(true);
    this.err.set('');
    const free = this.type() === 'FREE_SHIP';
    const body = {
      code: this.code(),
      type: this.type(),
      value: free ? 0 : Number(this.value()),
      minOrder: Number(this.min()) || 0,
      maxDiscount: this.type() === 'PERCENT' && Number(this.maxDiscount()) > 0 ? Number(this.maxDiscount()) : null,
      startsAt: iso(this.start(), false),
      endsAt: iso(this.end(), true),
      usageLimit: Number(this.limit()) > 0 ? Number(this.limit()) : null,
      perUserLimit: Number(this.perUser()) > 0 ? Number(this.perUser()) : null,
      active: this.active(),
      allBranches: this.allBranches(),
      branchIds: this.allBranches() ? [] : this.branchSel()
    };
    try {
      const id = this.editingId();
      if (id) await this.api.put(`/admin/promotions/${id}`, body);
      else await this.api.post('/admin/promotions', body);
      this.reset();
      this.list.reload();
    } catch (e) {
      this.err.set(errMsg(e));
    } finally {
      this.busy.set(false);
    }
  }

  async remove(p: Promo): Promise<void> {
    if (!confirm(`Xóa mã ${p.code}?`)) return;
    try {
      await this.api.delete(`/admin/promotions/${p.id}`);
      if (this.editingId() === p.id) this.reset();
      this.list.reload();
    } catch (e) {
      this.err.set(errMsg(e));
    }
  }
}
