import {matchesSearch, normalizeVi} from './text';

describe('diacritic-insensitive search', () => {
  it('strips Vietnamese diacritics and đ', () => {
    expect(normalizeVi('Thuế Thu Nhập Cá Nhân')).toBe('thue thu nhap ca nhan');
    expect(normalizeVi('Đối soát ĐƠN hàng')).toBe('doi soat don hang');
  });

  it('matches regardless of diacritics and case', () => {
    expect(matchesSearch('Nghĩa vụ kê khai thuế', 'ke khai')).toBe(true);
    expect(matchesSearch('Nghĩa vụ kê khai thuế', 'KÊ KHAI')).toBe(true);
    expect(matchesSearch('Hoa hồng', 'hoa hong')).toBe(true);
  });

  it('requires every word of the query, in any order', () => {
    expect(matchesSearch('Chính sách hoa hồng Shopee', 'shopee hoa')).toBe(true);
    expect(matchesSearch('Chính sách hoa hồng Shopee', 'shopee thue')).toBe(false);
  });

  it('matches everything for a blank query', () => {
    expect(matchesSearch('abc', '   ')).toBe(true);
  });
});
