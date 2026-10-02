import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {Api, apiResource} from '../../core/api';
import {AuthStore} from '../../core/auth.store';
import {BranchStore} from '../../core/branch.store';
import {vnd} from '../../core/format';
import {StateBox} from '../../shared/state-box';
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
  imports: [StateBox],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './promotions.page.html',
  styleUrl: './promotions.page.css'
})
export class PromotionsPage {
  private readonly api = inject(Api);
  private readonly auth = inject(AuthStore);
  readonly branch = inject(BranchStore);

  readonly statusMap = PROMO_STATUS;
  readonly types = TYPES;
  /** Backend: only manager/admin may create, edit or delete promotions. */
  readonly canWrite = computed(() => {
    const r = this.auth.user()?.role;
    return r === 'manager' || r === 'admin';
  });

  readonly page = signal(0);
  readonly list = apiResource<Paged<Promo>>(() => ({path: '/admin/promotions', params: {page: this.page(), size: SIZE}}));

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
  readonly deletingId = signal<number | null>(null);
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

  readonly error = computed(() => (this.list.error() ? errMsg(this.list.error()) : ''));
  readonly rows = computed(() =>
    this.list.hasValue()
      ? this.list.value().data.map(p => ({
          ...p,
          range: `${fmtDayMonth(p.startsAt)} – ${fmtDayMonth(p.endsAt)}`,
          deal: p.type === 'FREE_SHIP' ? 'Miễn phí giao hàng' : p.type === 'PERCENT' ? `Giảm ${p.value}%` : `Giảm ${vnd(p.value)}`,
          minText: p.minOrder ? 'Đơn từ ' + vnd(p.minOrder) : 'Không tối thiểu',
          where: p.allBranches ? 'Tất cả chi nhánh' : p.branchIds.map(id => this.branch.branches[id - 1]?.short ?? `#${id}`).join(', ') || '—',
          used: `${p.usedCount}${p.usageLimit ? ' / ' + p.usageLimit : ''}`,
          pct: p.usageLimit ? Math.min(100, Math.round((p.usedCount / p.usageLimit) * 100)) : 0
        }))
      : []
  );

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
    if (!this.valid() || this.busy() || this.deletingId() !== null) return;
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

  async remove(p: {id: number; code: string}): Promise<void> {
    if (this.deletingId() !== null || !confirm(`Xóa mã ${p.code}?`)) return;
    this.deletingId.set(p.id);
    this.err.set('');
    try {
      await this.api.delete(`/admin/promotions/${p.id}`);
      if (this.editingId() === p.id) this.reset();
      this.list.reload();
    } catch (e) {
      this.err.set(errMsg(e));
    } finally {
      this.deletingId.set(null);
    }
  }
}
