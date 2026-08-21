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
        path: 'lodgings',
        loadComponent: () => import('./features/lodging/lodging.page').then(m => m.LodgingPage),
        data: {titleKey: 'shell.lodgings'}
      },
      ...resourceRoutes(),
      {
        path: 'admin/users',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/shared/resource.page').then(m => m.ResourcePage),
        data: {resourceKey: 'adminUsers', titleKey: 'route.adminUsers'}
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
