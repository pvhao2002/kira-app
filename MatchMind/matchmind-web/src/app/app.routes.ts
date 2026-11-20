import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/http';

export const routes: Routes = [
  { path: 'login', canActivate: [guestGuard], title: 'Sign in', loadComponent: () => import('./pages/login').then(m => m.LoginPage) },
  {
    path: '',
    canActivate: [authGuard],
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
      { path: 'reports', title: 'Reports', loadComponent: () => import('./pages/reports').then(m => m.ReportsPage) },
      { path: 'prompts', title: 'Prompt Notes', loadComponent: () => import('./pages/prompts').then(m => m.PromptsPage),
        canDeactivate: [(page: { canLeave(): boolean | Promise<boolean> }) => page.canLeave()] },
      { path: 'import', title: 'Import prediction', loadComponent: () => import('./pages/import').then(m => m.ImportPage) },
      { path: 'api-logs', title: 'API Logs', loadComponent: () => import('./pages/api-logs').then(m => m.ApiLogsPage) },
      { path: 'settings', title: 'Settings', loadComponent: () => import('./pages/settings').then(m => m.SettingsPage) },
    ],
  },
  { path: '**', redirectTo: '' },
];

