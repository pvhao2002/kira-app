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
