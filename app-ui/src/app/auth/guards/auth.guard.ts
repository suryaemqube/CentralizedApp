import { CanActivateFn, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { inject }                   from '@angular/core';
import { AuthService }              from '../../auth/services/auth.service';

export const authGuard: CanActivateFn = (_r, state: RouterStateSnapshot) => {
    const auth   = inject(AuthService);
    const router = inject(Router);
    if (auth.isLoggedIn()) return true;
    void auth.initiateLogin(state.url);
    return router.createUrlTree(['/login']);
};

export const noAuthGuard: CanActivateFn = () => {
    const auth   = inject(AuthService);
    const router = inject(Router);
    return auth.isLoggedIn() ? router.createUrlTree(['/dashboard']) : true;
};

export function roleGuard(...roles: string[]): CanActivateFn {
    return () => {
        const auth   = inject(AuthService);
        const router = inject(Router);
        if (!auth.isLoggedIn()) { void auth.initiateLogin(); return false; }
        return auth.hasRole(...roles) ? true : router.createUrlTree(['/unauthorized']);
    };
}
