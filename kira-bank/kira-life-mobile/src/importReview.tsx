import React, {createContext, useContext, useRef, useState} from 'react';
import {
  ConfirmBatchResponse,
  ConfirmItemRequest,
  ImportBatchResponse,
  ImportItemResponse,
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
  batch: ImportBatchResponse | null;
  loading: boolean;
  error: string;
  startUpload: (accountId: number, files: { uri: string; name: string; type: string }[]) => Promise<void>;
  loadBatch: (accountId: number, batchId: string) => Promise<void>;
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
  const [batch, setBatch] = useState<ImportBatchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [, bump] = useState(0);
  const [lastResult, setLastResult] = useState<ConfirmBatchResponse | null>(null);
  const overrides = useRef<Record<string, Override>>({});

  function reset(nextAccountId: number, next: ImportBatchResponse) {
    overrides.current = {};
    setAccountId(nextAccountId);
    setBatch(next);
  }

  async function startUpload(accId: number, files: { uri: string; name: string; type: string }[]) {
    setLoading(true);
    setError('');
    try {
      const result = await api.createImportBatch(accId, files);
      reset(accId, result);
    } finally {
      setLoading(false);
    }
  }

  async function loadBatch(accId: number, batchId: string) {
    setLoading(true);
    setError('');
    try {
      const result = await api.getImportBatch(accId, batchId);
      if (!batch || batch.batchId !== batchId) overrides.current = {};
      setAccountId(accId);
      setBatch(result);
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    if (!accountId || !batch) return;
    const result = await api.getImportBatch(accountId, batch.batchId);
    setBatch(result);
  }

  async function retryFile(attachmentId: number) {
    if (!accountId || !batch) return;
    const result = await api.retryImportFile(accountId, batch.batchId, attachmentId);
    setBatch(result);
  }

  function clear() {
    setAccountId(null);
    setBatch(null);
    overrides.current = {};
    setError('');
    setLastResult(null);
  }

  function effective(itemId: string): EffectiveItem | undefined {
    const item = batch?.transactions.find(t => t.itemId === itemId);
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
    if (!accountId || !batch) throw new Error('No batch loaded');
    const items: ConfirmItemRequest[] = batch.transactions.map(item => {
      const eff = effective(item.itemId)!;
      return {
        itemId: item.itemId, version: item.version, selected: eff.selected, resolution: eff.resolution,
        transactionType: eff.transactionType, transactionStatus: eff.transactionStatus, amount: eff.amount,
        currency: eff.currency, transactionAt: eff.transactionAt, externalTransactionId: eff.externalTransactionId,
        description: eff.description,
      };
    });
    const result = await api.confirmImportBatch(accountId, batch.batchId, items);
    setLastResult(result);
    return result;
  }

  return <Context.Provider value={{
    accountId,
    batch,
    loading,
    error,
    startUpload,
    loadBatch,
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
