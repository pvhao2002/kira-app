import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Account, DemoState, Draft, Filter, Report, Result, seed } from './data';

const KEY = 'kira-life-demo-v1';
type Store = {
  state: DemoState; ready: boolean; storageError: string;
  update: (fn: (s: DemoState) => DemoState) => void;
  saveAccount: (a: Account) => void; editDraft: (id: string, patch: Partial<Draft>) => void;
  confirm: () => Result; report: (r: Omit<Report, 'id' | 'date' | 'status'>) => string;
  setFilter: (f: Filter) => void; scenario: (name: string) => void;
};
const Context = createContext<Store | null>(null);
const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object';
function validState(v: unknown): v is DemoState {
  if (!isRecord(v) || v.version !== 1) return false;
  const sample = seed();
  const shape = (a: unknown, b: unknown): boolean => {
    if (Array.isArray(b)) return Array.isArray(a) && a.every(x => !b.length || shape(x, b[0]));
    if (isRecord(b)) return isRecord(a) && Object.entries(b).every(([k, value]) => shape(a[k], value));
    return typeof a === typeof b && (typeof a !== 'number' || Number.isFinite(a));
  };
  return shape(v, sample);
}
export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DemoState>(seed);
  const current = useRef(state);
  const [ready, setReady] = useState(false);
  const hydrated = useRef(false);
  const [storageError, setStorageError] = useState('');
  const pendingWrite = useRef(Promise.resolve());
  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(KEY).then(raw => {
      if (!mounted) return;
      if (raw) {
        const parsed = JSON.parse(raw);
        // Upgrade the original single-type filter without discarding saved demo work.
        if (isRecord(parsed) && isRecord(parsed.filter)) {
          if (!Array.isArray(parsed.filter.types)) parsed.filter.types = parsed.filter.type && parsed.filter.type !== 'all' ? [parsed.filter.type] : [];
          if (!parsed.filter.status) parsed.filter.status = 'all';
        }
        if (!validState(parsed)) throw new Error('invalid');
        current.current = parsed;
        setState(parsed);
      }
    }).catch(() => { if (mounted) setStorageError('Không đọc được dữ liệu đã lưu. Đang dùng dữ liệu mẫu ban đầu.'); })
      .finally(() => { if (mounted) { hydrated.current = true; setReady(true); } });
    return () => { mounted = false; };
  }, []);
  function update(fn: (s: DemoState) => DemoState) {
    if (!hydrated.current) return;
    const next = fn(current.current);
    current.current = next;
    setState(next);
    const payload = JSON.stringify(next);
    pendingWrite.current = pendingWrite.current.then(() => AsyncStorage.setItem(KEY, payload))
      .then(() => setStorageError('')).catch(() => setStorageError('Chưa lưu được trên thiết bị. Thay đổi hiện chỉ có trong phiên này.'));
  }
  function confirm() {
    const result: Result = { added: 0, updated: 0, skipped: 0, unresolved: 0 };
    update(s => {
      const transactions = [...s.transactions];
      const drafts = s.drafts.map(d => {
        if (d.saved) return d;
        if (!d.selected) { result.unresolved++; return d; }
        if (!s.jobs.some(j => j.id === d.source && j.status === 'ready')) { result.unresolved++; return d; }
        if (d.decision === 'skip') { result.skipped++; return { ...d, saved: true, selected: false }; }
        const existing = transactions.findIndex(t => t.accountId === d.accountId && (t.id === d.id || (!!d.externalId && t.externalId === d.externalId)));
        if (existing >= 0 && d.decision !== 'merge') {
          // A stable draft id is already confirmed; an external-id conflict requires review.
          if (transactions[existing].id === d.id) return { ...d, saved: true, selected: false };
          result.unresolved++; return { ...d, conflict: true };
        }
        if (d.conflict && d.decision === 'accept') { result.unresolved++; return d; }
        if (d.decision === 'merge') {
          const index = existing >= 0 ? existing : transactions.findIndex(t => t.accountId === d.accountId && t.type === d.type && t.amount === d.amount && t.date.slice(0, 10) === d.date.slice(0, 10));
          if (index < 0) { result.unresolved++; return d; }
          transactions[index] = { ...transactions[index], status: d.status, description: d.description };
          result.updated++;
        } else { transactions.push({ ...d }); result.added++; }
        return { ...d, saved: true, selected: false };
      });
      const jobs = s.jobs.map(j => drafts.some(d => d.source === j.id) && drafts.filter(d => d.source === j.id).every(d => d.saved) ? { ...j, status: 'confirmed' as const } : j);
      return { ...s, transactions, drafts, jobs, result };
    });
    return result;
  }
  function scenario(name: string) {
    update(() => {
      const s = seed(); s.scenario = name;
      if (name === 'empty') s.transactions = [];
      if (name.startsWith('reference-')) {
        s.accounts[0] = { ...s.accounts[0], username: 'ssi_trietnguyen', email: 'triet.nguyen@kirabank.vn', phone: '0988 123 456' };
        s.transactions = [
          { id: 'tx-reference', accountId: 'ssi', type: 'deposit', amount: 50000000, date: '2024-10-18T09:30', externalId: 'MB-FT2410189821', description: 'Nạp tiền ký quỹ tài khoản chứng khoán SSI đợt 2 tháng 10', status: 'done', source: 'job-1' },
          { ...s.transactions[0], status: 'pending' },
          { ...s.transactions[1], amount: 15000000, date: '2024-10-15T16:45' },
          { ...s.transactions[2], amount: 75000000, date: '2024-10-15T08:12' },
          { id: 'tx-promo', accountId: 'ssi', type: 'bonus', amount: 1000000, date: '2024-10-02T11:00', externalId: 'PROMO-FALL24', description: 'Thưởng chiến dịch mùa thu', status: 'done' },
        ];
        s.reports = [
          { id: 'REP-20241018-093', transactionId: 'tx-reference', reason: 'Nạp tiền vào SSI Pro Trader', detail: 'Điều tra viên: Chuyên viên Kira Bank đang đối chiếu biên lai Napas với cổng đối soát SSI. Dự kiến hoàn tất trong 15 phút.', date: '2024-10-18', status: 'reviewing' },
          { id: 'REP-20241015-041', transactionId: 'tx-withdraw', reason: 'Rút tiền về VNDIRECT D-Stock', detail: 'Cần bạn bổ sung ảnh chụp sao kê tài khoản ngân hàng thụ hưởng.', date: '2024-10-15', status: 'pending' },
          { id: 'REP-20241010-019', transactionId: 'tx-vcf', reason: 'Nạp Quỹ mở VinaCapital VESAF', detail: 'Đã hủy bỏ bản ghi trùng lặp. Sổ đối soát độc lập đã khớp hoàn toàn 100%.', date: '2024-10-10', status: 'resolved' },
        ];
        if (name === 'reference-empty') s.transactions = [];
        if (name === 'reference-filter') s.filter = { ...s.filter, accountId: 'ssi', types: ['deposit', 'bonus'], from: '2024-10-01', to: '2024-10-18' };
        if (name === 'reference-success' || name === 'reference-partial') {
          const partial = name === 'reference-partial';
          s.result = { added: partial ? 1 : 2, updated: 0, skipped: partial ? 1 : 0, unresolved: partial ? 1 : 0 };
          s.drafts = s.drafts.map((d, i) => ({ ...d, saved: !partial || i === 0, selected: false }));
          if (partial) s.drafts.push({ ...s.drafts[0], id: 'draft-skip', type: 'withdraw', amount: 500000, saved: true, decision: 'skip', externalId: '' });
        }
      }
      if (name === 'success') { s.drafts = s.drafts.map(d => ({ ...d, conflict: false })); s.transactions = s.transactions.filter(t => t.id !== 'tx-existing'); }
      if (name === 'pending' || name === 'running' || name === 'failed') s.jobs[0].status = name;
      return s;
    });
  }
  const value: Store = {
    state, ready, storageError, update, confirm, scenario,
    saveAccount: a => update(s => ({ ...s, accounts: s.accounts.some(x => x.id === a.id) ? s.accounts.map(x => x.id === a.id ? a : x) : [...s.accounts, a] })),
    editDraft: (id, patch) => update(s => ({ ...s, drafts: s.drafts.map(d => d.id === id && !d.saved ? { ...d, ...patch, id: d.id } : d) })),
    setFilter: filter => update(s => ({ ...s, filter })),
    report: report => { const id = 'report-' + Date.now(); update(s => ({ ...s, reports: [{ ...report, id, date: new Date().toISOString().slice(0, 10), status: 'pending' }, ...s.reports] })); return id; },
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useDemo() { const context = useContext(Context); if (!context) throw new Error('Missing DemoProvider'); return context; }
