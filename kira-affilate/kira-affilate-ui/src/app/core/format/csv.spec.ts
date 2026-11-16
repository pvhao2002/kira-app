import {csvBody} from './csv';

describe('csvBody', () => {
  it('quotes cells, escapes quotes and guards formula prefixes on strings only', () => {
    expect(csvBody(['Tên', 'GMV'], [['=SUM(A1)', -5], ['a "b"', null]]))
      .toBe('"Tên","GMV"\r\n"\'=SUM(A1)","-5"\r\n"a ""b""",""');
  });
});
