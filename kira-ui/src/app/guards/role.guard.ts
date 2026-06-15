import {CanActivateFn, Router} from '@angular/router';
import {inject} from '@angular/core';
import {catchError, map, of} from 'rxjs';
import {AuthService} from '../config/AuthService';
import {AppRole} from '../config/nav.config';

export const roleGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const allowedRoles = route.data['roles'] as AppRole[] | undefined;

  if (!allowedRoles?.length) {
    return true;
  }

  return authService.checkSession().pipe(
    map((authenticated) => {
      if (!authenticated) {
        return router.createUrlTree(['/']);
      }
      if (authService.hasRole(...allowedRoles)) {
        return true;
      }
      return router.createUrlTree(['/dashboard']);
    }),
    catchError(() => of(router.createUrlTree(['/dashboard']))),
  );
};
