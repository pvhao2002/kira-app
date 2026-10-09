import {downloadCsv, formatMoney} from './report-format';

describe('report-format', () => {
  it('writes a BOM-prefixed CSV, quotes cells, escapes quotes and neutralises formula prefixes', async () => {
    let blob: Blob | undefined;
    vi.spyOn(URL, 'createObjectURL').mockImplementation(value => { blob = value as Blob; return 'blob:x'; });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    downloadCsv('a.csv', ['name', 'net'], [['=SUM(A1)', -5], ['He said "hi"', null], ['+cmd', 1.5]]);
    expect(click).toHaveBeenCalled();
    const text = await blob!.text();
    expect(text.charCodeAt(0)).toBe(0xFEFF);
    const lines = text.slice(1).split('\r\n');
    expect(lines[0]).toBe('"name","net"');
    expect(lines[1]).toBe('"\'=SUM(A1)","-5"'); // text prefixed, negative number untouched
    expect(lines[2]).toBe('"He said ""hi""",""');
    expect(lines[3]).toBe('"\'+cmd","1.5"');
    vi.restoreAllMocks();
  });

  it('formats VND without decimals and other currencies with two', () => {
    expect(formatMoney('en', 'VND', 1234.5)).toContain('1,235');
    expect(formatMoney('en', 'USD', 1234.5)).toContain('1,234.50');
  });
});
