// src/middleware/index.ts
import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import cors      from 'cors';
import crypto    from 'crypto';
import { config } from '../config';
import { logger } from '../config/logger';

// ── CORS ──────────────────────────────────────────────────────────────────────
export const corsMiddleware = cors({
    origin: (origin, cb) => {
        if (!origin || config.cors.origins.includes(origin)) { cb(null, true); return; }
        logger.warn('CORS blocked', { origin });
        cb(new Error(`Origin ${origin} not allowed`));
    },
    credentials:    true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token'],
    methods:        ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    maxAge:         86400,
});

// ── Rate limiters ─────────────────────────────────────────────────────────────
export const defaultRateLimiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max:      config.rateLimit.max,
    standardHeaders: true, legacyHeaders: false,
    message:  { error: 'too_many_requests' },
});

export const loginRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max:      config.rateLimit.loginMax,
    standardHeaders: true, legacyHeaders: false,
    keyGenerator: (req) =>
        (req.headers['x-forwarded-for'] as string || '').split(',')[0]?.trim() ||
        req.socket?.remoteAddress || 'unknown',
    message: { error: 'too_many_login_attempts', error_description: 'Too many login attempts. Try again in 15 minutes.' },
});

export const tokenRateLimiter = rateLimit({
    windowMs: 60 * 1000, max: 30,
    standardHeaders: true, legacyHeaders: false,
});

// ── Request ID ────────────────────────────────────────────────────────────────
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
    const id = crypto.randomBytes(8).toString('hex');
    req.headers['x-request-id'] = id;
    res.setHeader('X-Request-Id', id);
    next();
}

// ── Request logger ─────────────────────────────────────────────────────────────
export function requestLogger(req: Request, _res: Response, next: NextFunction): void {
    logger.info('Request', {
        method: req.method, path: req.path,
        ip:     req.ip,
        reqId:  req.headers['x-request-id'],
    });
    next();
}

// ── Error handler ─────────────────────────────────────────────────────────────
export function errorHandler(err: Error & { statusCode?: number }, _req: Request, res: Response, _next: NextFunction): void {
    logger.error('Unhandled error', { message: err.message, stack: err.stack });
    res.status(err.statusCode || 500).json({ error: 'server_error', message: 'An unexpected error occurred' });
}

export function notFoundHandler(_req: Request, res: Response): void {
    res.status(404).json({ error: 'not_found' });
}
