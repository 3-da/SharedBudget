import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { maskEmail } from '../common/utils/mask-email';

@Injectable()
export class MailService {
    private readonly logger = new Logger(MailService.name);
    private readonly resend: Resend | null;
    private readonly fromEmail: string;

    constructor(private readonly configService: ConfigService) {
        const apiKey = this.configService.get<string>('RESEND_API_KEY');
        this.fromEmail = this.configService.get<string>('MAIL_FROM', 'SharedBudget <noreply@sharedbudget.app>');

        if (apiKey) {
            this.resend = new Resend(apiKey);
            this.logger.log('Resend email provider configured');
        } else {
            this.resend = null;
            this.logger.warn('RESEND_API_KEY not set — emails will be logged to console only');
        }
    }

    async sendVerificationCode(email: string, code: string): Promise<void> {
        const subject = 'Your SharedBudget verification code';
        const html = `
            <h2>Verify your email</h2>
            <p>Your verification code is:</p>
            <h1 style="letter-spacing: 8px; font-size: 36px; text-align: center; padding: 16px; background: #f0f0f0; border-radius: 8px;">${code}</h1>
            <p>This code expires in <strong>10 minutes</strong>.</p>
            <p>If you didn't create an account, you can safely ignore this email.</p>
        `;

        await this.send(email, subject, html);
        this.logger.log(`Verification code sent to ${maskEmail(email)}`);
    }

    async sendPasswordResetLink(email: string, token: string): Promise<void> {
        const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:4200');
        const resetUrl = `${frontendUrl}/auth/reset-password?token=${token}`;
        const subject = 'Reset your SharedBudget password';
        const html = `
            <h2>Password Reset</h2>
            <p>Click the link below to reset your password:</p>
            <p><a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background: #0097a7; color: white; text-decoration: none; border-radius: 4px;">Reset Password</a></p>
            <p>This link expires in <strong>1 hour</strong>.</p>
            <p>If you didn't request this, you can safely ignore this email.</p>
        `;

        await this.send(email, subject, html);
        this.logger.log(`Password reset link sent to ${maskEmail(email)}`);
    }

    async sendHouseholdInvitation(email: string, inviterName: string, householdName: string): Promise<void> {
        const subject = `You're invited to join "${householdName}" on SharedBudget`;
        const html = `
            <h2>Household Invitation</h2>
            <p><strong>${inviterName}</strong> invited you to join the household "<strong>${householdName}</strong>" on SharedBudget.</p>
            <p>Log in to your account to accept or decline this invitation.</p>
        `;

        await this.send(email, subject, html);
        this.logger.log(`Household invitation sent to ${maskEmail(email)} from ${inviterName}`);
    }

    async sendInvitationResponse(email: string, responderName: string, householdName: string, accepted: boolean): Promise<void> {
        const action = accepted ? 'accepted' : 'declined';
        const subject = `${responderName} ${action} your household invitation`;
        const html = `
            <h2>Invitation ${accepted ? 'Accepted' : 'Declined'}</h2>
            <p><strong>${responderName}</strong> has <strong>${action}</strong> the invitation to join "<strong>${householdName}</strong>".</p>
        `;

        await this.send(email, subject, html);
        this.logger.log(`Invitation response (${action}) sent to ${maskEmail(email)}`);
    }

    async sendMemberRemoved(email: string, householdName: string): Promise<void> {
        const subject = `You've been removed from "${householdName}"`;
        const html = `
            <h2>Removed from Household</h2>
            <p>You have been removed from the household "<strong>${householdName}</strong>" on SharedBudget.</p>
        `;

        await this.send(email, subject, html);
        this.logger.log(`Member removed notification sent to ${maskEmail(email)}`);
    }

    private async send(to: string, subject: string, html: string): Promise<void> {
        if (this.resend) {
            try {
                await this.resend.emails.send({ from: this.fromEmail, to, subject, html });
            } catch (error) {
                this.logger.error(`Failed to send email to ${maskEmail(to)}: ${(error as Error).message}`);
                // Don't throw — email failure should not break the user flow
            }
        } else {
            this.logger.log(`[DEV EMAIL] To: ${to} | Subject: ${subject}`);
            // In dev, also log verification codes that are embedded in HTML
            const codeMatch = html.match(/letter-spacing.*?>(\d{6})</);
            if (codeMatch) {
                this.logger.log(`[DEV EMAIL] Verification code: ${codeMatch[1]}`);
            }
        }
    }
}
