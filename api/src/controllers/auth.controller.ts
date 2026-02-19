// src/controllers/auth.controller.ts
import { Request, Response } from 'express';
import { z }                 from 'zod';
import { authService }       from '../services/auth.service';
import { jwtService }        from '../services/jwt.service';
import { userRepository }    from '../repositories/user.repository';
import { config }            from '../config';
import { logger }            from '../config/logger';

// ── Validation schemas ────────────────────────────────────────────────────────
const authorizeSchema = z.object({
    response_type:         z.literal('code'),
    client_id:             z.string().min(1),
    scope:                 z.string().default('openid profile email roles apps'),
    state:                 z.string().min(1),
    code_challenge:        z.string().optional(),
    code_challenge_method: z.enum(['S256', 'plain']).optional(),
});

const loginSchema = z.object({
    username: z.string().min(1),
    password: z.string().min(1),
    state:    z.string().min(1),
});

const tokenSchema = z.object({
    grant_type:    z.enum(['authorization_code', 'refresh_token']),
    client_id:     z.string().min(1),
    client_secret: z.string().min(1),
    code:          z.string().optional(),
    refresh_token: z.string().optional(),
    code_verifier: z.string().optional(),
});

function ip(req: Request): string {
    return (req.headers['x-forwarded-for'] as string || '').split(',')[0]?.trim()
        || req.socket?.remoteAddress || '';
}

// ── GET /sso/authorize ────────────────────────────────────────────────────────
export async function authorizeHandler(req: Request, res: Response): Promise<void> {
    const parsed = authorizeSchema.safeParse(req.query);
    if (!parsed.success) {
        res.status(400).json({ error: 'invalid_request', details: parsed.error.flatten() });
        return;
    }
    const q = parsed.data;

    const clientCheck = await authService.validateClient(q.client_id);
    if (!clientCheck.valid) {
        res.status(400).json({ error: 'invalid_client', error_description: 'Unknown client_id' });
        return;
    }

    // Store OAuth params in signed session cookie
    res.cookie('oauth_params', JSON.stringify({
        client_id:             q.client_id,
        scope:                 q.scope,
        state:                 q.state,
        code_challenge:        q.code_challenge,
        code_challenge_method: q.code_challenge_method,
    }), {
        httpOnly: true, secure: config.cookie.secure,
        sameSite: (config.cookie.sameSite as string).toLowerCase() as 'lax' | 'strict' | 'none', maxAge: 5 * 60 * 1000, signed: true,
    });

    // Tell Angular which app is requesting + what state to pass back
    res.status(200).json({
        action:    'login_required',
        app_name:  clientCheck.appName,
        client_id: q.client_id,
        state:     q.state,
    });
}

// ── POST /sso/login ───────────────────────────────────────────────────────────
export async function loginHandler(req: Request, res: Response): Promise<void> {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: 'invalid_request' }); return;
    }
    const { username, password, state } = parsed.data;

    const oauthRaw = req.signedCookies?.oauth_params as string | undefined;
    if (!oauthRaw) {
        res.status(400).json({ error: 'invalid_request', error_description: 'OAuth session expired. Please try again.' });
        return;
    }

    let params: { client_id: string; scope: string; state: string; code_challenge?: string; code_challenge_method?: string };
    try { params = JSON.parse(oauthRaw) as typeof params; }
    catch { res.status(400).json({ error: 'invalid_session' }); return; }

    if (params.state !== state) {
        res.status(400).json({ error: 'state_mismatch', error_description: 'Possible CSRF attack' });
        return;
    }

    const auth = await authService.validateCredentials(username, password);
    if (!auth.valid) {
        res.status(401).json({ error: 'invalid_credentials', error_description: auth.message });
        return;
    }

    const code = await authService.generateAuthCode(
        auth.userId!, params.client_id, params.scope,
        params.code_challenge, params.code_challenge_method
    );

    if (!code) {
        res.status(403).json({ error: 'access_denied', error_description: 'User is not authorized for this application' });
        return;
    }

    res.clearCookie('oauth_params');

    // Look up the app's redirect URL
    const app = await (await import('../repositories/application.repository')).applicationRepository.findByClientId(params.client_id);
    const redirectUri = app?.appUrl || '';

    logger.info('Login OK, code issued', { userId: auth.userId, clientId: params.client_id });

    // Return the redirect URL; Angular does window.location.href
    res.status(200).json({
        redirect_url: `${redirectUri}/auth/callback?code=${code}&state=${params.state}`,
    });
}

