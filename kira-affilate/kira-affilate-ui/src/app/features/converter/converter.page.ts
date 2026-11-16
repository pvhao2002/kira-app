import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {rxResource} from '@angular/core/rxjs-interop';
import {FormsModule} from '@angular/forms';
import {apiErrorMessage} from '../../core/api/api-error';
import {CampaignsApi} from '../../core/api/campaigns-api.service';
import {LinksApi} from '../../core/api/links-api.service';
import {ConvertResult} from '../../core/api/models';
import {isSubId, MAX_SUB_IDS, MAX_URLS, parseUrlLines, validateUrls} from '../../core/format/validators';
import {CopyButton} from '../../shared/copy-button';
import {valueOr} from '../../shared/resource.util';
import {StatusBadge} from '../../shared/status-badge';

@Component({
  selector: 'app-converter-page',
  imports: [FormsModule, CopyButton, StatusBadge],
  templateUrl: './converter.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ConverterPage {
  private readonly links = inject(LinksApi);
  private readonly campaignsApi = inject(CampaignsApi);
  protected readonly maxUrls = MAX_URLS;

  protected readonly text = signal('');
  protected readonly campaignId = signal('');
  protected readonly subIds = signal<string[]>(Array.from({length: MAX_SUB_IDS}, () => ''));
  protected readonly errors = signal<string[]>([]);
  protected readonly busy = signal(false);
  protected readonly results = signal<ConvertResult[] | null>(null);

  protected readonly campaignsRes = rxResource({stream: () => this.campaignsApi.list()});
  protected readonly campaigns = computed(() => valueOr(this.campaignsRes, []));
  protected readonly urlCount = computed(() => parseUrlLines(this.text()).length);
  protected readonly allShortLinks = computed(() =>
    (this.results() ?? []).flatMap(r => r.shortLink ? [r.shortLink] : []).join('\n') || null);

  protected setSubId(index: number, value: string): void {
    this.subIds.update(ids => ids.map((id, i) => i === index ? value : id));
  }

  protected subIdInvalid(value: string): boolean {
    return value.trim() !== '' && !isSubId(value.trim());
  }

  protected convert(): void {
    const urls = parseUrlLines(this.text());
    const subIds = this.campaignId() ? [] : this.subIds().map(s => s.trim()).filter(Boolean);
    const errors = validateUrls(urls);
    if (subIds.some(s => !isSubId(s))) errors.push('Sub ID chỉ gồm chữ cái không dấu và chữ số, tối đa 50 ký tự.');
    this.errors.set(errors);
    if (errors.length || this.busy()) return;

    this.busy.set(true);
    this.results.set(null);
    // campaignId and subIds are mutually exclusive in the API.
    this.links.convert({urls, ...(this.campaignId() ? {campaignId: Number(this.campaignId())} : subIds.length ? {subIds} : {})}).subscribe({
      next: r => {
        this.busy.set(false);
        this.results.set(r.results);
      },
      error: e => {
        this.busy.set(false);
        this.errors.set([apiErrorMessage(e)]);
      }
    });
  }
}
