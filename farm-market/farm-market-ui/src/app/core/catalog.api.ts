import {Injectable, inject} from '@angular/core';
import {Api, PageResponse} from './api';
import {Product} from './mock-data';

export interface ApiProductSummary {
  id: number;
  slug: string;
  name: string;
  category: string;
  categoryName: string;
  price: number;
  oldPrice: number | null;
  unit: string;
  badge: string | null;
  rating: number;
  reviews: number;
  origin: string | null;
  imageUrl: string | null;
  sold: number;
  branchId: number;
  branchCode: string;
  available: number;
  inStock: boolean;
}

export interface ApiOtherBranch {
  branchId: number;
  branchCode: string;
  branchName: string;
  productId: number;
  slug: string;
  price: number;
  available: number;
  inStock: boolean;
}

export interface ApiProductDetail {
  product: ApiProductSummary;
  sku: string;
  description: string | null;
  branch: {id: number; code: string; name: string};
  otherBranches: ApiOtherBranch[];
}

export interface Category {
  id: number;
  slug: string;
  name: string;
  count: number;
}

export interface ApiReview {
  id: number;
  rating: number;
  body: string;
  author: string;
  createdAt: string;
  reply: {body: string; repliedAt: string} | null;
}

export interface ProductQuery {
  q?: string;
  category?: string;
  branchId?: number;
  minPrice?: number | null;
  maxPrice?: number | null;
  inStock?: boolean;
  sort?: string;
  page?: number;
  size?: number;
}

const soldText = (n: number): string => (n >= 1000 ? (n / 1000).toFixed(1).replace('.', ',').replace(',0', '') + 'k đã bán' : n > 0 ? n + ' đã bán' : '');

/** Map a backend ProductSummary to the storefront view model. */
export function toProduct(s: ApiProductSummary): Product {
  return {
    id: String(s.id),
    productId: s.id,
    slug: s.slug,
    name: s.name,
    cat: s.categoryName,
    categorySlug: s.category,
    price: s.price,
    old: s.oldPrice ?? undefined,
    unit: s.unit,
    badge: s.inStock ? (s.badge ?? undefined) : 'Hết hàng',
    rating: Number(s.rating),
    reviews: s.reviews,
    origin: s.origin ?? '',
    ph: s.name,
    sold: soldText(s.sold),
    outOfStock: !s.inStock,
    branchId: s.branchId,
    available: s.available
  };
}

@Injectable({providedIn: 'root'})
export class CatalogApi {
  private readonly api = inject(Api);

  categories(): Promise<Category[]> {
    return this.api.get<Category[]>('/categories');
  }

  async search(q: ProductQuery): Promise<{items: Product[]; meta: PageResponse<unknown>['meta']}> {
    const r = await this.api.get<PageResponse<ApiProductSummary>>('/products', {...q});
    return {items: r.data.map(toProduct), meta: r.meta};
  }

  detail(slug: string): Promise<ApiProductDetail> {
    return this.api.get<ApiProductDetail>('/products/' + encodeURIComponent(slug));
  }

  reviews(slug: string): Promise<PageResponse<ApiReview>> {
    return this.api.get<PageResponse<ApiReview>>(`/products/${encodeURIComponent(slug)}/reviews`, {size: 5});
  }
}
