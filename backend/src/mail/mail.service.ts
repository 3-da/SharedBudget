import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MailService {
    private readonly logger = new Logger(MailService.name);

    async sendVerificationCode(email: string, code: string): Promise<void> {
        // TODO: Replace with real email provider (Resend, SendGrid, etc.)
        this.logger.log(`📧 Verification code for ${email}: ${code}`);

        // For development, we just log it
        // In production, you'd call your email provider API here
    }

    async sendPasswordResetLink(email: string, token: string): Promise<void> {
        const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

        // TODO: Replace with real email provider (Resend, SendGrid, etc.)
        this.logger.log(`📧 Password reset link for ${email}: ${resetUrl}`);

        // For development, we just log it
        // In production, you'd call your email provider API here
    }

    async sendHouseholdInvitation(email: string, inviterName: string, householdName: string): Promise<void> {
        // TODO: Replace with real email provider (Resend, SendGrid, etc.)
        this.logger.log(`[MAIL] Household invitation to ${email}: "${inviterName} invited you to join "${householdName}"`);

        // For development, we just log it
        // In production, you'd call your email provider API here
    }

    async sendInvitationResponse(email: string, responderName: string, householdName: string, accepted: boolean): Promise<void> {
        const action = accepted ? 'accepted' : 'declined';

        // TODO: Replace with real email provider (Resend, SendGrid, etc.)
        this.logger.log(`[MAIL] Invitation response to ${email}: "${responderName} ${action} the invitation for "${householdName}"`);

        // For development, we just log it
        // In production, you'd call your email provider API here
    }

    async sendMemberRemoved(email: string, householdName: string): Promise<void> {
        // TODO: Replace with real email provider (Resend, SendGrid, etc.)
        this.logger.log(`[MAIL] Member removed notification to ${email}: "You have been removed from "${householdName}"`);

        // For development, we just log it
        // In production, you'd call your email provider API here
    }
}
