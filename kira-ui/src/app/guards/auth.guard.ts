import {CanActivateFn, Router} from '@angular/router';
import {inject} from '@angular/core';
import {AuthService} from '../config/AuthService';
import {catchError, map, of} from 'rxjs';

export const authGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.checkSession().pipe(
    map((authenticated) => {
      if (authenticated) {
        return true;
      }

      return router.createUrlTree(['/login'], {
        queryParams: {returnUrl: state.url}
      });
    }),
    catchError(() => of(router.createUrlTree(['/login'], {
      queryParams: {returnUrl: state.url}
    })))
  );
};
