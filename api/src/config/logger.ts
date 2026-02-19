// src/config/logger.ts
import winston from 'winston';
import path from 'path';
import fs from 'fs';
import { config } from './index';

const logDir = path.dirname(config.log.file);
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

export const logger = winston.createLogger({
    level: config.log.level,
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: config.log.file, maxsize: 10_485_760, maxFiles: 5 }),
        new winston.transports.File({ filename: config.log.file.replace('.log', '-error.log'), level: 'error' }),
    ],
});

if (config.env !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        ),
    }));
}
