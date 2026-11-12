import {Routes} from '@angular/router';

export const routes: Routes = [
  {path: '', loadComponent: () => import('./features/jobs/jobs.page').then(m => m.JobsPage), title: 'PDF export - Kira Tool'},
  {path: '**', redirectTo: ''}
];
