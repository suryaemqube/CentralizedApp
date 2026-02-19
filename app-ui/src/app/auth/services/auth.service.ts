// src/app/auth/services/auth.service.ts
import { Injectable, signal, computed } from '@angular/core';
import { HttpClient, HttpParams }        from '@angular/common/http';
import { Router }                        from '@angular/router';
import { Observable, throwError, BehaviorSubject, timer, Subscription } from 'rxjs';
import { tap, catchError, switchMap }    from 'rxjs/operators';
import { environment }                   from '../../../environments/environment';
import { JwtPayload, TokenResponse, AuthState } from '../models/auth.models';

@Injectable({ providedIn: 'root' })
export class AuthService {

    // Access token lives in memory only — never localStorage
    private _state = signal<AuthState>({
        isAuthenticated: false, accessToken: null, user: null, expiresAt: null,
    });

    readonly state          = this._state.asReadonly();
    readonly isLoggedIn     = computed(() => this._state().isAuthenticated);
    readonly currentUser    = computed(() => this._state().user);
    readonly accessToken    = computed(() => this._state().accessToken);

    private refreshSub:    Subscription | null = null;
    private refreshing     = false;
    private refreshSubject = new BehaviorSubject<string | null>(null);

    constructor(private http: HttpClient, private router: Router) {}

    // ── PKCE helpers ──────────────────────────────────────────────────────────
    private randomString(n = 64): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
        const arr   = new Uint8Array(n);
        crypto.getRandomValues(arr);
        return Array.from(arr).map(b => chars[b % chars.length]).join('');
    }

    private async challenge(verifier: string): Promise<string> {
        const data   = new TextEncoder().encode(verifier);
        const digest = await crypto.subtle.digest('SHA-256', data);
        return btoa(String.fromCharCode(...Array.from(new Uint8Array(digest))))
            .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }

    // ── Initiate login ────────────────────────────────────────────────────────
    async initiateLogin(targetUrl?: string): Promise<void> {
        const state    = this.randomString(32);
        const verifier = this.randomString(64);
        const chall    = await this.challenge(verifier);

        sessionStorage.setItem('oauth_state',    state);
        sessionStorage.setItem('oauth_verifier', verifier);
        if (targetUrl) sessionStorage.setItem('oauth_target', targetUrl);

        const params = new HttpParams()
            .set('response_type',         'code')
            .set('client_id',             environment.clientId)
            .set('scope',                 environment.scopes)
            .set('state',                 state)
            .set('code_challenge',        chall)
            .set('code_challenge_method', 'S256');

        window.location.href = `${environment.authServerUrl}/sso/authorize?${params.toString()}`;
    }

    // ── Handle callback ───────────────────────────────────────────────────────
    handleCallback(code: string, state: string): Observable<void> {
        const storedState  = sessionStorage.getItem('oauth_state');
        const verifier     = sessionStorage.getItem('oauth_verifier');
        if (!storedState || storedState !== state) {
            return throwError(() => new Error('State mismatch — possible CSRF'));
        }
        sessionStorage.removeItem('oauth_state');
        sessionStorage.removeItem('oauth_verifier');

        const body = new HttpParams()
            .set('grant_type',    'authorization_code')
            .set('code',          code)
            .set('client_id',     environment.clientId)
            .set('client_secret', environment.clientSecret)
            .set('code_verifier', verifier || '');

        return this.http.post<TokenResponse>(
            `${environment.authServerUrl}/sso/token`,
            body.toString(),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, withCredentials: true }
        ).pipe(
            tap(r => {
                this.handleTokenResponse(r);
                const target = sessionStorage.getItem('oauth_target') || '/dashboard';
                sessionStorage.removeItem('oauth_target');
                void this.router.navigateByUrl(target);
            }),
            switchMap(() => new Observable<void>(obs => { obs.next(); obs.complete(); })),
            catchError(err => throwError(() => err as Error))
        );
    }

    // ── Silent token refresh ──────────────────────────────────────────────────
    refreshToken(): Observable<string> {
        if (this.refreshing) {
            return new Observable<string>(obs => {
                const sub = this.refreshSubject.subscribe({
                    next:  t => { if (t) { obs.next(t); obs.complete(); } else obs.error(new Error('Refresh failed')); sub.unsubscribe(); },
                    error: e => obs.error(e as Error),
                });
            });
        }
        this.refreshing = true;
        this.refreshSubject.next(null);

        const body = new HttpParams()
            .set('grant_type',    'refresh_token')
            .set('client_id',     environment.clientId)
            .set('client_secret', environment.clientSecret);

        return this.http.post<TokenResponse>(
            `${environment.authServerUrl}/sso/token`,
            body.toString(),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, withCredentials: true }
        ).pipe(
            tap(r => { this.handleTokenResponse(r); this.refreshing = false; this.refreshSubject.next(r.access_token); }),
            catchError(err => {
                this.refreshing = false; this.refreshSubject.next(null);
                this.clearState(); void this.router.navigate(['/login']);
                return throwError(() => err as Error);
            }),
            switchMap(r => new Observable<string>(obs => { obs.next(r.access_token); obs.complete(); }))
        );
    }

    logout(logoutAll = false): void {
        this.http.post(
            `${environment.authServerUrl}/sso/logout`,
            { logout_all: logoutAll },
            { withCredentials: true }
        ).subscribe({ complete: () => this.doLocalLogout(), error: () => this.doLocalLogout() });
    }

    private doLocalLogout(): void { this.clearState(); void this.router.navigate(['/login']); }

    hasRole(...roles: string[]): boolean {
        const r = this._state().user?.role;
        return r ? roles.includes(r) : false;
    }

    hasAppAccess(appName: string): boolean {
        return this._state().user?.appNames.includes(appName) ?? false;
    }

    getAccessToken(): string | null { return this._state().accessToken; }
    isTokenExpired(): boolean {
        const exp = this._state().expiresAt;
        return !exp || Date.now() >= exp - 5000;
    }

    private handleTokenResponse(r: TokenResponse): void {
        const p = this.parseJwt(r.access_token);
        if (!p) throw new Error('Invalid access token');
        this._state.set({ isAuthenticated: true, accessToken: r.access_token, user: p, expiresAt: p.exp * 1000 });
        this.scheduleRefresh(r.expires_in);
    }

    private scheduleRefresh(expiresIn: number): void {
        this.cancelRefresh();
        const delay = Math.max((expiresIn - environment.tokenRefreshBuffer) * 1000, 1000);
        this.refreshSub = timer(delay).pipe(switchMap(() => this.refreshToken()))
            .subscribe({ error: e => console.error('Scheduled refresh failed:', e) });
    }

    cancelRefresh(): void { this.refreshSub?.unsubscribe(); this.refreshSub = null; }

    private clearState(): void {
        this.cancelRefresh();
        this._state.set({ isAuthenticated: false, accessToken: null, user: null, expiresAt: null });
    }

    private parseJwt(token: string): JwtPayload | null {
        try {
            const p = token.split('.');
            if (p.length !== 3) return null;
            return JSON.parse(atob(p[1].replace(/-/g, '+').replace(/_/g, '/'))) as JwtPayload;
        } catch { return null; }
    }
}
