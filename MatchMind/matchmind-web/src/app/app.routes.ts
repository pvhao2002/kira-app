import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { AuthService, passwordChangeGuard } from './core/auth.service';
import { authGuard, guestGuard } from './core/http';
import { NotFoundPage } from './layout/not-found';

/** Admin-only pages: the API refuses viewers anyway (403); this keeps them from landing on an empty, failing page. */
const adminGuard: CanActivateFn = () => inject(AuthService).isAdmin() || inject(Router).createUrlTree(['/dashboard']);

export const routes: Routes = [
  { path: 'login', canActivate: [guestGuard], title: 'Sign in', loadComponent: () => import('./pages/login').then(m => m.LoginPage) },
  {
    path: '',
    canActivate: [authGuard],
    canActivateChild: [passwordChangeGuard],
    loadComponent: () => import('./layout/shell').then(m => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', title: 'Dashboard', loadComponent: () => import('./pages/dashboard').then(m => m.DashboardPage) },
      { path: 'matches', title: 'Matches', loadComponent: () => import('./pages/matches').then(m => m.MatchesPage) },
      { path: 'matches/:id', title: 'Match', loadComponent: () => import('./pages/match-detail').then(m => m.MatchDetailPage) },
      { path: 'predictions', title: 'Predictions', loadComponent: () => import('./pages/predictions').then(m => m.PredictionsPage) },
      { path: 'predictions/:id', title: 'Prediction', loadComponent: () => import('./pages/prediction-detail').then(m => m.PredictionDetailPage) },
      { path: 'models', title: 'AI Models', loadComponent: () => import('./pages/models').then(m => m.ModelsPage) },
      { path: 'models/:id', title: 'AI Model', loadComponent: () => import('./pages/model-detail').then(m => m.ModelDetailPage) },
      // Viewers see the list; the admin actions are hidden for them (and refused by the API).
      { path: 'providers', title: 'Providers', loadComponent: () => import('./pages/providers').then(m => m.ProvidersPage) },
      { path: 'reports', title: 'Reports', loadComponent: () => import('./pages/reports').then(m => m.ReportsPage) },
      { path: 'account', title: 'Account Management', loadComponent: () => import('./pages/account').then(m => m.AccountPage) },
      { path: 'prompts', title: 'Prompt Notes', loadComponent: () => import('./pages/prompts').then(m => m.PromptsPage),
        canDeactivate: [(page: { canLeave(): boolean | Promise<boolean> }) => page.canLeave()] },
      { path: 'import', title: 'Import prediction', canActivate: [adminGuard], loadComponent: () => import('./pages/import').then(m => m.ImportPage) },
      { path: 'visitors', title: 'Visitors', canActivate: [adminGuard], loadComponent: () => import('./pages/visitors').then(m => m.VisitorsPage) },
      { path: 'api-logs', title: 'API Logs', canActivate: [adminGuard], loadComponent: () => import('./pages/api-logs').then(m => m.ApiLogsPage) },
      { path: 'settings', title: 'Settings', loadComponent: () => import('./pages/settings').then(m => m.SettingsPage) },
      // Signed-in unknown URL: a 404 inside the shell. Signed out, the parent's authGuard sends it to login first.
      { path: '**', title: 'Page not found', component: NotFoundPage },
    ],
  },
];
