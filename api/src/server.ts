// src/server.ts
import express             from 'express';
import helmet              from 'helmet';
import cookieParser        from 'cookie-parser';
import {
    corsMiddleware, defaultRateLimiter,
    requestIdMiddleware, requestLogger,
    errorHandler, notFoundHandler,
} from './middleware/index';
import routes              from './routes/index';
import { config }          from './config';
import { logger }          from './config/logger';
import { checkConnection } from './config/database';

async function main(): Promise<void> {
    logger.info('Starting SSO Auth Server...', { env: config.env, algorithm: config.jwt.algorithm });

    const dbOk = await checkConnection();
    if (!dbOk) { logger.error('Cannot connect to database — exiting'); process.exit(1); }
    logger.info('Database connected');

    const app = express();

    // Security headers
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"], scriptSrc: ["'self'"],
                styleSrc:   ["'self'", "'unsafe-inline'"], imgSrc: ["'self'", 'data:'],
                connectSrc: ["'self'"], frameSrc: ["'none'"], objectSrc: ["'none'"],
                upgradeInsecureRequests: [],
            },
        },
        hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
        frameguard: { action: 'deny' },
    }));

    app.set('trust proxy', 1);
    app.use(corsMiddleware);
    app.options('*', corsMiddleware);
    app.use(express.json({ limit: '512kb' }));
    app.use(express.urlencoded({ extended: true, limit: '512kb' }));
    app.use(cookieParser(config.cookie.secret));
    app.use(requestIdMiddleware);
    app.use(defaultRateLimiter);
    app.use(requestLogger);
    app.use('/', routes);
    app.use(notFoundHandler);
    app.use(errorHandler);

    const server = app.listen(config.port, config.host, () => {
        logger.info(`SSO Server running on http://${config.host}:${config.port}`);
    });

    const shutdown = (signal: string) => {
        logger.info(`${signal} received — shutting down`);
        server.close(() => { logger.info('Server closed'); process.exit(0); });
        setTimeout(() => process.exit(1), 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT',  () => shutdown('SIGINT'));
    process.on('uncaughtException',  (e) => { logger.error('Uncaught exception', { error: e.message }); process.exit(1); });
    process.on('unhandledRejection', (r) => { logger.error('Unhandled rejection', { reason: String(r) }); process.exit(1); });
}

main().catch(err => { console.error('Startup failed:', err); process.exit(1); });
