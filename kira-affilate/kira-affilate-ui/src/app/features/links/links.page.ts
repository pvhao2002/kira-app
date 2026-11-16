import {ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal} from '@angular/core';
import {rxResource} from '@angular/core/rxjs-interop';
import {FormsModule} from '@angular/forms';
import {apiErrorMessage} from '../../core/api/api-error';
import {CampaignsApi} from '../../core/api/campaigns-api.service';
import {LinksApi} from '../../core/api/links-api.service';
import {Campaign, LinkStatus} from '../../core/api/models';
import {saveBlob} from '../../core/format/csv';
import {formatDateTime} from '../../core/format/formatters';
import {isSubId, MAX_SUB_IDS} from '../../core/format/validators';
import {ToastService} from '../../core/services/toast.service';
import {CopyButton} from '../../shared/copy-button';
import {Pager, Sort, SortHeader, sortParam} from '../../shared/data-table';
import {DateRangePicker} from '../../shared/date-range';
import {presetRange} from '../../shared/date-range.util';
import {valueOr} from '../../shared/resource.util';
import {StateBox} from '../../shared/state-box';
import {StatusBadge} from '../../shared/status-badge';

@Component({
  selector: 'app-links-page',
  imports: [FormsModule, CopyButton, Pager, SortHeader, DateRangePicker, StateBox, StatusBadge],
  templateUrl: './links.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LinksPage {
  private readonly api = inject(LinksApi);
  private readonly campaignsApi = inject(CampaignsApi);
  private readonly toast = inject(ToastService);
  protected readonly formatDateTime = formatDateTime;
  protected readonly tab = signal<'links' | 'campaigns'>('links');

  // ----- link history -----
  protected readonly searchDraft = signal('');
  protected readonly search = signal('');
  protected readonly status = signal<LinkStatus | ''>('');
  protected readonly campaignId = signal('');
  protected readonly range = signal(presetRange('30d'));
  protected readonly sort = signal<Sort>({field: 'createdAt', dir: 'desc'});
  private readonly filters = computed(() => ({
    search: this.search(), status: this.status(), campaignId: this.campaignId() ? Number(this.campaignId()) : '' as const, ...this.range()
  }));
  /** Any filter change returns to the first page. */
  protected readonly page = linkedSignal({source: this.filters, computation: () => 0});
  protected readonly links = rxResource({
    params: () => ({...this.filters(), page: this.page(), size: 20, sort: sortParam(this.sort())}),
    stream: ({params}) => this.api.list(params)
  });
  protected readonly rows = computed(() => valueOr(this.links, null)?.data ?? []);
  protected readonly meta = computed(() => valueOr(this.links, null)?.meta ?? null);
  protected readonly confirmDeleteLink = signal<number | null>(null);
  protected readonly exporting = signal(false);

  // ----- campaigns -----
  protected readonly campaignsRes = rxResource({stream: () => this.campaignsApi.list()});
  protected readonly campaigns = computed(() => valueOr(this.campaignsRes, []));
  protected readonly editing = signal<Campaign | null>(null);
  protected readonly campaignName = signal('');
  protected readonly campaignSubIds = signal('');
  protected readonly campaignError = signal('');
  protected readonly savingCampaign = signal(false);
  protected readonly confirmDeleteCampaign = signal<number | null>(null);

  protected applySearch(): void {
    this.search.set(this.searchDraft().trim());
  }

  protected deleteLink(id: number): void {
    this.api.delete(id).subscribe({
      next: () => {
        this.confirmDeleteLink.set(null);
        this.toast.show('Đã xóa liên kết khỏi lịch sử.', 'success');
        this.links.reload();
      },
      error: e => this.toast.show(apiErrorMessage(e), 'error')
    });
  }

  protected exportCsv(): void {
    this.exporting.set(true);
    this.api.export({...this.filters(), sort: sortParam(this.sort())}).subscribe({
      next: blob => {
        this.exporting.set(false);
        saveBlob(blob, `lien-ket_${this.range().from}_${this.range().to}.csv`);
      },
      error: e => {
        this.exporting.set(false);
        this.toast.show(apiErrorMessage(e, 'Không xuất được CSV. Vui lòng thử lại.'), 'error');
      }
    });
  }

  protected editCampaign(campaign: Campaign | null): void {
    this.editing.set(campaign);
    this.campaignName.set(campaign?.name ?? '');
    this.campaignSubIds.set(campaign?.subIds.join(', ') ?? '');
    this.campaignError.set('');
  }

  protected saveCampaign(): void {
    const name = this.campaignName().trim();
    const subIds = this.campaignSubIds().split(/[\s,]+/).filter(Boolean);
    const error = !name ? 'Vui lòng nhập tên chiến dịch.'
      : !subIds.length ? 'Vui lòng nhập ít nhất một Sub ID.'
        : subIds.length > MAX_SUB_IDS ? `Tối đa ${MAX_SUB_IDS} Sub ID cho mỗi chiến dịch.`
          : subIds.some(s => !isSubId(s)) ? 'Sub ID chỉ gồm chữ cái không dấu và chữ số, tối đa 50 ký tự.' : '';
    this.campaignError.set(error);
    if (error || this.savingCampaign()) return;

    this.savingCampaign.set(true);
    const editing = this.editing();
    (editing ? this.campaignsApi.update(editing.id, {name, subIds}) : this.campaignsApi.create({name, subIds})).subscribe({
      next: () => {
        this.savingCampaign.set(false);
        this.toast.show(editing ? 'Đã cập nhật chiến dịch.' : 'Đã tạo chiến dịch.', 'success');
        this.editCampaign(null);
        this.campaignsRes.reload();
      },
      error: e => {
        this.savingCampaign.set(false);
        this.campaignError.set(apiErrorMessage(e));
      }
    });
  }

  protected deleteCampaign(id: number): void {
    this.campaignsApi.delete(id).subscribe({
      next: () => {
        this.confirmDeleteCampaign.set(null);
        if (this.editing()?.id === id) this.editCampaign(null);
        this.toast.show('Đã xóa chiến dịch.', 'success');
        this.campaignsRes.reload();
      },
      error: e => this.toast.show(apiErrorMessage(e), 'error')
    });
  }
}
