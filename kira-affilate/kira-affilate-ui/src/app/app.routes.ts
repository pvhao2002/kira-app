import {Routes} from '@angular/router';
import {authGuard} from './core/guards/auth.guards';

export const routes: Routes = [
  {path: '', redirectTo: 'app/dashboard', pathMatch: 'full'},
  {
    path: 'login', title: 'Đăng nhập · Kira Affiliate', data: {mode: 'login'},
    loadComponent: () => import('./features/auth/auth.page').then(m => m.AuthPage)
  },
  {
    path: 'register', title: 'Đăng ký · Kira Affiliate', data: {mode: 'register'},
    loadComponent: () => import('./features/auth/auth.page').then(m => m.AuthPage)
  },
  {
    path: 'app',
    canActivate: [authGuard],
    loadComponent: () => import('./core/layout/app-shell').then(m => m.AppShell),
    children: [
      {path: '', redirectTo: 'dashboard', pathMatch: 'full'},
      {
        path: 'dashboard', title: 'Tổng quan · Kira Affiliate',
        loadComponent: () => import('./features/dashboard/dashboard.page').then(m => m.DashboardPage)
      },
      {
        path: 'convert', title: 'Chuyển đổi liên kết · Kira Affiliate',
        loadComponent: () => import('./features/converter/converter.page').then(m => m.ConverterPage)
      },
      {
        path: 'links', title: 'Quản lý liên kết · Kira Affiliate',
        loadComponent: () => import('./features/links/links.page').then(m => m.LinksPage)
      },
      {
        path: 'analytics', title: 'Thống kê · Kira Affiliate',
        loadComponent: () => import('./features/analytics/analytics.page').then(m => m.AnalyticsPage)
      },
      {
        path: 'orders', title: 'Đơn hàng & Hoa hồng · Kira Affiliate',
        loadComponent: () => import('./features/orders/orders.page').then(m => m.OrdersPage)
      },
      {
        path: 'offers', title: 'Sản phẩm & Chiến dịch · Kira Affiliate',
        loadComponent: () => import('./features/offers/offers.page').then(m => m.OffersPage)
      },
      {
        path: 'guides', title: 'Hướng dẫn Affiliate · Kira Affiliate', data: {topic: 'guides'},
        loadComponent: () => import('./features/knowledge/knowledge.page').then(m => m.KnowledgePage)
      },
      {
        path: 'tax', title: 'Thuế & Thu nhập · Kira Affiliate', data: {topic: 'tax'},
        loadComponent: () => import('./features/knowledge/knowledge.page').then(m => m.KnowledgePage)
      },
      {
        path: 'legal', title: 'Pháp luật Việt Nam · Kira Affiliate', data: {topic: 'legal'},
        loadComponent: () => import('./features/knowledge/knowledge.page').then(m => m.KnowledgePage)
      },
      {
        path: 'settings', title: 'Cài đặt · Kira Affiliate',
        loadComponent: () => import('./features/settings/settings.page').then(m => m.SettingsPage)
      }
    ]
  },
  {path: '**', redirectTo: 'app/dashboard'}
];
