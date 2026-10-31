import { expect, it } from 'vitest';
import { csvCell } from './csv';

it('quotes cells and neutralises spreadsheet formulas', () => {
  expect(csvCell('Saga "pattern"')).toBe('"Saga ""pattern"""');
  expect(csvCell('=HYPERLINK("http://evil","x")')).toBe(`"'=HYPERLINK(""http://evil"",""x"")"`);
  for (const lead of ['+', '-', '@', '\t', '\r']) expect(csvCell(`${lead}1`)).toBe(`"'${lead}1"`);
  expect(csvCell(42)).toBe('"42"');
});
