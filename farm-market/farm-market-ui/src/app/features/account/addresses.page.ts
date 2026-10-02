import {ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked} from '@angular/core';
import {Api, ApiError, apiResource} from '../../core/api';
import {BranchStore} from '../../core/branch.store';
import {ImageSlot} from '../../shared/image-slot';
import {StateBox} from '../../shared/state-box';
import {AddressDto, errMsg, isFirstLoad, resErr, valueOr} from './account.data';

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
  imports: [ImageSlot, StateBox],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './addresses.page.html',
  styleUrl: './addresses.page.css'
})
export class AddressesPage {
  private readonly api = inject(Api);
  protected readonly branch = inject(BranchStore);
  protected readonly types = ['Nhà riêng', 'Công ty', 'Khác'];
  private readonly listRes = apiResource<AddressDto[]>(() => ({path: '/addresses'}));
  protected readonly list = computed(() => valueOr(this.listRes, []));
  protected readonly loading = computed(() => isFirstLoad(this.listRes));
  protected readonly loadError = computed(() => resErr(this.listRes));
  /** address to select once the next list arrives (a freshly saved one) */
  private selectId: number | undefined;
  protected readonly busy = signal(false);
  protected readonly notice = signal('');
  protected readonly noticeErr = signal(false);
  /** id of the address whose default/delete request is in flight */
  protected readonly actingId = signal<number | null>(null);
  protected readonly formOpen = signal(false);
  protected readonly editId = signal<number | null>(null);
  protected readonly draft = signal<Draft>({...EMPTY});
  protected readonly formError = signal('');
  private readonly fieldErrors = signal<Record<string, string>>({});
  /** lat/lng of the address being edited, sent back unchanged so editing never wipes them */
  private coords: {latitude: number | null; longitude: number | null} = {latitude: null, longitude: null};

  constructor() {
    // each (re)loaded list re-selects the address being edited, else the default, else the first, else starts a new one
    effect(() => {
      const l = this.list();
      if (!this.listRes.hasValue()) return;
      untracked(() => {
        const target = l.find(a => a.id === (this.selectId ?? this.editId())) ?? l.find(a => a.isDefault) ?? l[0];
        this.selectId = undefined;
        if (target) this.edit(target);
        else this.startNew();
      });
    });
  }

  protected reload(): void {
    this.listRes.reload();
  }

  protected readonly rows = computed(() => this.list().map(a => {
    const b = a.nearestBranchId ? this.branch.branches[a.nearestBranchId - 1] : undefined;
    return {
      a,
      short: ({'Nhà riêng': 'NHÀ', 'Công ty': 'CTY', 'Khác': 'KHÁC'} as Record<string, string>)[a.label] ?? a.label.slice(0, 4).toUpperCase(),
      line: [a.line1, a.ward, a.district, a.city].filter(Boolean).join(', '),
      nearest: b ? {name: b.name, color: this.branch.themeOf(a.nearestBranchId! - 1).primary} : null
    };
  }));
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
    if (this.busy() || this.actingId() !== null) return;
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
      this.noticeErr.set(false);
      this.notice.set('Đã lưu địa chỉ.');
      this.selectId = saved.id;
      this.listRes.reload();
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
    await this.act(a.id, () => this.api.post('/addresses/' + a.id + '/default'), 'Đã đặt làm địa chỉ mặc định.');
  }

  protected async remove(e: Event, a: AddressDto): Promise<void> {
    e.stopPropagation();
    await this.act(a.id, () => this.api.delete('/addresses/' + a.id), 'Đã xóa địa chỉ.');
  }

  private async act(id: number, fn: () => Promise<unknown>, ok: string): Promise<void> {
    if (this.actingId() !== null || this.busy()) return;
    this.actingId.set(id);
    try {
      await fn();
      this.noticeErr.set(false);
      this.notice.set(ok);
      this.listRes.reload();
    } catch (e) {
      this.noticeErr.set(true);
      this.notice.set(errMsg(e));
    } finally {
      this.actingId.set(null);
    }
  }
}
