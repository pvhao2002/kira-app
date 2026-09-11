export type Account = { id: string; code: string; name: string; currency: 'VND' | 'USD'; status: 'active' | 'paused' | 'closed'; username: string; email: string; phone: string; registered: string };
export type Decision = 'accept' | 'merge' | 'new' | 'skip';
export type Transaction = { id: string; accountId: string; type: 'deposit' | 'withdraw' | 'bonus'; amount: number; date: string; externalId: string; description: string; status: 'done' | 'pending' | 'failed' | 'cancelled'; source?: string };
export type Draft = Transaction & { decision: Decision; conflict: boolean; selected: boolean; saved: boolean };
export type JobStatus = 'pending' | 'running' | 'ready' | 'failed' | 'cancelled' | 'confirmed';
export type Job = { id: string; name: string; size: string; status: JobStatus; attempts: number; accountId: string };
export type Report = { id: string; transactionId: string; reason: string; detail: string; date: string; status: 'pending' | 'reviewing' | 'resolved' };
export type Filter = { query: string; type: 'all' | Transaction['type']; types: Transaction['type'][]; status: 'all' | Transaction['status']; accountId: string; from: string; to: string; min: string; max: string };
export type Result = { added: number; updated: number; skipped: number; unresolved: number };
export type DemoState = { version: 1; accounts: Account[]; transactions: Transaction[]; drafts: Draft[]; jobs: Job[]; reports: Report[]; filter: Filter; result: Result; scenario: string; cashbackCap: number; mcc: string[]; frozenCards: string[]; creditConfig?: { banks: Record<string, { limit: number; debt: number }>; cards: Record<string, number>; audit: { target: string; reason: string; date: string }[] } };
export const emptyFilter: Filter = { query: '', type: 'all', types: [], status: 'all', accountId: 'all', from: '', to: '', min: '', max: '' };
export const banks = [
  { id: 'tcb', name: 'Techcombank', short: 'TCB', limit: 150000000, debt: 38200000, cards: 2, color: colorsPrimary() },
  { id: 'vpb', name: 'VPBank', short: 'VPB', limit: 50000000, debt: 14300000, cards: 1, color: '#69dfb1' },
  { id: 'vib', name: 'VIB', short: 'VIB', limit: 50000000, debt: 10000000, cards: 1, color: '#c8a0f0' },
];
function colorsPrimary() { return '#7dd3fc'; }
export const cards = [
  { id: '8829', bank: 'tcb', name: 'Visa Signature', expiry: '08/28', debt: 28400000 },
  { id: '4190', bank: 'tcb', name: 'Everyday', expiry: '11/27', debt: 9800000 },
  { id: '1204', bank: 'vpb', name: 'StepUp Mastercard', expiry: '04/29', debt: 14300000 },
  { id: '9931', bank: 'vib', name: 'Cash Back', expiry: '02/30', debt: 10000000 },
];
export const typeNames = { deposit: 'Nạp tiền', withdraw: 'Rút tiền', bonus: 'Thưởng' };
export const decisionNames: Record<Decision, string> = { accept: 'Chấp nhận', merge: 'Gộp với bản ghi có sẵn', new: 'Lưu như giao dịch mới', skip: 'Bỏ qua' };
export const jobNames: Record<JobStatus, string> = { pending: 'Đang chờ', running: 'Đang xử lý', ready: 'Sẵn sàng', failed: 'Thất bại', cancelled: 'Đã hủy', confirmed: 'Đã xác nhận' };
export const money = (value: number, currency = 'VND') => new Intl.NumberFormat('vi-VN', { style: 'currency', currency, maximumFractionDigits: currency === 'VND' ? 0 : 2 }).format(value);
export const dateLabel = (value: string) => { const [date, time] = value.split('T'); return date.split('-').reverse().join('/') + (time ? ' · ' + time.slice(0, 5) : ''); };
export function validDate(value: string, withTime = false) {
  if (!(withTime ? /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/ : /^\d{4}-\d{2}-\d{2}$/).test(value)) return false;
  const date = new Date(withTime ? value + ':00Z' : value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, withTime ? 16 : 10) === value;
}
export function seed(): DemoState {
  return {
    version: 1, scenario: 'ready', filter: { ...emptyFilter }, cashbackCap: 1000000, mcc: ['5812', '5814', '5462'], frozenCards: [],
    result: { added: 0, updated: 0, skipped: 0, unresolved: 0 },
    accounts: [
      { id: 'ssi', code: 'SSI-001C-VN', name: 'SSI Pro Trader', currency: 'VND', status: 'active', username: 'minhtriet_demo', email: 'triet@example.com', phone: '0900 000 000', registered: '2023-03-15' },
      { id: 'vcf', code: 'VCF-9821-VN', name: 'VinaCapital VEOF', currency: 'VND', status: 'active', username: 'minhtriet_demo', email: 'triet@example.com', phone: '0900 000 000', registered: '2023-08-20' },
      { id: 'ibkr', code: 'IBKR-DEMO', name: 'Interactive Brokers', currency: 'USD', status: 'paused', username: 'minhtriet_demo', email: 'triet@example.com', phone: '0900 000 000', registered: '2024-01-10' },
    ],
    transactions: [
      { id: 'tx-existing', accountId: 'ssi', type: 'bonus', amount: 2500000, date: '2024-10-18T14:15', externalId: 'BONUS-001', description: 'Khoản thưởng quý III', status: 'done' },
      { id: 'tx-withdraw', accountId: 'ssi', type: 'withdraw', amount: 500000, date: '2024-10-17T10:30', externalId: 'WD-001', description: 'Rút tiền về tài khoản ngân hàng', status: 'done' },
      { id: 'tx-vcf', accountId: 'vcf', type: 'deposit', amount: 10000000, date: '2024-10-16T09:00', externalId: 'VCF-001', description: 'Góp vốn định kỳ', status: 'done' },
    ],
    drafts: [
      { id: 'draft-1', accountId: 'ssi', type: 'deposit', amount: 50000000, date: '2024-10-18T09:30', externalId: 'MB-FT2410189821', description: 'Nạp tiền tài khoản SSI', status: 'done', decision: 'accept', conflict: false, selected: true, saved: false, source: 'job-1' },
      { id: 'draft-2', accountId: 'ssi', type: 'bonus', amount: 2500000, date: '2024-10-18T14:15', externalId: '', description: 'Khoản thưởng quý III', status: 'done', decision: 'accept', conflict: true, selected: true, saved: false, source: 'job-1' },
    ],
    jobs: [
      { id: 'job-1', name: 'chung_tu_nap_tien_01.png', size: '2.4 MB', status: 'ready', attempts: 1, accountId: 'ssi' },
      { id: 'job-2', name: 'bien_lai_thuong_quy_02.jpg', size: '1.8 MB', status: 'running', attempts: 1, accountId: 'ssi' },
      { id: 'job-3', name: 'sao_ke_thang_10.png', size: '3.1 MB', status: 'pending', attempts: 0, accountId: 'ssi' },
      { id: 'job-4', name: 'anh_chup_khong_ro.jpg', size: '1.2 MB', status: 'failed', attempts: 3, accountId: 'ssi' },
    ],
    reports: [{ id: 'report-1', transactionId: 'tx-withdraw', reason: 'Sai số tiền', detail: 'Đề nghị kiểm tra chứng từ gốc.', date: '2024-10-19', status: 'reviewing' }],
  };
}
export function filteredTransactions(s: DemoState) {
  const f = s.filter;
  return s.transactions.filter(t => (f.accountId === 'all' || t.accountId === f.accountId) && (!f.types.length || f.types.includes(t.type)) && (f.status === 'all' || t.status === f.status)
    && (!f.from || t.date.slice(0, 10) >= f.from) && (!f.to || t.date.slice(0, 10) <= f.to)
    && (!f.min || t.amount >= Number(f.min)) && (!f.max || t.amount <= Number(f.max))
    && `${t.externalId} ${t.description} ${typeNames[t.type]}`.toLocaleLowerCase('vi').includes(f.query.toLocaleLowerCase('vi')))
    .sort((a, b) => b.date.localeCompare(a.date));
}
