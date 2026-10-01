import {inject} from '@angular/core';
import {CanActivateFn, Router} from '@angular/router';
import {AuthStore} from './auth.store';

/** Any signed-in user; anonymous visitors go to /login and come back to where they were headed. */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthStore);
  if (auth.isLoggedIn()) return true;
  return inject(Router).createUrlTree(['/login'], {queryParams: {returnUrl: state.url}});
};

/** Back-office only. Customers hitting /admin are redirected home. */
export const adminGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthStore);
  const router = inject(Router);
  if (!auth.isLoggedIn()) return router.createUrlTree(['/login'], {queryParams: {returnUrl: state.url}});
  return auth.isBackoffice() ? true : router.createUrlTree(['/']);
};

/** Only the admin role may configure branch themes. */
export const adminOnlyGuard: CanActivateFn = () => {
  const auth = inject(AuthStore);
  return auth.user()?.role === 'admin' ? true : inject(Router).createUrlTree(['/admin']);
};