// ── POST /sso/token ───────────────────────────────────────────────────────────
export async function tokenHandler(req: Request, res: Response): Promise<void> {
    const parsed = tokenSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: 'invalid_request' }); return;
    }
    const body = parsed.data;

    // ── authorization_code grant
    if (body.grant_type === 'authorization_code') {
        if (!body.code) {
            res.status(400).json({ error: 'invalid_request', error_description: 'code is required' }); return;
        }
        const tokens = await authService.exchangeCode(
            body.code, body.client_id, body.client_secret, body.code_verifier
        );
        if (!tokens) {
            res.status(400).json({ error: 'invalid_grant', error_description: 'Code invalid or expired' }); return;
        }
        setRefreshCookie(res, tokens.refresh_token);
        logger.info('Token issued (code exchange)', { clientId: body.client_id });
        res.status(200).json({
            access_token: tokens.access_token,
            token_type:   tokens.token_type,
            expires_in:   tokens.expires_in,
            scope:        tokens.scope,
        });
        return;
    }

    // ── refresh_token grant
    if (body.grant_type === 'refresh_token') {
        const rawToken = (req.cookies?.refresh_token as string | undefined) || body.refresh_token;
        if (!rawToken) {
            res.status(400).json({ error: 'invalid_request', error_description: 'refresh_token required' }); return;
        }
        const tokens = await authService.refreshTokens(
            rawToken, body.client_id, body.client_secret, ip(req), req.headers['user-agent']
        );
        if (!tokens) {
            res.clearCookie('refresh_token');
            res.status(400).json({ error: 'invalid_grant', error_description: 'Refresh token invalid or revoked' }); return;
        }
        if (tokens.refresh_token) {
            setRefreshCookie(res, tokens.refresh_token);
        }
        logger.info('Token refreshed', { clientId: body.client_id });
        res.status(200).json({
            access_token: tokens.access_token,
            token_type:   tokens.token_type,
            expires_in:   tokens.expires_in,
            scope:        tokens.scope,
        });
        return;
    }

    res.status(400).json({ error: 'unsupported_grant_type' });
}

// ── POST /sso/logout ──────────────────────────────────────────────────────────
export async function logoutHandler(req: Request, res: Response): Promise<void> {
    const raw = req.cookies?.refresh_token as string | undefined;
    if (raw) {
        try { await authService.logout(raw, req.body?.logout_all === true); }
        catch (e) { logger.warn('Logout token revoke error', { error: (e as Error).message }); }
    }
    res.clearCookie('refresh_token');
    res.status(200).json({ message: 'Logged out' });
}

// ── GET /userinfo ─────────────────────────────────────────────────────────────
export async function userInfoHandler(req: Request, res: Response): Promise<void> {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) { res.status(401).json({ error: 'unauthorized' }); return; }

    try {
        const payload = jwtService.verify(auth.slice(7));
        const user    = await userRepository.getUserById(parseInt(payload.sub, 10));
        if (!user || !user.out_isactive) { res.status(401).json({ error: 'user_inactive' }); return; }

        res.status(200).json({
            sub:       payload.sub,
            username:  user.out_username,
            email:     user.out_email,
            firstName: user.out_firstname,
            lastName:  user.out_lastname,
            role:      user.out_rolename,
            appIds:    JSON.parse(user.out_appids   || '[]') as number[],
            appNames:  JSON.parse(user.out_appnames || '[]') as string[],
        });
    } catch { res.status(401).json({ error: 'invalid_token' }); }
}

// ── GET /.well-known/openid-configuration ─────────────────────────────────────
export function openIdConfigHandler(req: Request, res: Response): void {
    const base = `${req.protocol}://${req.get('host')}`;
    res.status(200).json({
        issuer:                                base,
        authorization_endpoint:               `${base}/sso/authorize`,
        token_endpoint:                        `${base}/sso/token`,
        userinfo_endpoint:                     `${base}/userinfo`,
        jwks_uri:                              `${base}/.well-known/jwks.json`,
        end_session_endpoint:                  `${base}/sso/logout`,
        response_types_supported:              ['code'],
        grant_types_supported:                 ['authorization_code', 'refresh_token'],
        scopes_supported:                      ['openid', 'profile', 'email', 'roles', 'apps'],
        token_endpoint_auth_methods_supported: ['client_secret_post'],
    });
}

export function jwksHandler(_req: Request, res: Response): void {
    res.status(200).json(jwtService.getJwks());
}

// ── Helper ────────────────────────────────────────────────────────────────────
function setRefreshCookie(res: Response, token: string): void {
    res.cookie('refresh_token', token, {
        httpOnly: true,
        secure:   config.cookie.secure,
        sameSite: (config.cookie.sameSite as string).toLowerCase() as 'lax' | 'strict' | 'none',
        maxAge:   config.jwt.refreshExpiry * 1000,
    });
}
