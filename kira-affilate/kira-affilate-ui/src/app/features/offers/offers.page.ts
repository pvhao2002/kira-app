import {ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal} from '@angular/core';
import {rxResource} from '@angular/core/rxjs-interop';
import {FormsModule} from '@angular/forms';
import {RouterLink} from '@angular/router';
import {map, Observable} from 'rxjs';
import {apiErrorCode, apiErrorMessage} from '../../core/api/api-error';
import {LinksApi} from '../../core/api/links-api.service';
import {OfferPage, OfferQuery} from '../../core/api/models';
import {ShopeeApi} from '../../core/api/shopee-api.service';
import {formatNumber, formatRate, formatUnixSeconds, formatVnd} from '../../core/format/formatters';
import {ToastService} from '../../core/services/toast.service';
import {CopyButton} from '../../shared/copy-button';
import {valueOr} from '../../shared/resource.util';
import {StateBox} from '../../shared/state-box';

type Tab = 'products' | 'shops' | 'campaigns';

/** What a card needs, whichever of the three Shopee offer types it comes from. */
interface OfferCard {
  key: string;
  title: string;
  imageUrl: string | null;
  rate: string;
  /** The Shopee URL that "Lấy link" converts. */
  link: string;
  facts: string[];
}

interface LinkState {
  busy?: boolean;
  shortLink?: string;
  error?: string;
}

// sortType values are Shopee's own (productOfferV2 / shopOfferV2 / shopeeOfferV2) and are passed through unchanged.
const TABS: {id: Tab; label: string; placeholder: string; sorts: {value: number; label: string}[]}[] = [
  {
    id: 'products', label: 'Sản phẩm', placeholder: 'Tên sản phẩm', sorts: [
      {value: 1, label: 'Liên quan nhất'}, {value: 2, label: 'Bán chạy nhất'}, {value: 3, label: 'Giá cao đến thấp'},
      {value: 4, label: 'Giá thấp đến cao'}, {value: 5, label: 'Hoa hồng cao nhất'}]
  },
  {
    id: 'shops', label: 'Shop', placeholder: 'Tên shop', sorts: [
      {value: 1, label: 'Mới nhất'}, {value: 2, label: 'Hoa hồng cao nhất'}, {value: 3, label: 'Phổ biến nhất'}]
  },
  {
    id: 'campaigns', label: 'Chiến dịch Shopee', placeholder: 'Tên chiến dịch', sorts: [
      {value: 1, label: 'Mới nhất'}, {value: 2, label: 'Hoa hồng cao nhất'}]
  }
];

const period = (start: number | null, end: number | null): string[] =>
  start == null && end == null ? [] : [`Thời gian: ${formatUnixSeconds(start)} – ${formatUnixSeconds(end)}`];

@Component({
  selector: 'app-offers-page',
  imports: [FormsModule, RouterLink, CopyButton, StateBox],
  templateUrl: './offers.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OffersPage {
  private readonly shopee = inject(ShopeeApi);
  private readonly linksApi = inject(LinksApi);
  private readonly toast = inject(ToastService);
  protected readonly tabs = TABS;

  protected readonly tab = signal<Tab>('products');
  protected readonly view = computed(() => TABS.find(t => t.id === this.tab()) ?? TABS[0]);
  protected readonly keywordDraft = signal('');
  protected readonly keyword = signal('');
  protected readonly sortType = signal('');
  private readonly filters = computed(() => ({tab: this.tab(), keyword: this.keyword(), sortType: this.sortType()}));
  /** Shopee pages are 1-based; any filter change returns to the first page. */
  protected readonly page = linkedSignal({source: this.filters, computation: () => 1});

  protected readonly offers = rxResource({
    params: () => ({...this.filters(), page: this.page()}),
    stream: ({params}) => this.load(params.tab, {
      keyword: params.keyword || undefined, sortType: params.sortType ? Number(params.sortType) : undefined, page: params.page, limit: 20
    })
  });
  protected readonly cards = computed(() => valueOr(this.offers, null)?.items ?? []);
  protected readonly hasNext = computed(() => valueOr(this.offers, null)?.hasNextPage ?? false);
  protected readonly notConnected = computed(() => apiErrorCode(this.offers.error()) === 'SHOPEE_NOT_CONNECTED');
  protected readonly linkStates = signal<Record<string, LinkState>>({});

  protected selectTab(tab: Tab): void {
    this.keywordDraft.set('');
    this.keyword.set('');
    this.sortType.set('');
    this.linkStates.set({});
    this.tab.set(tab);
  }

  protected applySearch(): void {
    this.keyword.set(this.keywordDraft().trim());
  }

  protected getLink(card: OfferCard): void {
    this.setLink(card.key, {busy: true});
    this.linksApi.convert({urls: [card.link]}).subscribe({
      next: r => {
        const result = r.results[0];
        if (result?.status === 'OK' && result.shortLink) {
          this.setLink(card.key, {shortLink: result.shortLink});
          navigator.clipboard?.writeText(result.shortLink).then(
            () => this.toast.show('Đã tạo và sao chép liên kết tiếp thị.', 'success'),
            () => this.toast.show('Đã tạo liên kết tiếp thị.', 'success'));
        } else {
          this.setLink(card.key, {error: result?.error || 'Không tạo được liên kết cho mục này.'});
        }
      },
      error: e => this.setLink(card.key, {error: apiErrorMessage(e)})
    });
  }

  private setLink(key: string, state: LinkState): void {
    this.linkStates.update(all => ({...all, [key]: state}));
  }

  private load(tab: Tab, query: OfferQuery): Observable<OfferPage<OfferCard>> {
    const page = <T>(toCard: (item: T) => OfferCard) => map((p: OfferPage<T>) => ({...p, items: p.items.map(toCard)}));
    switch (tab) {
      case 'products':
        return this.shopee.products(query).pipe(page(p => ({
          key: `p${p.itemId}`, title: p.productName, imageUrl: p.imageUrl, rate: formatRate(p.commissionRate), link: p.productLink,
          facts: [
            p.priceMin != null && p.priceMax != null && Number(p.priceMin) !== Number(p.priceMax)
              ? `Giá: ${formatVnd(p.priceMin)} – ${formatVnd(p.priceMax)}` : `Giá: ${formatVnd(p.priceMin ?? p.priceMax)}`,
            `Hoa hồng mỗi đơn: ${formatVnd(p.commission)}`,
            ...(p.sales != null ? [`Đã bán: ${formatNumber(p.sales)}`] : []),
            ...(p.shopName ? [`Shop: ${p.shopName}`] : [])
          ]
        })));
      case 'shops':
        return this.shopee.shops(query).pipe(page(s => ({
          key: `s${s.shopId}`, title: s.shopName, imageUrl: s.imageUrl, rate: formatRate(s.commissionRate), link: s.originalLink,
          facts: [...(s.ratingStar != null ? [`Đánh giá: ${formatNumber(Number(s.ratingStar))}/5`] : []), ...period(s.periodStartTime, s.periodEndTime)]
        })));
      case 'campaigns':
        return this.shopee.campaigns(query).pipe(page(c => ({
          key: `c${c.originalLink}`, title: c.offerName, imageUrl: c.imageUrl, rate: formatRate(c.commissionRate), link: c.originalLink,
          facts: period(c.periodStartTime, c.periodEndTime)
        })));
    }
  }
}
