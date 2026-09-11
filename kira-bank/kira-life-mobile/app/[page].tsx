import React from 'react';
import { DemoTools } from '../src/profile';
import { useLocalSearchParams } from 'expo-router';
import { MyCards, Benefits, CreditStats } from '../src/credit';
import { AccountForm, ImportScreen, Queue, SourceImage, AiResult, DraftEdit, DecisionScreen, ConfirmationResult } from '../src/investment';
import { History, TransactionDetail, ReportForm, Reports, AccountStats } from '../src/history';
import { Empty, Screen } from '../src/ui';
export default function DetailRoute() {
  const params = useLocalSearchParams<{ page: string; id?: string }>(); const id = params.id || '';
  switch (params.page) {
    case 'demo': return <DemoTools />;
    case 'cards': return <MyCards />;
    case 'benefits': return <Benefits />;
    case 'credit-stats': return <CreditStats />;
    case 'account-add': return <AccountForm />;
    case 'account-edit': return <AccountForm id={id} />;
    case 'import': return <ImportScreen />;
    case 'queue': return <Queue />;
    case 'source': return <SourceImage id={id} />;
    case 'ai-result': return <AiResult id={id} />;
    case 'draft-edit': return <DraftEdit id={id} />;
    case 'decision': return <DecisionScreen id={id} />;
    case 'result-partial': return <ConfirmationResult partial />;
    case 'result-success': return <ConfirmationResult partial={false} />;
    case 'history': return <History />;
    case 'filter': return <History initialFilter />;
    case 'transaction-detail': return <TransactionDetail id={id} />;
    case 'report-create': return <ReportForm id={id} />;
    case 'report-success': return <TransactionDetail id={id} success />;
    case 'reports': return <Reports />;
    case 'account-stats': return <AccountStats id={id} />;
    default: return <Screen title="Kira Life" back><Empty title="Không tìm thấy màn hình" /></Screen>;
  }
}

