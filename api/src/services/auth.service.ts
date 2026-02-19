// src/services/auth.service.ts
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { userRepository }         from '../repositories/user.repository';
import { applicationRepository }  from '../repositories/application.repository';
import { ssoCodeRepository }      from '../repositories/sso-code.repository';
import { refreshTokenRepository } from '../repositories/refresh-token.repository';
import { jwtService }             from './jwt.service';
import { config }                 from '../config';
import { logger }                 from '../config/logger';
import { TokenResponse, JwtPayload } from '../models/entities';

export class AuthService {

    // ------------------------------------------------------------------
    // Validate credentials — called from login form POST
    // ------------------------------------------------------------------
    async validateCredentials(usernameOrEmail: string, password: string): Promise<{
        valid:     boolean;
        userId?:   number;
        username?: string;
        email?:    string;
        firstName?: string;
        lastName?:  string;
        role?:     string;
        appIds?:   number[];
        appNames?: string[];
        status?:   string;
        message:   string;
    }> {
        const user = await userRepository.validateLogin(usernameOrEmail);
        if (!user) return { valid: false, message: 'Invalid credentials' };

        if (!user.out_isactive) {
            return { valid: false, message: user.out_statusvalue === 'Draft'
                ? 'Account is pending activation'
                : 'Account is inactive' };
        }

        const ok = await bcrypt.compare(password, user.out_passwordhash);
        if (!ok) return { valid: false, message: 'Invalid credentials' };

        return {
            valid:     true,
            userId:    parseInt(user.out_userid, 10),
            username:  user.out_username,
            email:     user.out_email,
            firstName: user.out_firstname,
            lastName:  user.out_lastname,
            role:      user.out_rolename,
            appIds:    JSON.parse(user.out_appids || '[]') as number[],
            appNames:  JSON.parse(user.out_appnames || '[]') as string[],
            status:    user.out_statusvalue,
            message:   'OK',
        };
    }

    // ------------------------------------------------------------------
    // Generate Authorization Code (after successful login)
    // ------------------------------------------------------------------
    async generateAuthCode(
        userId:          number,
        clientId:        string,
        scope:           string,
        codeChallenge?:  string,
        challengeMethod?: string
    ): Promise<string | null> {
        const app = await applicationRepository.findByClientId(clientId);
        if (!app || !app.isActive) return null;

        const code   = jwtService.generateCode();
        const result = await ssoCodeRepository.generate(
            code, userId, app.appId, scope, codeChallenge, challengeMethod
        );

        if (!result.success) {
            logger.warn('Code generation failed', { message: result.message, userId, clientId });
            return null;
        }
        return code;
    }

    // ------------------------------------------------------------------
    // Exchange code → tokens  (POST /sso/token, grant=authorization_code)
    // ------------------------------------------------------------------
    async exchangeCode(
        code:          string,
        clientId:      string,
        clientSecret:  string,
        codeVerifier?: string
    ): Promise<TokenResponse | null> {
        const app = await applicationRepository.findByClientId(clientId);
        if (!app || !app.isActive) {
            logger.warn('Exchange: invalid client_id', { clientId }); return null;
        }

        const secretOk = await bcrypt.compare(clientSecret, app.clientSecretHash);
        if (!secretOk) {
            logger.warn('Exchange: bad client_secret', { clientId }); return null;
        }

        const row = await ssoCodeRepository.validate(code, clientId);
        if (!row || !row.out_valid) {
            logger.warn('Exchange: invalid code', { message: row?.out_message }); return null;
        }

        // PKCE
        if (row.out_codechallenge && codeVerifier) {
            if (!this.verifyPkce(codeVerifier, row.out_codechallenge, row.out_challengemethod)) {
                logger.warn('Exchange: PKCE failed'); return null;
            }
        }

        const user = await userRepository.getUserById(parseInt(row.out_userid, 10));
        if (!user || !user.out_isactive) return null;

        return this.issueTokenPair(
            parseInt(row.out_userid, 10),
            parseInt(row.out_appid,  10),
            user.out_username,
            user.out_email,
            user.out_firstname,
            user.out_lastname,
            user.out_rolename,
            JSON.parse(user.out_appids   || '[]') as number[],
            JSON.parse(user.out_appnames || '[]') as string[],
            clientId,
            row.out_scope,
        );
    }

