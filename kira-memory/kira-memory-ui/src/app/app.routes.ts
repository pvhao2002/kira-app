import {Routes} from '@angular/router';
import {adminGuard, authGuard, guestGuard} from './core/auth';

export const routes: Routes = [
  {path: 'dang-nhap', canActivate: [guestGuard], loadComponent: () => import('./features/login/login.page').then(m => m.LoginPage)},
  {path: 'cai-dat', canActivate: [authGuard, adminGuard], loadComponent: () => import('./features/settings/settings.page').then(m => m.SettingsPage)},
  {path: '', canActivate: [authGuard], loadComponent: () => import('./features/gallery/gallery.page').then(m => m.GalleryPage)},
  {path: '**', redirectTo: ''}
];
