import {Routes} from '@angular/router';
import {adminGuard, authGuard} from './core/guards/auth.guards';

export const routes: Routes = [
  {path: '', loadComponent: () => import('./features/public/landing.page').then(m => m.LandingPage)},
  {
    path: 'login',
    loadComponent: () => import('./features/auth/auth.page').then(m => m.AuthPage),
    data: {mode: 'login'}
  }, {
    path: 'register',
    loadComponent: () => import('./features/auth/auth.page').then(m => m.AuthPage),
    data: {mode: 'register'}
  },
  {
    path: 'banks',
    loadComponent: () => import('./features/public/catalog.page').then(m => m.CatalogPage),
    data: {type: 'banks'}
  }, {
    path: 'cards',
    loadComponent: () => import('./features/public/catalog.page').then(m => m.CatalogPage),
    data: {type: 'cards'}
  }, {
    path: 'mcc',
    loadComponent: () => import('./features/public/catalog.page').then(m => m.CatalogPage),
    data: {type: 'mcc'}
  }, {
    path: 'cashback-finder',
    loadComponent: () => import('./features/public/catalog.page').then(m => m.CatalogPage),
    data: {type: 'finder'}
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
  }, {path: '**', redirectTo: ''}
];

function resourceRoutes(): Routes {
  return [
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
      path: 'investment/deposits',
      data: {resourceKey: 'investmentDeposits'}
    }, {
      path: 'investment/tasks',
      data: {resourceKey: 'investmentTasks'}
    }, {
      path: 'investment/rewards',
      data: {resourceKey: 'investmentRewards'}
    }, {
      path: 'investment/withdrawals',
      data: {resourceKey: 'investmentWithdrawals'}
    }, {
      path: 'investment/ledger',
      loadComponent: () => import('./features/ledger/ledger.page').then(m => m.LedgerPage)
    }, {path: 'reports/investment', data: {resourceKey: 'investmentReports'}},
    {path: 'notifications', data: {resourceKey: 'notifications'}}, {
      path: 'settings',
      loadComponent: () => import('./features/settings/settings.page').then(m => m.SettingsPage)
    }
  ].map(r => r.loadComponent ? r : ({
    ...r,
    loadComponent: () => import('./features/shared/resource.page').then(m => m.ResourcePage)
  }));
}
