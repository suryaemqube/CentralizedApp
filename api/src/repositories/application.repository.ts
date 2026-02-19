// src/repositories/application.repository.ts
import { callSP, query } from '../config/database';
import { ApplicationRow, ApplicationItem } from '../models/entities';

export class ApplicationRepository {

    async getAll(): Promise<ApplicationItem[]> {
        const rows = await callSP<ApplicationRow>('usp_GetApplications', []);
        return rows.map(r => ({
            appId:    parseInt(r.out_appid, 10),
            appName:  r.out_appname,
            appUrl:   r.out_appurl,
            iconPath: r.out_iconpath,
            clientId: r.out_clientid,
        }));
    }

    async findByClientId(clientId: string): Promise<{
        appId: number;
        appName: string;
        appUrl: string;
        clientSecretHash: string;
        isActive: boolean;
    } | null> {
        const res = await query<{
            appid: string; appname: string; appurl: string;
            clientsecrethash: string; isactive: boolean;
        }>(
            'SELECT AppId, AppName, AppURL, ClientSecretHash, IsActive FROM Applications WHERE ClientId = $1',
            [clientId]
        );
        if (!res.rows[0]) return null;
        const r = res.rows[0];
        return {
            appId:            parseInt(r.appid, 10),
            appName:          r.appname,
            appUrl:           r.appurl,
            clientSecretHash: r.clientsecrethash,
            isActive:         r.isactive,
        };
    }
}

export const applicationRepository = new ApplicationRepository();
