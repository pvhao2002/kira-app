import {Routes} from '@angular/router';
import {authGuard, adminGuard} from './core/guards/auth.guards';

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
        data: {title: 'Tổng quan'}
      },
      {
        path: 'credit-card/dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.page').then(m => m.DashboardPage),
        data: {title: 'Dashboard thẻ tín dụng'}
      },
      {
        path: 'investment/dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.page').then(m => m.DashboardPage),
        data: {title: 'Dashboard đầu tư'}
      },
      ...resourceRoutes(),
      {
        path: 'admin/users',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/shared/resource.page').then(m => m.ResourcePage),
        data: {title: 'Quản lý người dùng', api: 'admin/users', flow: 'system'}
      },
      {
        path: 'admin/banks',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/shared/resource.page').then(m => m.ResourcePage),
        data: {title: 'Quản lý ngân hàng', api: 'admin/banks', flow: 'system'}
      },
      {
        path: 'profile',
        loadComponent: () => import('./features/shared/resource.page').then(m => m.ResourcePage),
        data: {title: 'Hồ sơ cá nhân', api: 'auth/profile', flow: 'system'}
      }
    ]
  }, {path: '**', redirectTo: ''}
];

function resourceRoutes(): Routes {
  return [
    {
      path: 'credit-cards',
      data: {title: 'Thẻ của tôi', api: 'credit-cards', flow: 'credit'}
    }, {
      path: 'card-transactions',
      data: {title: 'Giao dịch thẻ', api: 'card-transactions', flow: 'credit'}
    }, {path: 'statements', data: {title: 'Sao kê', api: 'statements', flow: 'credit'}}, {
      path: 'payments',
      data: {title: 'Thanh toán', api: 'payments', flow: 'credit'}
    }, {path: 'cashbacks', data: {title: 'Cashback', api: 'cashbacks', flow: 'credit'}}, {
      path: 'discount-invoices',
      data: {title: 'Hóa đơn chiết khấu', api: 'discount-invoices', flow: 'credit'}
    }, {path: 'reports/credit-card', data: {title: 'Báo cáo thẻ tín dụng', api: 'reports/credit-card', flow: 'credit'}},
    {
      path: 'investment/platforms',
      data: {title: 'Nền tảng đầu tư', api: 'investment/platforms', flow: 'investment'}
    }, {
      path: 'investment/accounts',
      data: {title: 'Tài khoản đầu tư', api: 'investment/accounts', flow: 'investment'}
    }, {
      path: 'investment/deposits',
      data: {title: 'Nạp tiền', api: 'investment/deposits', flow: 'investment'}
    }, {
      path: 'investment/tasks',
      data: {title: 'Nhiệm vụ đầu tư', api: 'investment/tasks', flow: 'investment'}
    }, {
      path: 'investment/rewards',
      data: {title: 'Reward', api: 'investment/rewards', flow: 'investment'}
    }, {
      path: 'investment/withdrawals',
      data: {title: 'Rút tiền', api: 'investment/withdrawals', flow: 'investment'}
    }, {
      path: 'investment/ledger',
      data: {title: 'Investment Ledger', api: 'investment/ledger', flow: 'investment'}
    }, {path: 'reports/investment', data: {title: 'Báo cáo đầu tư', api: 'reports/investment', flow: 'investment'}},
    {path: 'notifications', data: {title: 'Thông báo', api: 'notifications', flow: 'system'}}, {
      path: 'settings',
      data: {title: 'Cài đặt', api: 'settings', flow: 'system'}
    }
  ].map(r => ({...r, loadComponent: () => import('./features/shared/resource.page').then(m => m.ResourcePage)}));
}

