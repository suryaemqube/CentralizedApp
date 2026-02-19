// src/app/auth/interceptors/auth.interceptor.ts
import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject }                               from '@angular/core';
import { throwError }                           from 'rxjs';
import { catchError, switchMap }                from 'rxjs/operators';
import { AuthService }                          from '../services/auth.service';
import { environment }                          from '../../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const auth = inject(AuthService);

    // Skip the auth server itself
    if (req.url.startsWith(environment.authServerUrl)) return next(req);

    const token   = auth.getAccessToken();
    const authReq = token
        ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` }, withCredentials: true })
        : req;

    return next(authReq).pipe(
        catchError((err: HttpErrorResponse) => {
            if (err.status === 401 && !req.headers.has('X-Retry')) {
                return auth.refreshToken().pipe(
                    switchMap(newToken =>
                        next(req.clone({
                            setHeaders: { Authorization: `Bearer ${newToken}`, 'X-Retry': 'true' },
                            withCredentials: true,
                        }))
                    ),
                    catchError(refreshErr => throwError(() => refreshErr as Error))
                );
            }
            return throwError(() => err);
        })
    );
};
