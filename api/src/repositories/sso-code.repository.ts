// src/repositories/sso-code.repository.ts
import { callSP } from '../config/database';
import { ValidateSsoCodeRow } from '../models/entities';

export class SsoCodeRepository {

    async generate(
        code: string,
        userId: number,
        appId: number,
        scope: string,
        codeChallenge?: string,
        challengeMethod?: string
    ): Promise<{ success: boolean; message: string }> {
        const rows = await callSP<{ out_success: boolean; out_message: string }>(
            'usp_GenerateSsoCode',
            [code, userId, appId, scope, codeChallenge ?? null, challengeMethod ?? null]
        );
        return { success: rows[0].out_success, message: rows[0].out_message };
    }

    async validate(
        code: string,
        clientId: string
    ): Promise<ValidateSsoCodeRow | null> {
        const rows = await callSP<ValidateSsoCodeRow>('usp_ValidateSsoCode', [code, clientId]);
        return rows[0] ?? null;
    }
}

export const ssoCodeRepository = new SsoCodeRepository();
