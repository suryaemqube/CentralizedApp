// src/config/index.ts
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

function loadKey(filePath: string): string | null {
    try {
        const resolved = path.resolve(filePath);
        return fs.existsSync(resolved) ? fs.readFileSync(resolved, 'utf8') : null;
    } catch { return null; }
}

const privateKey = loadKey(process.env.JWT_PRIVATE_KEY_PATH || './certs/private.key');
const publicKey  = loadKey(process.env.JWT_PUBLIC_KEY_PATH  || './certs/public.key');

export const config = {
    env:  process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || '0.0.0.0',

    db: {
        host:     process.env.DB_HOST     || 'localhost',
        port:     parseInt(process.env.DB_PORT || '5432', 10),
        database: process.env.DB_NAME     || 'postgres',
        user:     process.env.DB_USER     || 'postgres',
        password: process.env.DB_PASSWORD || 'Emqube@123',
        min:      parseInt(process.env.DB_POOL_MIN || '2', 10),
        max:      parseInt(process.env.DB_POOL_MAX || '10', 10),
    },

    jwt: {
        algorithm:     (privateKey && publicKey ? 'RS256' : 'HS256') as 'RS256' | 'HS256',
        privateKey,
        publicKey,
        secret:        process.env.JWT_SECRET || '',
        accessExpiry:  parseInt(process.env.ACCESS_TOKEN_EXPIRY  || '900',     10),
        refreshExpiry: parseInt(process.env.REFRESH_TOKEN_EXPIRY || '2592000', 10),
    },

    cookie: {
        secret:   process.env.COOKIE_SECRET || 'fallback-secret',
        secure:   process.env.COOKIE_SECURE !== 'false',
        sameSite: (process.env.COOKIE_SAMESITE || 'None') as 'None' | 'Lax' | 'Strict',
    },

    cors: {
        origins: (process.env.CORS_ORIGINS || '')
            .split(',').map(s => s.trim()).filter(Boolean),
    },

    rateLimit: {
        windowMs:  parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
        max:       parseInt(process.env.RATE_LIMIT_MAX       || '100',    10),
        loginMax:  parseInt(process.env.LOGIN_RATE_LIMIT_MAX || '20',     10),
    },

    email: {
        host:    process.env.SMTP_HOST   || '',
        port:    parseInt(process.env.SMTP_PORT || '587', 10),
        secure:  process.env.SMTP_SECURE === 'true',
        user:    process.env.SMTP_USER   || '',
        pass:    process.env.SMTP_PASS   || '',
        hrEmail: process.env.HR_EMAIL    || '',
        from:    process.env.FROM_NAME   || 'SSO System',
    },

    baseUrl: process.env.BASE_URL || 'http://localhost:3000',
    log: {
        level: process.env.LOG_LEVEL || 'info',
        file:  process.env.LOG_FILE  || './logs/sso.log',
    },
} as const;
