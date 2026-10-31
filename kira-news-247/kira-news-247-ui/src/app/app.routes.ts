import { Routes } from '@angular/router';
import { adminGuard, signedInGuard } from './core/auth-store';
import { PublicShell } from './public/public-shell';
import { articleResolver, categoryResolver } from './public/resolvers';

export const routes: Routes = [
  {
    path: 'admin/dang-nhap',
    loadComponent: () => import('./admin/login-page').then((m) => m.LoginPage),
  },
  {
    path: 'admin',
    canActivate: [signedInGuard],
    loadComponent: () => import('./admin/admin-shell').then((m) => m.AdminShell),
    children: [
      { path: '', canActivate: [adminGuard], loadComponent: () => import('./admin/dashboard-page').then((m) => m.DashboardPage) },
      { path: 'bai-viet', loadComponent: () => import('./admin/article-list-page').then((m) => m.ArticleListPage), data: { mode: 'review' } },
      { path: 'viec-cho-ai', loadComponent: () => import('./admin/article-list-page').then((m) => m.ArticleListPage), data: { mode: 'ai' } },
      { path: 'viet-bai', loadComponent: () => import('./admin/article-editor-page').then((m) => m.ArticleEditorPage) },
      { path: 'bai-viet/:id', loadComponent: () => import('./admin/article-editor-page').then((m) => m.ArticleEditorPage) },
      { path: 'chuyen-muc', canActivate: [adminGuard], loadComponent: () => import('./admin/categories-page').then((m) => m.CategoriesPage) },
      { path: 'luot-doc', canActivate: [adminGuard], loadComponent: () => import('./admin/reads-page').then((m) => m.ReadsPage) },
      { path: 'huong-dan-ai', loadComponent: () => import('./admin/ai-guide-page').then((m) => m.AiGuidePage) },
    ],
  },
  {
    path: '',
    component: PublicShell,
    children: [
      { path: '', loadComponent: () => import('./public/home-page').then((m) => m.HomePage) },
      { path: 'chuyen-muc/:slug', resolve: { category: categoryResolver }, loadComponent: () => import('./public/category-page').then((m) => m.CategoryPage) },
      { path: 'tin/:slug', resolve: { article: articleResolver }, loadComponent: () => import('./public/article-page').then((m) => m.ArticlePage) },
      { path: 'tim-kiem', loadComponent: () => import('./public/search-page').then((m) => m.SearchPage) },
      { path: '**', loadComponent: () => import('./public/not-found-page').then((m) => m.NotFoundPage) },
    ],
  },
];
