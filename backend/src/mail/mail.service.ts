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
}
