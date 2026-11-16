export type CsvCell = string | number | null;

/** Cells are quoted; strings starting with a formula prefix are neutralised (CSV injection guard). */
export function csvBody(header: string[], rows: CsvCell[][]): string {
  const cell = (value: CsvCell): string => {
    let text = value == null ? '' : String(value);
    if (/^[=+\-@\t\r]/.test(text) && typeof value === 'string') text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  return [header, ...rows].map(row => row.map(cell).join(',')).join('\r\n');
}

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Download rows as a UTF-8 CSV (BOM so Excel reads Vietnamese correctly). */
export function downloadCsv(filename: string, header: string[], rows: CsvCell[][]): void {
  saveBlob(new Blob(['﻿', csvBody(header, rows)], {type: 'text/csv;charset=utf-8'}), filename);
}
