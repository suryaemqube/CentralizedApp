// src/routes/index.ts
import { Router, Request, Response } from 'express';
import { loginRateLimiter, tokenRateLimiter } from '../middleware/index';
import {
    authorizeHandler, loginHandler, tokenHandler,
    logoutHandler, userInfoHandler, openIdConfigHandler, jwksHandler,
} from '../controllers/auth.controller';
import {
    getUsersHandler, createUserHandler, updateUserHandler,
    getParametersHandler, getApplicationsHandler,
} from '../controllers/user.controller';
import { checkConnection } from '../config/database';

const router = Router();

router.get('/', openIdConfigHandler);

// ── OpenID Connect discovery ──────────────────────────────────────────────────
router.get('/.well-known/openid-configuration', openIdConfigHandler);
router.get('/.well-known/jwks.json',            jwksHandler);

// ── OAuth2 / SSO ──────────────────────────────────────────────────────────────
router.get ('/sso/authorize',  authorizeHandler);
router.post('/sso/login',      loginRateLimiter, loginHandler);
router.post('/sso/token',      tokenRateLimiter, tokenHandler);
router.post('/sso/logout',     logoutHandler);
router.get ('/userinfo',       userInfoHandler);

// ── User management API (admin only — token checked inside handler) ────────────
router.get ('/api/users',             getUsersHandler);
router.post('/api/users',             createUserHandler);
router.put ('/api/users/:userId',     updateUserHandler);

// ── Lookup data ───────────────────────────────────────────────────────────────
router.get('/api/parameters/:type',  getParametersHandler);
router.get('/api/applications',      getApplicationsHandler);

// ── Health ────────────────────────────────────────────────────────────────────
router.get('/health', async (_req: Request, res: Response) => {
    const dbOk = await checkConnection();
    res.status(dbOk ? 200 : 503).json({
        status:    dbOk ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        db:        dbOk ? 'ok' : 'error',
    });
});

export default router;
