// src/config/database.ts
import { Pool, QueryResult, QueryResultRow } from 'pg';
import { config } from './index';
import { logger } from './logger';

export const pool = new Pool({
    host:     config.db.host,
    port:     config.db.port,
    database: config.db.database,
    user:     config.db.user,
    password: config.db.password,
    min:      config.db.min,
    max:      config.db.max,
    idleTimeoutMillis:       30000,
    connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => logger.error('DB pool error', { message: err.message }));

export async function query<T extends QueryResultRow = Record<string, unknown>>(
    text: string,
    params?: unknown[]
): Promise<QueryResult<T>> {
    try {
        return await pool.query<T>(text, params);
    } catch (err: unknown) {
        logger.error('DB query error', { text: text.slice(0, 100), error: (err as Error).message });
        logger.error('DB query error', { error: config });
        throw err;
    }
}


export async function callSP<T extends QueryResultRow = Record<string, unknown>>(
    functionName: string,
    params: unknown[]
): Promise<T[]> {
    const ph  = params.map((_, i) => `$${i + 1}`).join(', ');
    const sql = `SELECT * FROM ${functionName}(${ph})`;
    const res = await query<T>(sql, params);
    return res.rows;
}

export async function checkConnection(): Promise<boolean> {
    try { await query('SELECT 1'); return true; }
    catch { return false; }
}
