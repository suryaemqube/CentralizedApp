// src/controllers/user.controller.ts
import { Request, Response } from 'express';
import { z }                 from 'zod';
import { userService }       from '../services/user.service';
import { jwtService }        from '../services/jwt.service';
import { logger }            from '../config/logger';

// ── Auth guard helper ─────────────────────────────────────────────────────────
function requireAdmin(req: Request, res: Response): boolean {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) { res.status(401).json({ error: 'unauthorized' }); return false; }
    try {
        const payload = jwtService.verify(auth.slice(7));
        if (payload.role !== 'Admin') {
            res.status(403).json({ error: 'forbidden', error_description: 'Admin role required' });
            return false;
        }
        return true;
    } catch { res.status(401).json({ error: 'invalid_token' }); return false; }
}

// ── Validation schemas ────────────────────────────────────────────────────────
const createUserSchema = z.object({
    employeeCode: z.string().min(1).max(50),
    departmentId: z.number().int().positive(),
    firstName:    z.string().min(1).max(100),
    lastName:     z.string().min(1).max(100),
    username:     z.string().min(3).max(100),
    email:        z.string().email().max(100),
    password:     z.string().min(8).max(100),
    startDate:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    roleId:       z.number().int().positive(),
    statusId:     z.number().int().positive(),
    appIds:       z.array(z.number().int().positive()).default([]),
});

const updateUserSchema = createUserSchema.omit({ password: true }).extend({
    userId: z.number().int().positive(),
});

// ── GET /api/users ────────────────────────────────────────────────────────────
export async function getUsersHandler(req: Request, res: Response): Promise<void> {
    if (!requireAdmin(req, res)) return;
    const { status, departmentId, search } = req.query as Record<string, string>;
    const users = await userService.getUsers(
        status       || undefined,
        departmentId ? parseInt(departmentId, 10) : undefined,
        search       || undefined
    );
    res.status(200).json({ data: users, count: users.length });
}

// ── POST /api/users ───────────────────────────────────────────────────────────
export async function createUserHandler(req: Request, res: Response): Promise<void> {
    if (!requireAdmin(req, res)) return;
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: 'validation_error', details: parsed.error.flatten() }); return;
    }
    const result = await userService.createUser(parsed.data);
    if (!result.success) {
        res.status(409).json({ error: 'conflict', error_description: result.message }); return;
    }
    logger.info('User created via API', { userId: result.userId });
    res.status(201).json({ success: true, userId: result.userId, message: result.message });
}

// ── PUT /api/users/:userId ────────────────────────────────────────────────────
export async function updateUserHandler(req: Request, res: Response): Promise<void> {
    if (!requireAdmin(req, res)) return;
    const userId = parseInt(req.params['userId'] || '0', 10);
    if (!userId) { res.status(400).json({ error: 'invalid_user_id' }); return; }

    const parsed = updateUserSchema.safeParse({ ...req.body, userId });
    if (!parsed.success) {
        res.status(400).json({ error: 'validation_error', details: parsed.error.flatten() }); return;
    }

    // Get previous status to detect activation
    const prev = await (await import('../repositories/user.repository')).userRepository.getUserById(userId);
    const prevStatus = prev?.out_statusvalue || 'Draft';

    const result = await userService.updateUser(parsed.data, prevStatus);
    if (!result.success) {
        res.status(409).json({ error: 'conflict', error_description: result.message }); return;
    }
    res.status(200).json({ success: true, message: result.message });
}

// ── GET /api/parameters/:type ─────────────────────────────────────────────────
export async function getParametersHandler(req: Request, res: Response): Promise<void> {
    const type = req.params['type'];
    if (!type) { res.status(400).json({ error: 'type_required' }); return; }
    const items = await userService.getParameterList(type);
    res.status(200).json({ data: items });
}

// ── GET /api/applications ─────────────────────────────────────────────────────
export async function getApplicationsHandler(req: Request, res: Response): Promise<void> {
    // For dashboard — requires valid token (any role)
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) { res.status(401).json({ error: 'unauthorized' }); return; }
    try {
        jwtService.verify(auth.slice(7));
        const apps = await userService.getApplications();
        res.status(200).json({ data: apps });
    } catch { res.status(401).json({ error: 'invalid_token' }); }
}