    // ------------------------------------------------------------------
    // Refresh tokens  (POST /sso/token, grant=refresh_token)
    // ------------------------------------------------------------------
    async refreshTokens(
        rawToken:     string,
        clientId:     string,
        clientSecret: string,
        ipAddress?:   string,
        userAgent?:   string
    ): Promise<TokenResponse | null> {
        const app = await applicationRepository.findByClientId(clientId);
        if (!app) return null;

        const secretOk = await bcrypt.compare(clientSecret, app.clientSecretHash);
        if (!secretOk) return null;

        const hash   = jwtService.hashToken(rawToken);
        const result = await refreshTokenRepository.validateAndRotate(hash);
        if (!result || !result.out_valid) {
            logger.warn('Refresh failed', { message: result?.out_message }); return null;
        }

        const user = await userRepository.getUserById(parseInt(result.out_userid, 10));
        if (!user || !user.out_isactive) return null;

        return this.issueTokenPair(
            parseInt(result.out_userid, 10),
            parseInt(result.out_appid,  10),
            user.out_username,
            user.out_email,
            user.out_firstname,
            user.out_lastname,
            user.out_rolename,
            JSON.parse(user.out_appids   || '[]') as number[],
            JSON.parse(user.out_appnames || '[]') as string[],
            clientId,
            result.out_scope,
            ipAddress,
            userAgent
        );
    }

    // ------------------------------------------------------------------
    // Logout
    // ------------------------------------------------------------------
    async logout(rawToken: string, logoutAll = false): Promise<void> {
        const hash = jwtService.hashToken(rawToken);
        await refreshTokenRepository.revoke(hash, logoutAll);
    }

    // ------------------------------------------------------------------
    // Validate client for /authorize
    // ------------------------------------------------------------------
    async validateClient(clientId: string): Promise<{ valid: boolean; appName?: string }> {
        const app = await applicationRepository.findByClientId(clientId);
        return app && app.isActive
            ? { valid: true, appName: app.appName }
            : { valid: false };
    }

    // ------------------------------------------------------------------
    // Internal token pair issuance
    // ------------------------------------------------------------------
    private async issueTokenPair(
        userId:    number,
        appId:     number,
        username:  string,
        email:     string,
        firstName: string,
        lastName:  string,
        role:      string,
        appIds:    number[],
        appNames:  string[],
        clientId:  string,
        scope:     string,
        ipAddress?: string,
        userAgent?: string
    ): Promise<TokenResponse> {
        const payload: Omit<JwtPayload, 'iat' | 'exp' | 'jti'> = {
            sub: String(userId), username, email, firstName, lastName,
            role, appIds, appNames, client_id: clientId, scope,
        };

        const accessToken   = jwtService.generateAccessToken(payload);
        const rawRefresh    = jwtService.generateRefreshToken();
        const refreshHash   = jwtService.hashToken(rawRefresh);
        const expiresAt     = new Date(Date.now() + config.jwt.refreshExpiry * 1000);

        await refreshTokenRepository.save(userId, appId, refreshHash, expiresAt, ipAddress, userAgent);

        return { access_token: accessToken, token_type: 'Bearer', expires_in: config.jwt.accessExpiry, scope };
    }

    // ------------------------------------------------------------------
    // PKCE RFC 7636
    // ------------------------------------------------------------------
    private verifyPkce(verifier: string, challenge: string, method: string): boolean {
        if (method === 'S256') {
            const digest = crypto.createHash('sha256').update(verifier).digest('base64url');
            return digest === challenge;
        }
        return verifier === challenge;
    }
}

export const authService = new AuthService();
