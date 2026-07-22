import { inject } from '@angular/core';import { CanActivateFn, Router } from '@angular/router';import { catchError, map, of } from 'rxjs';import { AuthStore } from '../auth/auth.store';
export const authGuard:CanActivateFn=()=>{const a=inject(AuthStore),router=inject(Router);if(a.authenticated())return true;return a.refresh().pipe(map(()=>true),catchError(()=>of(router.createUrlTree(['/login']))));};
export const adminGuard:CanActivateFn=()=>inject(AuthStore).admin()||inject(Router).createUrlTree(['/app']);

