// Client-side checks only improve feedback; the server re-validates every URL and Sub ID.
export const MAX_URLS = 50;
export const MAX_SUB_IDS = 5;
const SUB_ID = /^[A-Za-z0-9]{1,50}$/;

export function isSubId(value: string): boolean {
  return SUB_ID.test(value);
}

function isShopeeHost(host: string): boolean {
  return host === 'shopee.vn' || host.endsWith('.shopee.vn') || host === 'shope.ee';
}

/** Vietnamese error for a URL that is not an https Shopee link, or null when it is acceptable. */
export function shopeeUrlError(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return 'Liên kết không hợp lệ';
  }
  if (url.protocol !== 'https:') return 'Liên kết phải bắt đầu bằng https://';
  if (url.username || url.password) return 'Liên kết không được chứa thông tin đăng nhập';
  if (!isShopeeHost(url.hostname.toLowerCase())) return 'Chỉ hỗ trợ liên kết shopee.vn, s.shopee.vn hoặc shope.ee';
  return null;
}

export function parseUrlLines(text: string): string[] {
  return text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
}

export function validateUrls(urls: string[]): string[] {
  if (!urls.length) return ['Vui lòng nhập ít nhất một liên kết Shopee'];
  if (urls.length > MAX_URLS) return [`Tối đa ${MAX_URLS} liên kết mỗi lần (đang có ${urls.length})`];
  return urls.flatMap((url, i) => {
    const error = shopeeUrlError(url);
    return error ? [`Dòng ${i + 1}: ${error}`] : [];
  });
}
