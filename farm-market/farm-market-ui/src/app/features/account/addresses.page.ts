import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {Api, ApiError} from '../../core/api';
import {BranchStore} from '../../core/branch.store';
import {ImageSlot} from '../../shared/image-slot';
import {AddressDto, errMsg} from './account.data';

interface Draft {
  label: string;
  recipient: string;
  phone: string;
  line1: string;
  ward: string;
  district: string;
  city: string;
  nearestBranchId: number | null;
}

const EMPTY: Draft = {label: 'Nhà riêng', recipient: '', phone: '', line1: '', ward: '', district: '', city: '', nearestBranchId: null};

@Component({
  selector: 'app-addresses-page',
  imports: [ImageSlot],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row head">
      <h1 class="page-title">Sổ địa chỉ</h1><span class="spacer"></span>
      <button type="button" class="btn" (click)="startNew()">+ Thêm địa chỉ</button>
    </div>
    @if (notice(); as n) { <div class="msg" role="status">{{ n }}</div> }

    @if (loading()) {
      <div class="state-box">Đang tải địa chỉ…</div>
    } @else if (loadError()) {
      <div class="state-box" role="alert"><b>Không tải được địa chỉ</b>{{ loadError() }}
        <button type="button" class="btn sm" (click)="load()">Thử lại</button></div>
    } @else {
      <div class="layout">
        <div class="cards">
          @for (a of list(); track a.id) {
            <div class="card item" [class.sel]="a.id === editId()" tabindex="0" (click)="edit(a)" (keydown.enter)="edit(a)">
              <span class="icon" [class.on]="a.id === editId()">{{ short(a.label) }}</span>
              <div class="info">
                <div class="row"><b>{{ a.label }}</b>@if (a.isDefault) {<span class="pill ok">Mặc định</span>}</div>
                <div>{{ a.recipient }} · {{ a.phone }}</div>
                <div class="muted">{{ line(a) }}</div>
                @if (nearest(a); as b) {
                  <div class="nearest"><span class="dot" [style.background]="b.color"></span>Chi nhánh gần nhất: {{ b.name }}</div>
                }
              </div>
              <div class="acts">
                <button type="button" class="btn ghost sm" (click)="pick($event, a)">Sửa</button>
                @if (!a.isDefault) {
                  <button type="button" class="btn ghost sm" [disabled]="busy()" (click)="makeDefault($event, a)">Đặt mặc định</button>
                  <button type="button" class="btn danger sm" [disabled]="busy()" (click)="remove($event, a)">Xóa</button>
                }
              </div>
            </div>
          } @empty {
            <div class="state-box"><b>Chưa có địa chỉ</b>Thêm địa chỉ để chúng tôi chọn chi nhánh gần nhất.</div>
          }
        </div>

        @if (formOpen()) {
          <form class="card edit" (submit)="$event.preventDefault(); save()">
            <h2>{{ editId() === null ? 'Thêm địa chỉ mới' : 'Sửa địa chỉ · ' + draft().label }}</h2>
            <app-image-slot caption="Bản đồ chọn vị trí giao hàng" [radius]="14" ratio="16 / 7" />
            <div class="field"><span class="label">Loại địa chỉ</span>
              <div class="row wrap">
                @for (t of types; track t) {
                  <button type="button" class="tab-pill" [class.on]="draft().label === t" (click)="set('label', t)">{{ t }}</button>
                }
              </div></div>
            <div class="grid2">
              <div class="field"><label for="ad-name">Người nhận</label><input id="ad-name" class="input" [value]="draft().recipient" (input)="set('recipient', $any($event.target).value)">@if (fe('recipient'); as m) {<small class="err">{{ m }}</small>}</div>
              <div class="field"><label for="ad-phone">Số điện thoại</label><input id="ad-phone" class="input" inputmode="tel" [value]="draft().phone" (input)="set('phone', $any($event.target).value)">@if (fe('phone'); as m) {<small class="err">{{ m }}</small>}</div>
              <div class="field"><label for="ad-city">Tỉnh / Thành phố</label><input id="ad-city" class="input" [value]="draft().city" (input)="set('city', $any($event.target).value)"></div>
              <div class="field"><label for="ad-dist">Quận / Huyện</label><input id="ad-dist" class="input" [value]="draft().district" (input)="set('district', $any($event.target).value)"></div>
              <div class="field"><label for="ad-ward">Phường / Xã</label><input id="ad-ward" class="input" [value]="draft().ward" (input)="set('ward', $any($event.target).value)"></div>
              <div class="field"><label for="ad-br">Chi nhánh gần nhất</label>
                <select id="ad-br" class="input" (change)="setBranch($any($event.target).value)">
                  <option value="" [selected]="draft().nearestBranchId === null">Tự động chọn</option>
                  @for (b of branch.branches; track b.id; let i = $index) {
                    <option [value]="i + 1" [selected]="draft().nearestBranchId === i + 1">{{ b.name }}</option>
                  }
                </select></div>
              <div class="field full"><label for="ad-street">Địa chỉ cụ thể</label><input id="ad-street" class="input" [value]="draft().line1" (input)="set('line1', $any($event.target).value)">@if (fe('line1'); as m) {<small class="err">{{ m }}</small>}</div>
            </div>
            @if (formError()) { <div class="msg err" role="alert">{{ formError() }}</div> }
            <div class="row end">
              <button type="button" class="btn secondary" (click)="cancel()">Hủy</button>
              <button type="submit" class="btn" [disabled]="busy()">{{ busy() ? 'Đang lưu…' : 'Lưu địa chỉ' }}</button>
            </div>
          </form>
        }
      </div>
    }
  `,
  styles: `
    :host { display: block; min-width: 0; }
    h2 { font-size: 16px; font-weight: 600; }
    .head { margin-bottom: 24px; }
    .msg { font-size: 13px; padding: 10px 14px; border-radius: 12px; background: var(--surface-2); margin-bottom: 16px; }
    .msg.err { color: var(--danger); background: var(--danger-bg); margin: 0; }
    .err { color: var(--danger); font-size: 12px; }
    .layout { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start; }
    .cards { display: flex; flex-direction: column; gap: 14px; }
    .item { display: flex; gap: 14px; cursor: pointer; padding: 18px; border-color: transparent; }
    .item.sel { border: 1.5px solid var(--primary); }
    .icon { width: 44px; height: 44px; border-radius: 12px; background: var(--surface-2); display: grid; place-items: center; font-size: 11px; font-weight: 700; flex: none; }
    .icon.on { background: var(--primary); color: #fff; }
    .info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; font-size: 13px; }
    .nearest { display: flex; align-items: center; gap: 6px; margin-top: 4px; color: var(--muted); }
    .dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
    .acts { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
    .edit { display: flex; flex-direction: column; gap: 16px; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .full { grid-column: 1 / -1; }
    .end { justify-content: flex-end; }
    @media (max-width: 1100px) { .layout { grid-template-columns: 1fr; } }
    @media (max-width: 767px) { .item { flex-wrap: wrap; } .acts { flex-direction: row; width: 100%; justify-content: flex-end; } .grid2 { grid-template-columns: 1fr; } }
  `
})
export class AddressesPage {
  private readonly api = inject(Api);
  protected readonly branch = inject(BranchStore);
  protected readonly types = ['Nhà riêng', 'Công ty', 'Khác'];
  protected readonly list = signal<AddressDto[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal('');
  protected readonly busy = signal(false);
  protected readonly notice = signal('');
  protected readonly formOpen = signal(false);
  protected readonly editId = signal<number | null>(null);
  protected readonly draft = signal<Draft>({...EMPTY});
  protected readonly formError = signal('');
  private readonly fieldErrors = signal<Record<string, string>>({});
  /** lat/lng of the address being edited, sent back unchanged so editing never wipes them */
  private coords: {latitude: number | null; longitude: number | null} = {latitude: null, longitude: null};

  constructor() {
    void this.load();
  }

  protected async load(selectId?: number): Promise<void> {
    this.loading.set(true);
    this.loadError.set('');
    try {
      const l = await this.api.get<AddressDto[]>('/addresses');
      this.list.set(l);
      const target = l.find(a => a.id === (selectId ?? this.editId())) ?? l.find(a => a.isDefault) ?? l[0];
      if (target) this.edit(target);
      else this.startNew();
    } catch (e) {
      this.loadError.set(errMsg(e));
    } finally {
      this.loading.set(false);
    }
  }

  protected short = (label: string): string => ({'Nhà riêng': 'NHÀ', 'Công ty': 'CTY', 'Khác': 'KHÁC'})[label] ?? label.slice(0, 4).toUpperCase();
  protected line = (a: AddressDto): string => [a.line1, a.ward, a.district, a.city].filter(Boolean).join(', ');
  protected nearest = (a: AddressDto): {name: string; color: string} | null => {
    const b = a.nearestBranchId ? this.branch.branches[a.nearestBranchId - 1] : undefined;
    return b ? {name: b.name, color: this.branch.themeOf(a.nearestBranchId! - 1).primary} : null;
  };
  protected fe = (k: string): string => this.fieldErrors()[k] ?? '';

  protected edit(a: AddressDto): void {
    this.editId.set(a.id);
    this.coords = {latitude: a.latitude, longitude: a.longitude};
    this.draft.set({label: a.label, recipient: a.recipient, phone: a.phone, line1: a.line1, ward: a.ward ?? '', district: a.district ?? '', city: a.city ?? '', nearestBranchId: a.nearestBranchId});
    this.formError.set('');
    this.fieldErrors.set({});
    this.formOpen.set(true);
  }

  protected pick(e: Event, a: AddressDto): void {
    e.stopPropagation();
    this.edit(a);
  }

  protected startNew(): void {
    this.editId.set(null);
    this.coords = {latitude: null, longitude: null};
    this.draft.set({...EMPTY});
    this.formError.set('');
    this.fieldErrors.set({});
    this.formOpen.set(true);
  }

  protected cancel(): void {
    const cur = this.list().find(a => a.id === this.editId());
    if (cur) this.edit(cur);
    else if (this.list().length) this.edit(this.list().find(a => a.isDefault) ?? this.list()[0]);
    else this.startNew();
  }

  protected set<K extends keyof Draft>(k: K, v: Draft[K]): void {
    this.draft.update(d => ({...d, [k]: v}));
  }

  protected setBranch(v: string): void {
    this.set('nearestBranchId', v ? +v : null);
  }

  protected async save(): Promise<void> {
    const d = this.draft();
    this.busy.set(true);
    this.formError.set('');
    this.fieldErrors.set({});
    const body = {
      ...d, ward: d.ward || null, district: d.district || null, city: d.city || null, ...this.coords,
      makeDefault: !this.list().length
    };
    try {
      const id = this.editId();
      const saved = id === null
        ? await this.api.post<AddressDto>('/addresses', body)
        : await this.api.put<AddressDto>('/addresses/' + id, {...body, makeDefault: this.list().find(a => a.id === id)?.isDefault ?? false});
      this.notice.set('Đã lưu địa chỉ.');
      await this.load(saved.id);
    } catch (e) {
      const err = e as ApiError;
      this.fieldErrors.set(err.fieldErrors ?? {});
      this.formError.set(errMsg(e));
    } finally {
      this.busy.set(false);
    }
  }

  protected async makeDefault(e: Event, a: AddressDto): Promise<void> {
    e.stopPropagation();
    await this.act(() => this.api.post('/addresses/' + a.id + '/default'), 'Đã đặt làm địa chỉ mặc định.');
  }

  protected async remove(e: Event, a: AddressDto): Promise<void> {
    e.stopPropagation();
    await this.act(() => this.api.delete('/addresses/' + a.id), 'Đã xóa địa chỉ.');
  }

  private async act(fn: () => Promise<unknown>, ok: string): Promise<void> {
    this.busy.set(true);
    try {
      await fn();
      this.notice.set(ok);
      await this.load();
    } catch (e) {
      this.notice.set(errMsg(e));
    } finally {
      this.busy.set(false);
    }
  }
}
