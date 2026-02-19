// src/services/jwt.service.ts
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config';
import { JwtPayload } from '../models/entities';
import { logger } from '../config/logger';

export class JwtService {
    readonly algorithm: 'RS256' | 'HS256';

    constructor() {
        this.algorithm = config.jwt.algorithm;
        logger.info(`JWT algorithm: ${this.algorithm}`);
    }

    private signingKey(): string | Buffer {
        if (this.algorithm === 'RS256' && config.jwt.privateKey)
            return config.jwt.privateKey;
        if (config.jwt.secret) return config.jwt.secret;
        throw new Error('No JWT signing key configured');
    }

    private verifyKey(): string | Buffer {
        if (this.algorithm === 'RS256' && config.jwt.publicKey)
            return config.jwt.publicKey;
        if (config.jwt.secret) return config.jwt.secret;
        throw new Error('No JWT verify key configured');
    }

    generateAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp' | 'jti'>): string {
        const jti = crypto.randomBytes(16).toString('hex');
        return jwt.sign(
            { ...payload, jti },
            this.signingKey(),
            { algorithm: this.algorithm, expiresIn: config.jwt.accessExpiry } as jwt.SignOptions
        );
    }

    generateRefreshToken(): string {
        return crypto.randomBytes(64).toString('hex');
    }

    hashToken(token: string): string {
        return crypto.createHash('sha256').update(token).digest('hex');
    }

    generateCode(): string {
        return crypto.randomBytes(48).toString('hex');
    }

    verify(token: string): JwtPayload {
        return jwt.verify(token, this.verifyKey(), {
            algorithms: [this.algorithm],
        }) as JwtPayload;
    }

    decode(token: string): JwtPayload | null {
        try { return jwt.decode(token) as JwtPayload; }
        catch { return null; }
    }

    getPublicKey(): string | null {
        return config.jwt.publicKey;
    }

    getJwks(): object {
        return { keys: config.jwt.algorithm === 'RS256'
            ? [{ kty: 'RSA', use: 'sig', alg: 'RS256', kid: 'sso-key-1' }]
            : []
        };
    }
}

export const jwtService = new JwtService();
