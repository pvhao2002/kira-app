import {isSubId, MAX_URLS, parseUrlLines, shopeeUrlError, validateUrls} from './validators';

describe('shopeeUrlError', () => {
  it.each([
    'https://shopee.vn/product/1/2',
    'https://www.shopee.vn/abc',
    'https://s.shopee.vn/AbCd',
    'https://shope.ee/xyz',
    'https://SHOPEE.VN/Ao-thun-i.1.2'
  ])('accepts %s', url => expect(shopeeUrlError(url)).toBeNull());

  it.each([
    'http://shopee.vn/product/1/2',
    'https://shopee.vn.evil.com/x',
    'https://evilshopee.vn/x',
    'https://shopee.com/x',
    'https://lazada.vn/x',
    'https://user@evil.com/shopee.vn',
    'https://shopee.vn@evil.com/',
    'javascript:alert(1)',
    'shopee.vn/product',
    'not a url'
  ])('rejects %s', url => expect(shopeeUrlError(url)).not.toBeNull());
});

describe('parseUrlLines / validateUrls', () => {
  it('splits on lines, trims and drops blanks', () => {
    expect(parseUrlLines(' https://shopee.vn/a \r\n\n https://shope.ee/b\n')).toEqual(['https://shopee.vn/a', 'https://shope.ee/b']);
  });

  it('reports the line of each invalid URL', () => {
    const errors = validateUrls(['https://shopee.vn/a', 'https://lazada.vn/b']);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('Dòng 2');
  });

  it('requires 1..50 URLs', () => {
    expect(validateUrls([])).toHaveLength(1);
    const many = Array.from({length: MAX_URLS + 1}, (_, i) => `https://shopee.vn/${i}`);
    expect(validateUrls(many)).toHaveLength(1);
    expect(validateUrls(many.slice(0, MAX_URLS))).toEqual([]);
  });
});

describe('isSubId', () => {
  it('accepts 1..50 ASCII letters and digits', () => {
    expect(isSubId('fb01')).toBe(true);
    expect(isSubId('A'.repeat(50))).toBe(true);
  });

  it('rejects empty, too long, and other characters', () => {
    expect(isSubId('')).toBe(false);
    expect(isSubId('A'.repeat(51))).toBe(false);
    expect(isSubId('fb-01')).toBe(false);
    expect(isSubId('fb 01')).toBe(false);
    expect(isSubId('tiếp')).toBe(false);
  });
});
