import {numberFormat} from '../../../core/i18n/formatters';

export function formatMoney(locale: string, currency: string, amount: number): string {
  return numberFormat(locale, {style: 'currency', currency, maximumFractionDigits: currency === 'VND' ? 0 : 2}).format(amount);
}

/** Download rows as a UTF-8 CSV (BOM so Excel reads Vietnamese correctly); cells are quoted and formula-prefix guarded. */
export function downloadCsv(filename: string, header: string[], rows: (string | number | null)[][]): void {
  const cell = (value: string | number | null): string => {
    let text = value == null ? '' : String(value);
    if (/^[=+\-@\t\r]/.test(text) && typeof value === 'string') text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  const body = [header, ...rows].map(row => row.map(cell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['\uFEFF', body], {type: 'text/csv;charset=utf-8'}));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export const REPORT_STYLES = `
  :host { display:block; color:var(--navy); }
  .panel { padding:20px; border:1px solid var(--border); border-radius:15px; background:var(--surface); }
  .head { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; }.head h2 { margin:0; font-size:18px; }
  .metrics { display:grid; grid-template-columns:repeat(auto-fit,minmax(130px,1fr)); gap:14px; margin:18px 0; }
  .metrics article { min-width:0; padding:10px 12px; border:1px solid var(--border); border-radius:10px; }
  .metrics small { display:block; color:var(--muted); font-size:11px; }.metrics strong { display:block; margin-top:6px; font-size:15px; overflow-wrap:anywhere; }
  .pos { color:#2563eb; font-weight:700; }.neg { color:#dc2626; font-weight:700; }.pos-bg { background:#2563eb; }.neg-bg { background:#dc2626; }
  h3 { margin:20px 0 8px; font-size:14px; }.scroll,.table-wrap { overflow-x:auto; }.table-wrap { margin-top:16px; }
  table { width:100%; border-collapse:collapse; font-size:12px; }
  th { padding:9px 8px; color:var(--muted); font-size:10px; font-weight:600; text-align:left; white-space:nowrap; }td { padding:10px 8px; border-top:1px solid var(--border); white-space:nowrap; }
  .bars { display:flex; gap:4px; padding-bottom:6px; }.col { display:flex; flex-direction:column; flex:1; min-width:0; align-items:center; }
  .top,.bottom { display:flex; width:100%; height:90px; justify-content:center; }.top { align-items:flex-end; }.bottom { align-items:flex-start; }
  .zero { width:100%; height:1px; background:var(--border); }.bar { width:60%; max-width:34px; min-height:2px; border-radius:3px; }
  .col small { margin-top:6px; color:var(--muted); font-size:10px; white-space:nowrap; }
`;
