// src/services/user.service.ts
import bcrypt from 'bcrypt';
import { userRepository }  from '../repositories/user.repository';
import { applicationRepository } from '../repositories/application.repository';
import { emailService }    from './email.service';
import { logger }          from '../config/logger';
import {
    CreateUserDto, UpdateUserDto, UserListItem, ParameterItem, ApplicationItem
} from '../models/entities';

export class UserService {

    async getUsers(statusFilter?: string, departmentId?: number, searchTerm?: string): Promise<UserListItem[]> {
        return userRepository.getUsers(statusFilter, departmentId, searchTerm);
    }

    async createUser(dto: CreateUserDto): Promise<{ success: boolean; message: string; userId?: number }> {
        const hashedPassword = await bcrypt.hash(dto.password, 12);
        const result = await userRepository.createUser({ ...dto, password: hashedPassword });
        if (!result.success) return result;

        if (dto.appIds.length > 0) {
            await userRepository.setUserApplications(result.userId, dto.appIds);
        }

        logger.info('User created', { userId: result.userId, empCode: dto.employeeCode });
        return result;
    }

    async updateUser(dto: UpdateUserDto, previousStatusValue: string): Promise<{ success: boolean; message: string }> {
        const result = await userRepository.updateUser(dto);
        if (!result.success) return result;

        // Sync app assignments
        await userRepository.setUserApplications(dto.userId, dto.appIds);

        // Check if status changed TO Active → send HR email (if not already sent)
        const newUser = await userRepository.getUserById(dto.userId);
        if (
            newUser &&
            newUser.out_statusvalue === 'Active' &&
            previousStatusValue !== 'Active'
        ) {
            const deptName = (await userRepository.getParameters('Department'))
                .find(p => p.id === dto.departmentId)?.value || '';
            const appNames = JSON.parse(newUser.out_appnames || '[]') as string[];

            const sent = await emailService.sendHrActivationEmail(
                dto.employeeCode,
                `${dto.firstName} ${dto.lastName}`,
                dto.email,
                deptName,
                newUser.out_rolename,
                appNames
            );

            if (sent) await userRepository.markEmailSent(dto.userId);
        }

        return result;
    }

    async getParameterList(parameterText: string): Promise<ParameterItem[]> {
        return userRepository.getParameters(parameterText);
    }

    async getApplications(): Promise<ApplicationItem[]> {
        return applicationRepository.getAll();
    }
}

export const userService = new UserService();
