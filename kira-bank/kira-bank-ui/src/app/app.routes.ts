import {Routes} from '@angular/router';
import {adminGuard, authGuard} from './core/guards/auth.guards';

export const routes: Routes = [
  {path: '', redirectTo: 'login', pathMatch: 'full'},
  {
    path: 'login',
    loadComponent: () => import('./features/auth/auth.page').then(m => m.AuthPage),
    data: {mode: 'login', titleKey: 'route.login'}
  },
  {
    path: 'app',
    canActivate: [authGuard],
    loadComponent: () => import('./core/layout/app-shell').then(m => m.AppShell),
    children: [
      {
        path: 'admin/login-visits', canActivate: [adminGuard],
        loadComponent: () => import('./features/login-visits/login-visits.page').then(m => m.LoginVisitsPage),
        data: {titleKey: 'visits.title'}
      },
      {
        path: 'travel',
        loadComponent: () => import('./features/travel/travel.page').then(m => m.TravelPage),
        canDeactivate: [(component: {canLeave: () => boolean}) => component.canLeave()],
        data: {titleKey: 'travel.title'}
      },
      {path: 'health', redirectTo: 'health/overview', pathMatch: 'full'},
      ...['overview', 'profile', 'plans', 'journal', 'connection'].map(section => ({
        path: `health/${section}`,
        loadComponent: () => import('./features/health/health.page').then(m => m.HealthPage),
        data: {healthSection: section, titleKey: `health.${section}`}
      })),
      {
        path: '',
        loadComponent: () => import('./features/dashboard/dashboard.page').then(m => m.DashboardPage),
        data: {titleKey: 'route.overview'}
      },
      {
        path: 'credit-card/dashboard',
        loadComponent: () => import('./features/credit-card-dashboard/credit-card-dashboard.page')
          .then(m => m.CreditCardDashboardPage),
        data: {titleKey: 'route.creditDashboard'}
      },
      {
        path: 'credit-card/statement-import',
        loadComponent: () => import('./features/credit-card-statement-import/credit-card-statement-import.page')
          .then(m => m.CreditCardStatementImportPage),
        data: {titleKey: 'route.cardImport'}
      },
      {
        path: 'credit-card/recommend',
        loadComponent: () => import('./features/credit-card-recommend/credit-card-recommend.page')
          .then(m => m.CreditCardRecommendPage),
        data: {titleKey: 'route.cardRecommend'}
      },
      {
        path: 'credit-card/benefits',
        loadComponent: () => import('./features/credit-card-benefits/credit-card-benefits.page')
          .then(m => m.CreditCardBenefitsPage),
        data: {titleKey: 'route.creditBenefits'}
      },
      {
        path: 'investment/statistics',
        loadComponent: () => import('./features/investment/investment-statistics.page').then(m => m.InvestmentStatisticsPage),
        data: {titleKey: 'route.investmentStatistics'}
      },
      {
        path: 'investment/transactions',
        loadComponent: () =>
          import('./features/investment/investment-transaction.page').then(m => m.InvestmentTransactionPage),
        data: {titleKey: 'route.investmentTransactions'}
      },
      {
        path: 'investment/ai-queue',
        loadComponent: () =>
          import('./features/investment/investment-ai-queue.page').then(m => m.InvestmentAiQueuePage),
        data: {titleKey: 'route.investmentAiQueue'}
      },
      {
        path: 'investment/history',
        loadComponent: () =>
          import('./features/investment/investment-history.page').then(m => m.InvestmentHistoryPage),
        data: {titleKey: 'route.investmentHistory'}
      },
      {
        path: 'reports/finance',
        loadComponent: () => import('./features/reports/finance-report.page').then(m => m.FinanceReportPage),
        data: {titleKey: 'route.financeReport'}
      },
      {
        path: 'lodgings',
        loadComponent: () => import('./features/lodging/lodging.page').then(m => m.LodgingPage),
        data: {titleKey: 'shell.lodgings'}
      },
      {
        path: 'password-manager',
        loadComponent: () => import('./features/password-manager/password-manager.page')
          .then(m => m.PasswordManagerPage),
        data: {titleKey: 'route.passwordManager'}
      },
      {
        path: 'tutor-schedule',
        loadComponent: () => import('./features/tutor-schedule/tutor-schedule.page')
          .then(m => m.TutorSchedulePage),
        data: {titleKey: 'route.tutorSchedule'}
      },
      {
        path: 'karaoke',
        loadComponent: () => import('./features/shared/resource.page').then(m => m.ResourcePage),
        data: {resourceKey: 'favoriteSongs', titleKey: 'route.favoriteSongs'}
      },
      {
        path: 'job-applications',
        loadComponent: () => import('./features/shared/resource.page').then(m => m.ResourcePage),
        data: {resourceKey: 'jobApplications', titleKey: 'route.jobApplications'}
      },
      ...resourceRoutes(),
      {
        path: 'admin/users',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/admin-users/admin-users.page').then(m => m.AdminUsersPage),
        data: {titleKey: 'route.adminUsers'}
      },
      {
        path: 'admin/banks',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/shared/resource.page').then(m => m.ResourcePage),
        data: {resourceKey: 'adminBanks', titleKey: 'route.adminBanks'}
      },
      {
        path: 'admin/cloudflare-accounts',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/admin-ai-providers/admin-ai-providers.page')
          .then(m => m.AdminAiProvidersPage),
        data: {titleKey: 'route.adminAiProviders'}
      },
      {path: 'admin/ai-providers', redirectTo: 'admin/cloudflare-accounts', pathMatch: 'full'},
      {
        path: 'profile',
        loadComponent: () => import('./features/settings/settings.page').then(m => m.SettingsPage),
        data: {titleKey: 'route.profile'}
      }
    ]
  }, {path: '**', redirectTo: 'login'}
];

function resourceRoutes(): Routes {
  const definitions: Routes = [
    {
      path: 'banks',
      loadComponent: () => import('./features/bank/bank.page').then(m => m.BankPage),
      data: {titleKey: 'route.banks'}
    },
    {
      path: 'credit-cards',
      data: {resourceKey: 'creditCards', titleKey: 'route.myCards'}
    },
    {path: 'statements', redirectTo: 'credit-cards', pathMatch: 'full'},
    {path: 'payments', redirectTo: 'credit-cards', pathMatch: 'full'},
    {path: 'reports/credit-card', data: {resourceKey: 'creditReports', titleKey: 'route.creditReports'}},
    {
      path: 'investment/accounts',
      data: {resourceKey: 'investmentAccounts', titleKey: 'route.investmentAccounts'}
    },
    {path: 'notifications', data: {resourceKey: 'notifications', titleKey: 'route.notifications'}}, {
      path: 'settings',
      loadComponent: () => import('./features/settings/settings.page').then(m => m.SettingsPage),
      data: {titleKey: 'route.settings'}
    }
  ];

  return definitions.map(r => r.loadComponent || r.redirectTo ? r : ({
    ...r,
    loadComponent: () => import('./features/shared/resource.page').then(m => m.ResourcePage)
  }));
}
