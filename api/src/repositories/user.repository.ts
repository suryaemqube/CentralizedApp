// src/repositories/user.repository.ts
import { callSP } from '../config/database';
import {
    UserLoginRow, UserRow, ParameterDetRow,
    CreateUserDto, UpdateUserDto, UserListItem, ParameterItem,
} from '../models/entities';

export class UserRepository {

    async validateLogin(usernameOrEmail: string): Promise<UserLoginRow | null> {
        const rows = await callSP<UserLoginRow>('usp_ValidateUserLogin', [usernameOrEmail]);
        return rows[0] ?? null;
    }

    async getUserById(userId: number): Promise<UserLoginRow | null> {
        const rows = await callSP<{
            out_userid: string; out_username: string; out_email: string;
            out_firstname: string; out_lastname: string; out_isactive: boolean;
            out_statusvalue: string; out_rolename: string;
            out_appids: string; out_appnames: string;
        }>('usp_GetUserById', [userId]);

        if (!rows[0]) return null;
        const r = rows[0];
        return {
            out_userid:       r.out_userid,
            out_username:     r.out_username,
            out_email:        r.out_email,
            out_firstname:    r.out_firstname,
            out_lastname:     r.out_lastname,
            out_passwordhash: '',
            out_isactive:     r.out_isactive,
            out_islocked:     false,
            out_statusvalue:  r.out_statusvalue,
            out_rolename:     r.out_rolename,
            out_appids:       r.out_appids,
            out_appnames:     r.out_appnames,
        };
    }

    async getUsers(
        statusFilter?: string,
        departmentId?: number,
        searchTerm?: string
    ): Promise<UserListItem[]> {
        const rows = await callSP<UserRow>('usp_GetUsers', [
            statusFilter ?? null,
            departmentId ?? null,
            searchTerm   ?? null,
        ]);
        return rows.map(r => ({
            ssonId:     parseInt(r.out_ssonid, 10),
            empCode:    r.out_empcode,
            firstName:  r.out_firstname,
            lastName:   r.out_lastname,
            department: r.out_department,
            apps:       r.out_apps,
            status:     r.out_statusvalue,
            email:      r.out_email,
            role:       r.out_rolename,
            startDate:  r.out_startdate,
            endDate:    r.out_enddate ?? null,
        }));
    }

    async createUser(dto: CreateUserDto): Promise<{ userId: number; success: boolean; message: string }> {
        const rows = await callSP<{ out_userid: string; out_success: boolean; out_message: string }>(
            'usp_RegisterUser',
            [
                dto.employeeCode, dto.departmentId, dto.firstName, dto.lastName,
                dto.username, dto.email, dto.password,
                dto.startDate, dto.endDate ?? null, dto.roleId, dto.statusId,
            ]
        );
        return {
            userId:  parseInt(rows[0].out_userid, 10),
            success: rows[0].out_success,
            message: rows[0].out_message,
        };
    }

    async updateUser(dto: UpdateUserDto): Promise<{ success: boolean; message: string }> {
        const rows = await callSP<{ out_success: boolean; out_message: string }>(
            'usp_UpdateUser',
            [
                dto.userId, dto.employeeCode, dto.departmentId,
                dto.firstName, dto.lastName, dto.username, dto.email,
                dto.startDate, dto.endDate ?? null, dto.roleId, dto.statusId,
            ]
        );
        return { success: rows[0].out_success, message: rows[0].out_message };
    }

    async setUserApplications(userId: number, appIds: number[]): Promise<void> {
        await callSP('usp_SetUserApplications', [userId, appIds]);
    }

    async markEmailSent(userId: number): Promise<void> {
        await callSP('usp_MarkEmailSent', [userId]);
    }

    async getParameters(parameterText: string): Promise<ParameterItem[]> {
        const rows = await callSP<ParameterDetRow>('usp_GetParameters', [parameterText]);
        return rows.map(r => ({
            id:    parseInt(r.out_detid, 10),
            value: r.out_value,
            order: parseInt(r.out_order, 10),
        }));
    }
}

export const userRepository = new UserRepository();
