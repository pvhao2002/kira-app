import React from 'react';
import {DemoTools, ProfileSettings} from '../src/profile';
import {Stack, useLocalSearchParams} from 'expo-router';
import {BenefitsManagement} from '../src/benefits';
import {
  AccountForm,
  AiResult,
  ConfirmationResult,
  DecisionScreen,
  DraftEdit,
  ImportScreen,
  ManualTransactionForm,
  Queue,
  SourceImage
} from '../src/investment';
import {ReportForm, Reports, TransactionDetail} from '../src/history';
import {InvestmentAccountStats, InvestmentHistory, InvestmentTransactionDetail} from '../src/investmentHistory';
import {InvestmentReportDetail, InvestmentReportForm, InvestmentReports} from '../src/investmentReports';
import {AdminInvestmentReports} from '../src/adminInvestmentReports';
import {AdminCloudflare} from '../src/adminCloudflare';
import {AdminInvestmentQueue} from '../src/adminInvestmentQueue';
import {AiJobDetail} from '../src/aiJobDetail';
import {TravelEditor} from '../src/travel';
import {BankBalanceEditor, BankBalanceHistory, BankStats} from '../src/bankStats';
import {BillingCycleEditor, CardEditor, CardManagement} from '../src/bankCards';
import {PaymentHistory, StatementEditor, StatementPayment, StatementsManagement} from '../src/statements';
import {Notifications} from '../src/notifications';
import {HealthDashboard, HealthProfileEditor} from '../src/health';
import {PasswordVault} from '../src/passwordVault';
import {TutoringSchedule} from '../src/tutoring';
import {Lodging} from '../src/lodging';
import {FavoriteSongs, JobTracker} from '../src/personal';
import {Empty, Screen} from '../src/ui';
import {useT} from '../src/i18n';

const lateralPages = ['import', 'queue', 'investment-reports'];
export default function DetailRoute() {
  const params = useLocalSearchParams<{ page: string; id?: string; accountId?: string; attachmentId?: string }>();
  const id = params.id || '';
  const accountId = params.accountId;
  const attachmentId = params.attachmentId;
  const t = useT();
  const screen = <Stack.Screen
    options={{animation: lateralPages.includes(params.page) ? 'none' : 'slide_from_right'}}/>;
  const content = (() => {
    switch (params.page) {
      case 'demo':
        return <DemoTools/>;
      case 'cards':
        return <CardManagement/>;
      case 'cards-manage':
        return <CardManagement/>;
      case 'card-add':
        return <CardEditor/>;
      case 'card-edit':
        return <CardEditor id={id}/>;
      case 'billing-cycle':
        return <BillingCycleEditor id={id}/>;
      case 'benefits':
        return <BenefitsManagement/>;
      case 'credit-stats':
        return <BankStats/>;
      case 'bank-balance':
        return <BankBalanceEditor id={id}/>;
      case 'bank-balance-history':
        return <BankBalanceHistory id={id}/>;
      case 'statements':
        return <StatementsManagement/>;
      case 'statement-add':
        return <StatementEditor/>;
      case 'payments':
        return <PaymentHistory/>;
      case 'notifications':
        return <Notifications/>;
      case 'health':
        return <HealthDashboard/>;
      case 'health-profile':
        return <HealthProfileEditor/>;
      case 'password-vault':
        return <PasswordVault/>;
      case 'tutoring':
        return <TutoringSchedule/>;
      case 'lodging':
        return <Lodging/>;
      case 'favorite-songs':
        return <FavoriteSongs/>;
      case 'job-tracker':
        return <JobTracker/>;
      case 'profile-settings':
        return <ProfileSettings/>;
      case 'statement-pay':
        return <StatementPayment id={id}/>;
      case 'account-add':
        return <AccountForm/>;
      case 'account-edit':
        return <AccountForm id={id}/>;
      case 'import':
        return <ImportScreen/>;
      case 'manual-transaction':
        return <ManualTransactionForm accountId={accountId}/>;
      case 'queue':
        return <Queue attachmentId={attachmentId}/>;
      case 'source':
        return <SourceImage id={id}/>;
      case 'ai-result':
        return <AiResult id={id}/>;
      case 'draft-edit':
        return <DraftEdit id={id}/>;
      case 'decision':
        return <DecisionScreen id={id}/>;
      case 'result-partial':
        return <ConfirmationResult partial/>;
      case 'result-success':
        return <ConfirmationResult partial={false}/>;
      case 'history':
        return <InvestmentHistory/>;
      case 'filter':
        return <InvestmentHistory initialFilter/>;
      case 'transaction-detail':
        return <InvestmentTransactionDetail id={id} accountId={accountId}/>;
      case 'investment-report-create':
        return <InvestmentReportForm accountId={accountId || ''} transactionId={id}/>;
      case 'investment-reports':
        return <InvestmentReports/>;
      case 'investment-report-detail':
        return <InvestmentReportDetail id={id}/>;
      case 'admin-investment-reports':
        return <AdminInvestmentReports/>;
      case 'admin-cloudflare':
        return <AdminCloudflare/>;
      case 'admin-ai-queue':
        return <AdminInvestmentQueue/>;
      case 'ai-job-detail':
        return <AiJobDetail id={id}/>;
      case 'admin-ai-job-detail':
        return <AiJobDetail id={id} admin/>;
      case 'admin-source':
        return <SourceImage id={id} admin/>;
      case 'admin-ai-result':
        return <AiResult id={id} admin/>;
      case 'report-create':
        return <ReportForm id={id}/>;
      case 'report-success':
        return <TransactionDetail id={id} success/>;
      case 'reports':
        return <Reports/>;
      case 'account-stats':
        return <InvestmentAccountStats id={id}/>;
      case 'travel-edit':
        return <TravelEditor id={id || undefined}/>;
      default:
        return <Screen title="Kira Life" back><Empty title={t('Không tìm thấy màn hình')}/></Screen>;
    }
  })();
  return <>{screen}{content}</>;
}
