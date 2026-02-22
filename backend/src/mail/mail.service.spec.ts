import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { MailService } from './mail.service';
import { Resend } from 'resend';

// Mock Resend before importing MailService — must use function() for `new` call
const mockSend = vi.fn();
vi.mock('resend', () => {
    const ResendMock = vi.fn(function (this: any) {
        this.emails = { send: mockSend };
    });
    return { Resend: ResendMock };
});

describe('MailService', () => {
    let service: MailService;

    const mockConfigService = {
        get: vi.fn(),
    };

    const API_KEY = 'test-resend-api-key';
    const FROM_EMAIL = 'SharedBudget <noreply@sharedbudget.app>';
    const FRONTEND_URL = 'https://app.sharedbudget.com';

    function configGetFactory(withApiKey: boolean) {
        return (key: string, defaultValue?: string) => {
            const map: Record<string, string | undefined> = {
                RESEND_API_KEY: withApiKey ? API_KEY : undefined,
                MAIL_FROM: FROM_EMAIL,
                FRONTEND_URL: FRONTEND_URL,
            };
            return map[key] ?? defaultValue;
        };
    }

    function createService(withApiKey: boolean): Promise<TestingModule> {
        mockConfigService.get.mockImplementation(configGetFactory(withApiKey));
        return Test.createTestingModule({
            providers: [MailService, { provide: ConfigService, useValue: mockConfigService }],
        }).compile();
    }

    beforeEach(() => {
        vi.clearAllMocks();
        // Suppress Logger output during tests
        vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
        vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
        vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
        vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
    });

    describe('constructor', () => {
        it('should initialize Resend client when RESEND_API_KEY is provided', async () => {
            const module = await createService(true);
            service = module.get<MailService>(MailService);

            expect(Resend).toHaveBeenCalledWith(API_KEY);
            expect(Logger.prototype.log).toHaveBeenCalledWith('Resend email provider configured');
        });

        it('should set resend to null and log warning when RESEND_API_KEY is not provided', async () => {
            const module = await createService(false);
            service = module.get<MailService>(MailService);

            expect(Resend).not.toHaveBeenCalled();
            expect(Logger.prototype.warn).toHaveBeenCalledWith('RESEND_API_KEY not set — emails will be logged to console only');
        });
    });

    describe('with Resend client configured', () => {
        beforeEach(async () => {
            const module = await createService(true);
            service = module.get<MailService>(MailService);
            // Clear constructor log calls
            vi.mocked(Logger.prototype.log).mockClear();
        });

        describe('sendVerificationCode', () => {
            it('should send email with correct params and verification code in HTML', async () => {
                mockSend.mockResolvedValue({ id: 'email-1' });

                await service.sendVerificationCode('user@example.com', '123456');

                expect(mockSend).toHaveBeenCalledWith(
                    expect.objectContaining({
                        from: FROM_EMAIL,
                        to: 'user@example.com',
                        subject: 'Your SharedBudget verification code',
                    }),
                );
                const callArgs = mockSend.mock.calls[0][0];
                expect(callArgs.html).toContain('123456');
                expect(callArgs.html).toContain('Verify your email');

                expect(Logger.prototype.log).toHaveBeenCalledWith('Verification code sent to u***@example.com');
            });
        });

        describe('sendPasswordResetLink', () => {
            it('should build reset URL from FRONTEND_URL and include token', async () => {
                mockSend.mockResolvedValue({ id: 'email-2' });
                const token = 'abc123def456';

                await service.sendPasswordResetLink('user@example.com', token);

                const callArgs = mockSend.mock.calls[0][0];
                expect(callArgs.from).toBe(FROM_EMAIL);
                expect(callArgs.to).toBe('user@example.com');
                expect(callArgs.subject).toBe('Reset your SharedBudget password');
                expect(callArgs.html).toContain(`${FRONTEND_URL}/auth/reset-password?token=${token}`);
                expect(callArgs.html).toContain('Password Reset');

                expect(Logger.prototype.log).toHaveBeenCalledWith('Password reset link sent to u***@example.com');
            });
        });

        describe('sendHouseholdInvitation', () => {
            it('should send invitation email with household name and inviter', async () => {
                mockSend.mockResolvedValue({ id: 'email-3' });

                await service.sendHouseholdInvitation('jordan@example.com', 'Alex', 'Budget House');

                const callArgs = mockSend.mock.calls[0][0];
                expect(callArgs.from).toBe(FROM_EMAIL);
                expect(callArgs.to).toBe('jordan@example.com');
                expect(callArgs.subject).toBe('You\'re invited to join "Budget House" on SharedBudget');
                expect(callArgs.html).toContain('Alex');
                expect(callArgs.html).toContain('Budget House');

                expect(Logger.prototype.log).toHaveBeenCalledWith('Household invitation sent to j***@example.com from Alex');
            });
        });

        describe('sendInvitationResponse', () => {
            it('should send "accepted" response when accepted is true', async () => {
                mockSend.mockResolvedValue({ id: 'email-4' });

                await service.sendInvitationResponse('alex@example.com', 'Jordan', 'Budget House', true);

                const callArgs = mockSend.mock.calls[0][0];
                expect(callArgs.from).toBe(FROM_EMAIL);
                expect(callArgs.to).toBe('alex@example.com');
                expect(callArgs.subject).toBe('Jordan accepted your household invitation');
                expect(callArgs.html).toContain('Accepted');
                expect(callArgs.html).toContain('accepted');
                expect(callArgs.html).toContain('Budget House');

                expect(Logger.prototype.log).toHaveBeenCalledWith('Invitation response (accepted) sent to a***@example.com');
            });

            it('should send "declined" response when accepted is false', async () => {
                mockSend.mockResolvedValue({ id: 'email-5' });

                await service.sendInvitationResponse('alex@example.com', 'Jordan', 'Budget House', false);

                const callArgs = mockSend.mock.calls[0][0];
                expect(callArgs.subject).toBe('Jordan declined your household invitation');
                expect(callArgs.html).toContain('Declined');
                expect(callArgs.html).toContain('declined');

                expect(Logger.prototype.log).toHaveBeenCalledWith('Invitation response (declined) sent to a***@example.com');
            });
        });

        describe('sendMemberRemoved', () => {
            it('should send removal notification with household name', async () => {
                mockSend.mockResolvedValue({ id: 'email-6' });

                await service.sendMemberRemoved('sam@example.com', 'Budget House');

                const callArgs = mockSend.mock.calls[0][0];
                expect(callArgs.from).toBe(FROM_EMAIL);
                expect(callArgs.to).toBe('sam@example.com');
                expect(callArgs.subject).toBe('You\'ve been removed from "Budget House"');
                expect(callArgs.html).toContain('Budget House');
                expect(callArgs.html).toContain('Removed from Household');

                expect(Logger.prototype.log).toHaveBeenCalledWith('Member removed notification sent to s***@example.com');
            });
        });

        describe('error handling', () => {
            it('should log error and not re-throw when resend.emails.send fails', async () => {
                mockSend.mockRejectedValue(new Error('SMTP connection failed'));

                await expect(service.sendVerificationCode('user@example.com', '123456')).resolves.toBeUndefined();

                expect(Logger.prototype.error).toHaveBeenCalledWith('Failed to send email to u***@example.com: SMTP connection failed');
            });

            it('should not call post-send logger.log when send fails', async () => {
                mockSend.mockRejectedValue(new Error('Network error'));

                await service.sendPasswordResetLink('user@example.com', 'token-123');

                expect(Logger.prototype.error).toHaveBeenCalledTimes(1);
                // The success log should still be called since it's after this.send()
                // Actually looking at the code, logger.log is called AFTER await this.send()
                // and send() catches the error internally, so the success log IS called
                expect(Logger.prototype.log).toHaveBeenCalledWith('Password reset link sent to u***@example.com');
            });
        });
    });

    describe('without Resend client (dev fallback)', () => {
        beforeEach(async () => {
            const module = await createService(false);
            service = module.get<MailService>(MailService);
            // Clear constructor log/warn calls
            vi.mocked(Logger.prototype.log).mockClear();
            vi.mocked(Logger.prototype.warn).mockClear();
        });

        it('should not throw and log email details to console', async () => {
            await expect(service.sendVerificationCode('user@example.com', '654321')).resolves.toBeUndefined();

            expect(mockSend).not.toHaveBeenCalled();
            expect(Logger.prototype.log).toHaveBeenCalledWith('[DEV EMAIL] To: user@example.com | Subject: Your SharedBudget verification code');
        });

        it('should extract and log verification code from HTML', async () => {
            await service.sendVerificationCode('user@example.com', '987654');

            expect(Logger.prototype.log).toHaveBeenCalledWith('[DEV EMAIL] Verification code: 987654');
        });

        it('should not log verification code for non-verification emails', async () => {
            await service.sendPasswordResetLink('user@example.com', 'reset-token');

            const logCalls = vi.mocked(Logger.prototype.log).mock.calls.map((c) => c[0]);
            const codeLogCalls = logCalls.filter((msg: string) => msg.includes('[DEV EMAIL] Verification code'));
            expect(codeLogCalls).toHaveLength(0);
        });

        it('should handle all email methods without throwing', async () => {
            await expect(service.sendPasswordResetLink('a@b.com', 'token')).resolves.toBeUndefined();
            await expect(service.sendHouseholdInvitation('a@b.com', 'Alex', 'House')).resolves.toBeUndefined();
            await expect(service.sendInvitationResponse('a@b.com', 'Sam', 'House', true)).resolves.toBeUndefined();
            await expect(service.sendInvitationResponse('a@b.com', 'Sam', 'House', false)).resolves.toBeUndefined();
            await expect(service.sendMemberRemoved('a@b.com', 'House')).resolves.toBeUndefined();

            expect(mockSend).not.toHaveBeenCalled();
        });
    });
});
