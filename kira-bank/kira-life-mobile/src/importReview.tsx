import React, {createContext, useContext, useRef, useState} from 'react';
import {
  ConfirmBatchResponse,
  ConfirmItemRequest,
  ImportItemResponse,
  ImportState,
  InvestmentImportResolution,
  InvestmentTransactionStatus,
  InvestmentTransactionType,
  useInvestmentApi,
} from './investmentApi';

type Override = {
  selected?: boolean; resolution?: InvestmentImportResolution | null;
  transactionType?: InvestmentTransactionType; transactionStatus?: InvestmentTransactionStatus;
  amount?: number; currency?: string; transactionAt?: string; externalTransactionId?: string; description?: string;
};
export type EffectiveItem = ImportItemResponse & { selected: boolean; resolution: InvestmentImportResolution | null };

type ReviewCtx = {
  accountId: number | null;
  state: ImportState | null;
  loading: boolean;
  error: string;
  startUpload: (accountId: number, files: { uri: string; name: string; type: string }[]) => Promise<void>;
  load: (accountId: number) => Promise<void>;
  refresh: () => Promise<void>;
  retryFile: (attachmentId: number) => Promise<void>;
  clear: () => void;
  effective: (itemId: string) => EffectiveItem | undefined;
  setOverride: (itemId: string, patch: Override) => void;
  toggleSelected: (itemId: string) => void;
  confirm: () => Promise<ConfirmBatchResponse>;
  lastResult: ConfirmBatchResponse | null;
};
const Context = createContext<ReviewCtx | null>(null);

function defaultResolution(item: ImportItemResponse): InvestmentImportResolution | null {
  if (item.processingAction === 'REVIEW') return null;
  if (item.processingAction === 'IGNORE' || item.processingAction === 'DUPLICATE') return 'SKIP';
  if (item.processingAction === 'UPDATE') return 'MERGE_EXISTING';
  return 'ACCEPT';
}

function defaultSelected(item: ImportItemResponse): boolean {
  return item.processingAction !== 'IGNORE';
}

export function ImportReviewProvider({children}: { children: React.ReactNode }) {
  const api = useInvestmentApi();
  const [accountId, setAccountId] = useState<number | null>(null);
  const [state, setState] = useState<ImportState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [, bump] = useState(0);
  const [lastResult, setLastResult] = useState<ConfirmBatchResponse | null>(null);
  const overrides = useRef<Record<string, Override>>({});

  function apply(nextAccountId: number, next: ImportState) {
    if (accountId !== nextAccountId) overrides.current = {};
    setAccountId(nextAccountId);
    setState(next);
  }

  async function startUpload(accId: number, files: { uri: string; name: string; type: string }[]) {
    setLoading(true);
    setError('');
    try {
      apply(accId, await api.uploadImport(accId, files));
    } finally {
      setLoading(false);
    }
  }

  async function load(accId: number) {
    setLoading(true);
    setError('');
    try {
      apply(accId, await api.getImportState(accId));
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    if (accountId) apply(accountId, await api.getImportState(accountId));
  }

  async function retryFile(attachmentId: number) {
    await api.runAiJob(attachmentId);
    await refresh();
  }

  function clear() {
    setAccountId(null);
    setState(null);
    overrides.current = {};
    setError('');
    setLastResult(null);
  }

  function effective(itemId: string): EffectiveItem | undefined {
    const item = state?.transactions.find(t => t.itemId === itemId);
    if (!item) return undefined;
    const o = overrides.current[itemId] || {};
    return {
      ...item,
      transactionType: o.transactionType ?? item.transactionType,
      transactionStatus: o.transactionStatus ?? item.transactionStatus,
      amount: o.amount ?? item.amount,
      currency: o.currency ?? item.currency,
      transactionAt: o.transactionAt ?? item.transactionAt,
      externalTransactionId: o.externalTransactionId ?? item.externalTransactionId,
      description: o.description ?? item.description,
      selected: o.selected ?? defaultSelected(item),
      resolution: o.resolution !== undefined ? o.resolution : defaultResolution(item),
    };
  }

  function setOverride(itemId: string, patch: Override) {
    overrides.current = {...overrides.current, [itemId]: {...overrides.current[itemId], ...patch}};
    bump(x => x + 1);
  }

  function toggleSelected(itemId: string) {
    const current = effective(itemId);
    setOverride(itemId, {selected: !(current?.selected ?? true)});
  }

  async function confirm() {
    if (!accountId || !state) throw new Error('No import loaded');
    const items: ConfirmItemRequest[] = state.transactions.map(item => {
      const eff = effective(item.itemId)!;
      return {
        itemId: item.itemId, version: item.version, selected: eff.selected, resolution: eff.resolution,
        transactionType: eff.transactionType, transactionStatus: eff.transactionStatus, amount: eff.amount,
        currency: eff.currency, transactionAt: eff.transactionAt, externalTransactionId: eff.externalTransactionId,
        description: eff.description,
      };
    });
    const result = await api.confirmImport(accountId, items);
    setLastResult(result);
    return result;
  }

  return <Context.Provider value={{
    accountId,
    state,
    loading,
    error,
    startUpload,
    load,
    refresh,
    retryFile,
    clear,
    effective,
    setOverride,
    toggleSelected,
    confirm,
    lastResult
  }}>{children}</Context.Provider>;
}

export function useImportReview() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error('Missing ImportReviewProvider');
  return ctx;
}
