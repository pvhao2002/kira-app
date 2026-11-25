import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { AuthService, passwordChangeGuard } from './core/auth.service';
import { authGuard, guestGuard } from './core/http';
import { NotFoundPage } from './layout/not-found';

/** Admin-only pages: the API refuses viewers anyway (403); this keeps them from landing on an empty, failing page. */
const adminGuard: CanActivateFn = () => inject(AuthService).isAdmin() || inject(Router).createUrlTree(['/predictions']);

export const routes: Routes = [
  { path: 'login', canActivate: [guestGuard], title: 'Sign in', loadComponent: () => import('./pages/login').then(m => m.LoginPage) },
  {
    path: '',
    canActivate: [authGuard],
    canActivateChild: [passwordChangeGuard],
    loadComponent: () => import('./layout/shell').then(m => m.Shell),
    children: [
      // Start page: the dashboard for admins, the predictions for everyone else (the dashboard names models).
      { path: '', pathMatch: 'full', redirectTo: () => inject(AuthService).isAdmin() ? 'dashboard' : 'predictions' },
      { path: 'dashboard', title: 'Dashboard', canActivate: [adminGuard], loadComponent: () => import('./pages/dashboard').then(m => m.DashboardPage) },
      { path: 'matches', title: 'Matches', loadComponent: () => import('./pages/matches').then(m => m.MatchesPage) },
      { path: 'matches/:id', title: 'Match', loadComponent: () => import('./pages/match-detail').then(m => m.MatchDetailPage) },
      { path: 'predictions', title: 'Predictions', loadComponent: () => import('./pages/predictions').then(m => m.PredictionsPage) },
      { path: 'predictions/:id', title: 'Prediction', loadComponent: () => import('./pages/prediction-detail').then(m => m.PredictionDetailPage) },
      { path: 'models', title: 'AI Models', canActivate: [adminGuard], loadComponent: () => import('./pages/models').then(m => m.ModelsPage) },
      { path: 'models/:id', title: 'AI Model', canActivate: [adminGuard], loadComponent: () => import('./pages/model-detail').then(m => m.ModelDetailPage) },
      { path: 'providers', title: 'Providers', canActivate: [adminGuard], loadComponent: () => import('./pages/providers').then(m => m.ProvidersPage) },
      { path: 'reports', title: 'Reports', canActivate: [adminGuard], loadComponent: () => import('./pages/reports').then(m => m.ReportsPage) },
      { path: 'parlays', title: 'Parlays', loadComponent: () => import('./pages/parlays').then(m => m.ParlaysPage) },
      { path: 'account', title: 'Account Management', loadComponent: () => import('./pages/account').then(m => m.AccountPage) },
      { path: 'prompts', title: 'Prompt Notes', canActivate: [adminGuard], loadComponent: () => import('./pages/prompts').then(m => m.PromptsPage),
        canDeactivate: [(page: { canLeave(): boolean | Promise<boolean> }) => page.canLeave()] },
      { path: 'import', title: 'Import prediction', canActivate: [adminGuard], loadComponent: () => import('./pages/import').then(m => m.ImportPage) },
      { path: 'visitors', title: 'Visitors', canActivate: [adminGuard], loadComponent: () => import('./pages/visitors').then(m => m.VisitorsPage) },
      { path: 'api-logs', title: 'API Logs', canActivate: [adminGuard], loadComponent: () => import('./pages/api-logs').then(m => m.ApiLogsPage) },
      { path: 'activity', title: 'Activity', loadComponent: () => import('./pages/activity').then(m => m.ActivityPage) },
      { path: 'settings', title: 'Settings', loadComponent: () => import('./pages/settings').then(m => m.SettingsPage) },
      // Signed-in unknown URL: a 404 inside the shell. Signed out, the parent's authGuard sends it to login first.
      { path: '**', title: 'Page not found', component: NotFoundPage },
    ],
  },
];
