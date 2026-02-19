// src/repositories/refresh-token.repository.ts
import { callSP } from '../config/database';
import { ValidateRefreshTokenRow } from '../models/entities';

export class RefreshTokenRepository {

    async save(
        userId: number,
        appId: number,
        tokenHash: string,
        expiresAt: Date,
        ipAddress?: string,
        userAgent?: string
    ): Promise<void> {
        await callSP('usp_SaveRefreshToken', [
            userId, appId, tokenHash, expiresAt,
            ipAddress ?? null, userAgent ?? null,
        ]);
    }

    async validateAndRotate(tokenHash: string): Promise<ValidateRefreshTokenRow | null> {
        const rows = await callSP<ValidateRefreshTokenRow>(
            'usp_ValidateAndRotateRefreshToken', [tokenHash]
        );
        return rows[0] ?? null;
    }

    async revoke(tokenHash: string, revokeAll = false): Promise<void> {
        await callSP('usp_RevokeRefreshToken', [tokenHash, revokeAll]);
    }
}

export const refreshTokenRepository = new RefreshTokenRepository();
