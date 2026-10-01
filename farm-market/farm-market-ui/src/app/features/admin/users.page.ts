import {ChangeDetectionStrategy, Component, inject, resource, signal} from '@angular/core';
import {Api} from '../../core/api';
import {BranchStore} from '../../core/branch.store';
import {Paged, errMsg} from './admin.data';

interface UserRow {
  id: number;
  email: string;
  fullName: string;
  role: 'customer' | 'staff' | 'manager' | 'admin';
  status: 'ACTIVE' | 'LOCKED';
  branchIds: number[];
}

const ROLE: Record<string, string | undefined> = {staff: 'Nhân viên', manager: 'Quản lý', admin: 'Quản trị viên', customer: 'Khách hàng'};
const SIZE = 20;

@Component({
  selector: 'app-users-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="head">
      <div>
        <div class="eyebrow">Quản trị</div>
        <h1 class="page-title">Người dùng &amp; phân quyền chi nhánh</h1>
      </div>
    </header>

    <div class="card panel">
      <div class="row wrap bar">
        <input class="input search" type="search" placeholder="Tìm tên, email…" aria-label="Tìm người dùng" [value]="qInput()" (input)="onSearch($any($event.target).value)">
      </div>
      @if (list.error()) {
        <div class="state-box nb" role="alert"><b>{{ msg(list.error()) }}</b><button type="button" class="btn secondary" (click)="list.reload()">Thử lại</button></div>
      } @else if (!list.hasValue()) {
        <div class="state-box nb" role="status">Đang tải người dùng…</div>
      } @else if (list.value().data.length) {
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Người dùng</th><th>Vai trò</th><th>Tài khoản</th><th>Chi nhánh được phân công</th><th></th></tr></thead>
            <tbody>
              @for (u of list.value().data; track u.id) {
                <tr>
                  <td><div>{{ u.fullName }}</div><div class="muted small">{{ u.email }}</div></td>
                  <td>{{ roles[u.role] ?? u.role }}</td>
                  <td><span class="pill" [class]="u.status === 'ACTIVE' ? 'ok' : 'bad'">{{ u.status === 'ACTIVE' ? 'Hoạt động' : 'Đã khóa' }}</span></td>
                  <td>
                    @if (u.role === 'admin') {
                      <span class="muted">Tất cả chi nhánh</span>
                    } @else if (editing()?.id === u.id) {
                      <div class="row wrap">
                        @for (b of branch.branches; track b.id; let i = $index) {
                          <button type="button" class="chipb" [class.on]="sel().includes(i + 1)" [attr.aria-pressed]="sel().includes(i + 1)" (click)="toggle(i + 1)">{{ b.short }}</button>
                        }
                      </div>
                    } @else {
                      {{ names(u.branchIds) }}
                    }
                  </td>
                  <td class="acts">
                    @if (u.role !== 'admin') {
                      @if (editing()?.id === u.id) {
                        <button type="button" class="btn sm" [disabled]="busy()" (click)="save()">{{ busy() ? 'Đang lưu…' : 'Lưu' }}</button>
                        <button type="button" class="btn secondary sm" (click)="editing.set(null)">Hủy</button>
                      } @else {
                        <button type="button" class="btn secondary sm" (click)="edit(u)">Phân công</button>
                      }
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <div class="row foot">
          <span class="muted">{{ list.value().data.length }} / {{ list.value().meta.totalElements }} người dùng</span>
          <span class="spacer"></span>
          <button type="button" class="pg" aria-label="Trang trước" [disabled]="page() === 0" (click)="page.set(page() - 1)">‹</button>
          <span class="muted">Trang {{ page() + 1 }} / {{ list.value().meta.totalPages || 1 }}</span>
          <button type="button" class="pg" aria-label="Trang sau" [disabled]="page() + 1 >= list.value().meta.totalPages" (click)="page.set(page() + 1)">›</button>
        </div>
      } @else {
        <div class="state-box nb">Không tìm thấy người dùng.</div>
      }
      @if (err()) {<p class="err small pad" role="alert">{{ err() }}</p>}
    </div>
  `,
  styles: `
    :host { display: block; }
    .head { margin-bottom: 20px; }
    .panel { padding: 0; overflow: hidden; }
    .bar { padding: 16px; border-bottom: 1px solid var(--border); }
    .search { max-width: 340px; flex: 1 1 220px; padding: 10px 14px; }
    .small { font-size: 12px; }
    .err { color: var(--danger); }
    .pad { padding: 0 16px 16px; }
    .acts { white-space: nowrap; }
    .chipb { padding: 6px 12px; border-radius: 999px; background: var(--surface); border: 1px solid var(--line); font-size: 13px; }
    .chipb.on { background: var(--ink); color: #fff; border-color: var(--ink); }
    .nb { border: 0; border-radius: 0; }
    .foot { padding: 14px 16px; }
    .pg { min-width: 32px; height: 32px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); }
    .pg:disabled { opacity: .4; }
  `
})
export class UsersPage {
  private readonly api = inject(Api);
  readonly branch = inject(BranchStore);

  readonly roles = ROLE;
  readonly msg = errMsg;
  readonly qInput = signal('');
  readonly q = signal('');
  readonly page = signal(0);
  readonly editing = signal<UserRow | null>(null);
  readonly sel = signal<number[]>([]);
  readonly busy = signal(false);
  readonly err = signal('');
  private timer?: ReturnType<typeof setTimeout>;

  readonly list = resource({
    params: () => ({q: this.q(), page: this.page()}),
    loader: ({params}) => this.api.get<Paged<UserRow>>('/admin/users', {...params, size: SIZE})
  });

  onSearch(v: string): void {
    this.qInput.set(v);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.q.set(v.trim());
      this.page.set(0);
    }, 300);
  }

  names(ids: number[]): string {
    return ids.map(id => this.branch.branches[id - 1]?.short ?? `#${id}`).join(', ') || 'Chưa phân công';
  }

  edit(u: UserRow): void {
    this.editing.set(u);
    this.sel.set([...u.branchIds]);
    this.err.set('');
  }

  toggle(id: number): void {
    this.sel.update(a => (a.includes(id) ? a.filter(x => x !== id) : [...a, id]));
  }

  async save(): Promise<void> {
    const u = this.editing();
    if (!u || this.busy()) return;
    this.busy.set(true);
    this.err.set('');
    try {
      await this.api.put(`/admin/users/${u.id}/branches`, {branchIds: this.sel()});
      this.editing.set(null);
      this.list.reload();
    } catch (e) {
      this.err.set(errMsg(e));
    } finally {
      this.busy.set(false);
    }
  }
}
