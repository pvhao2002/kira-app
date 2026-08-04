import {Routes} from '@angular/router';
import {adminGuard, authGuard} from './core/guards/auth.guards';

export const routes: Routes = [
  {path: '', redirectTo: 'login', pathMatch: 'full'},
  {
    path: 'login',
    loadComponent: () => import('./features/auth/auth.page').then(m => m.AuthPage),
    data: {mode: 'login'}
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
        loadComponent: () => import('./features/dashboard/dashboard.page').then(m => m.DashboardPage),
        data: {titleKey: 'route.creditDashboard'}
      },
      {
        path: 'investment/dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.page').then(m => m.DashboardPage),
        data: {titleKey: 'route.investmentDashboard'}
      },
      ...resourceRoutes(),
      {
        path: 'admin/users',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/shared/resource.page').then(m => m.ResourcePage),
        data: {resourceKey: 'adminUsers'}
      },
      {
        path: 'admin/banks',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/shared/resource.page').then(m => m.ResourcePage),
        data: {resourceKey: 'adminBanks'}
      },
      {
        path: 'profile',
        loadComponent: () => import('./features/settings/settings.page').then(m => m.SettingsPage)
      }
    ]
  }, {path: '**', redirectTo: 'login'}
];

function resourceRoutes(): Routes {
  return [
    {
      path: 'banks',
      loadComponent: () => import('./features/bank/bank.page').then(m => m.BankPage)
    },
    {
      path: 'credit-cards',
      data: {resourceKey: 'creditCards'}
    }, {
      path: 'card-transactions',
      data: {resourceKey: 'cardTransactions'}
    }, {path: 'statements', data: {resourceKey: 'statements'}}, {
      path: 'payments',
      data: {resourceKey: 'payments'}
    }, {path: 'cashbacks', data: {resourceKey: 'cashbacks'}}, {
      path: 'discount-invoices',
      data: {resourceKey: 'discountInvoices'}
    }, {path: 'reports/credit-card', data: {resourceKey: 'creditReports'}},
    {
      path: 'investment/platforms',
      data: {resourceKey: 'investmentPlatforms'}
    }, {
      path: 'investment/accounts',
      data: {resourceKey: 'investmentAccounts'}
    }, {
      path: 'investment/add-transaction',
      loadComponent: () => import('./features/investment/investment-transaction.page').then(m => m.InvestmentTransactionPage),
      data: {titleKey: 'route.addInvestmentTransaction'}
    },
    {path: 'notifications', data: {resourceKey: 'notifications'}}, {
      path: 'settings',
      loadComponent: () => import('./features/settings/settings.page').then(m => m.SettingsPage)
    }
  ].map(r => r.loadComponent ? r : ({
    ...r,
    loadComponent: () => import('./features/shared/resource.page').then(m => m.ResourcePage)
  }));
}
