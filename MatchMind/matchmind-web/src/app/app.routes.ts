import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/http';

export const routes: Routes = [
  { path: 'login', canActivate: [guestGuard], title: 'Sign in · MatchMind', loadComponent: () => import('./pages/login').then(m => m.LoginPage) },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell').then(m => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', title: 'Dashboard · MatchMind', loadComponent: () => import('./pages/dashboard').then(m => m.DashboardPage) },
      { path: 'matches', title: 'Matches · MatchMind', loadComponent: () => import('./pages/matches').then(m => m.MatchesPage) },
      { path: 'matches/:id', title: 'Match · MatchMind', loadComponent: () => import('./pages/match-detail').then(m => m.MatchDetailPage) },
      { path: 'predictions', title: 'Predictions · MatchMind', loadComponent: () => import('./pages/predictions').then(m => m.PredictionsPage) },
      { path: 'predictions/:id', title: 'Prediction · MatchMind', loadComponent: () => import('./pages/prediction-detail').then(m => m.PredictionDetailPage) },
      { path: 'models', title: 'AI Models · MatchMind', loadComponent: () => import('./pages/models').then(m => m.ModelsPage) },
      { path: 'models/:id', title: 'AI Model · MatchMind', loadComponent: () => import('./pages/model-detail').then(m => m.ModelDetailPage) },
      { path: 'reports', title: 'Reports · MatchMind', loadComponent: () => import('./pages/reports').then(m => m.ReportsPage) },
      { path: 'prompts', title: 'Prompt Notes · MatchMind', loadComponent: () => import('./pages/prompts').then(m => m.PromptsPage),
        canDeactivate: [(page: { canLeave(): boolean }) => page.canLeave()] },
      { path: 'import', title: 'Import prediction · MatchMind', loadComponent: () => import('./pages/import').then(m => m.ImportPage) },
      { path: 'api-logs', title: 'API Logs · MatchMind', loadComponent: () => import('./pages/api-logs').then(m => m.ApiLogsPage) },
      { path: 'settings', title: 'Settings · MatchMind', loadComponent: () => import('./pages/settings').then(m => m.SettingsPage) },
    ],
  },
  { path: '**', redirectTo: '' },
];

