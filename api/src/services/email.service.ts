// src/services/email.service.ts
import nodemailer from 'nodemailer';
import { config } from '../config';
import { logger } from '../config/logger';

class EmailService {
    private transporter = nodemailer.createTransport({
        host:   config.email.host,
        port:   config.email.port,
        secure: config.email.secure,
        auth: config.email.user
            ? { user: config.email.user, pass: config.email.pass }
            : undefined,
    });

    async sendHrActivationEmail(
        employeeCode: string,
        fullName:     string,
        email:        string,
        department:   string,
        role:         string,
        appNames:     string[]
    ): Promise<boolean> {
        if (!config.email.host || !config.email.hrEmail) {
            logger.warn('Email not configured — skipping HR notification');
            return false;
        }
        try {
            await this.transporter.sendMail({
                from:    `"${config.email.from}" <${config.email.user}>`,
                to:      config.email.hrEmail,
                subject: `New SSO User Activated — ${employeeCode} ${fullName}`,
                html: `
                    <h2>New User SSO Account Activated</h2>
                    <table style="border-collapse:collapse;width:400px">
                        <tr><td style="padding:6px;font-weight:bold">Employee Code</td><td style="padding:6px">${employeeCode}</td></tr>
                        <tr><td style="padding:6px;font-weight:bold">Full Name</td><td style="padding:6px">${fullName}</td></tr>
                        <tr><td style="padding:6px;font-weight:bold">Email</td><td style="padding:6px">${email}</td></tr>
                        <tr><td style="padding:6px;font-weight:bold">Department</td><td style="padding:6px">${department}</td></tr>
                        <tr><td style="padding:6px;font-weight:bold">Role</td><td style="padding:6px">${role}</td></tr>
                        <tr><td style="padding:6px;font-weight:bold">Applications</td><td style="padding:6px">${appNames.join(', ')}</td></tr>
                    </table>
                    <p style="color:#666;font-size:12px">Sent by ${config.email.from} — ${new Date().toLocaleString()}</p>
                `,
            });
            logger.info('HR activation email sent', { employeeCode, email });
            return true;
        } catch (err: unknown) {
            logger.error('Email send failed', { error: (err as Error).message });
            return false;
        }
    }
}

export const emailService = new EmailService();
