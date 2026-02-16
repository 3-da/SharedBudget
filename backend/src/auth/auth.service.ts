import { ForbiddenException, Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { MailService } from '../mail/mail.service';
import { SessionService } from '../session/session.service';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { REDIS_CLIENT } from '../redis/redis.module';
import Redis from 'ioredis';
import { MessageResponseDto } from '../common/dto/message-response.dto';


// Pre-computed Argon2id hash to equalize response time when user not found (timing attack prevention)
const DUMMY_ARGON2_HASH = '$argon2id$v=19$m=65536,t=3,p=4$dW5rbm93bnNhbHQ$dW5rbm93bmhhc2g';

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    private readonly verificationCodeTTL: number;
    private readonly resetTokenTTL: number;

    constructor(
        private prismaService: PrismaService,
        private jwtService: JwtService,
        private configService: ConfigService,
        private mailService: MailService,
        private sessionService: SessionService,
        @Inject(REDIS_CLIENT) private redis: Redis,
    ) {
        this.verificationCodeTTL = this.configService.get<number>('AUTH_VERIFICATION_CODE_TTL', 600);
        this.resetTokenTTL = this.configService.get<number>('AUTH_RESET_TOKEN_TTL', 3600);
    }

    async register(registerDto: RegisterDto): Promise<MessageResponseDto> {
        this.logger.log(`Registration attempt: ${registerDto.email}`);

        const existingUser = await this.prismaService.user.findUnique({ where: { email: registerDto.email } });
        if (existingUser) {
            this.logger.warn(`Registration attempt for existing email: ${registerDto.email}`);
            return { message: "We've sent a verification code to your email." };
        }

        const hashedPassword = await argon2.hash(registerDto.password);

        await this.prismaService.user.create({
            data: {
                email: registerDto.email,
                password: hashedPassword,
                firstName: registerDto.firstName,
                lastName: registerDto.lastName,
                emailVerified: false,
            },
        });

        await this.sendVerificationCode(registerDto.email);
        this.logger.log(`User registered successfully: ${registerDto.email}`);
        return { message: "We've sent a verification code to your email." };
    }

    async login(loginDto: LoginDto): Promise<AuthResponseDto> {
        this.logger.log(`Login attempt for email: ${loginDto.email}`);

        const user = await this.prismaService.user.findUnique({ where: { email: loginDto.email } });
        if (!user) {
            // Perform dummy hash verification to equalize response time (timing attack prevention)
            await argon2.verify(DUMMY_ARGON2_HASH, loginDto.password).catch(() => {});
            this.logger.warn(`Failed login attempt for email: ${loginDto.email}`);
            throw new UnauthorizedException('Incorrect email or password.');
        }

        const isPasswordValid = await argon2.verify(user.password, loginDto.password);
        if (!isPasswordValid) {
            this.logger.warn(`Failed login attempt for email: ${loginDto.email}`);
            throw new UnauthorizedException('Incorrect email or password.');
        }

        // Check if email is verified
        if (!user.emailVerified) {
            this.logger.warn(`Failed login attempt for email: ${loginDto.email}`);
            throw new ForbiddenException('Please verify your email first. Check your inbox for the verification code.');
        }

        this.logger.log(`User logged in successfully: ${user.id}`);
        return this.generateTokens(user);
    }

    async verifyCode(email: string, code: string): Promise<AuthResponseDto> {
        this.logger.log(`Email verification attempt: ${email}`);

        const storedCode = await this.redis.get(`verify:${email}`);
        if (!storedCode || storedCode !== code) {
            this.logger.warn(`Invalid verification code for: ${email}`);
            throw new UnauthorizedException('Invalid or expired verification code.');
        }

        const user = await this.prismaService.user.findUnique({ where: { email } });
        if (!user) {
            this.logger.warn(`Invalid verification code for: ${email}`);
            throw new UnauthorizedException('Invalid or expired verification code.');
        }

        // Mark as verified
        await this.prismaService.user.update({ where: { id: user.id }, data: { emailVerified: true } });
        await this.redis.del(`verify:${email}`); // Delete the code

        this.logger.log(`Email verified successfully: ${email}`);
        return this.generateTokens(user); // Auto-login: return tokens
    }

    async resendCode(email: string): Promise<MessageResponseDto> {
        this.logger.log(`Resend verification code requested: ${email}`);

        const user = await this.prismaService.user.findUnique({ where: { email } });
        if (!user || user.emailVerified) {
            this.logger.debug(`Resend code skipped (user not found or already verified): ${email}`);
            return { message: "If an account exists, we've sent a new code." };
        }

        await this.sendVerificationCode(email);

        this.logger.log(`Verification code resent: ${email}`);
        return { message: "If an account exists, we've sent a new code." };
    }

    async refresh(refreshToken: string): Promise<AuthResponseDto> {
        const userId = await this.sessionService.getUserIdFromRefreshToken(refreshToken);

        if (!userId) {
            this.logger.warn(`Invalid refresh token attempt`);
            throw new UnauthorizedException('Invalid or expired session. Please sign in again.');
        }

        const user = await this.prismaService.user.findUnique({ where: { id: userId } });
        if (!user) {
            this.logger.warn(`Invalid refresh token attempt`);
            throw new UnauthorizedException('Invalid or expired session. Please sign in again.');
        }

        // Delete old refresh token and remove from session set
        await this.sessionService.removeRefreshToken(refreshToken);

        this.logger.debug(`Token refreshed for user: ${userId}`);
        return this.generateTokens(user);
    }

    async logout(refreshToken: string): Promise<void> {
        const userId = await this.sessionService.removeRefreshToken(refreshToken);

        if (userId) {
            this.logger.log(`User logged out: ${userId}`);
        }
    }

    async forgotPassword(email: string): Promise<MessageResponseDto> {
        this.logger.log(`Password reset requested for email: ${email}`);
        const user = await this.prismaService.user.findUnique({ where: { email } });

        // Always return same message (don't reveal if email exists)
        if (!user) {
            this.logger.debug(`Password reset for non-existent email: ${email}`);
            return { message: "If an account exists, we've sent a password reset link." };
        }

        const token = crypto.randomBytes(32).toString('hex');

        // Store token in Redis: reset:{token} -> userId
        await this.redis.set(`reset:${token}`, user.id, 'EX', this.resetTokenTTL);

        await this.mailService.sendPasswordResetLink(email, token);
        this.logger.log(`Password reset email sent: ${email}`);
        return { message: "If an account exists, we've sent a password reset link." };
    }

    async resetPassword(token: string, newPassword: string): Promise<MessageResponseDto> {
        const userId = await this.redis.get(`reset:${token}`);

        if (!userId) {
            this.logger.warn(`Invalid password reset attempt with token`);
            throw new UnauthorizedException('Invalid or expired reset token.');
        }

        const hashedPassword = await argon2.hash(newPassword);

        await this.prismaService.user.update({
            where: { id: userId },
            data: { password: hashedPassword },
        });

        // Delete the used reset token
        await this.redis.del(`reset:${token}`);

        // Invalidate all existing sessions for security
        const invalidatedCount = await this.sessionService.invalidateAllSessions(userId);

        this.logger.log(`Password reset for user: ${userId}, invalidated ${invalidatedCount} sessions`);

        return { message: 'Password reset successfully. You can now log in with your new password.' };
    }

    private async sendVerificationCode(email: string): Promise<void> {
        const code = Math.floor(100000 + Math.random() * 900000).toString();

        await this.redis.set(`verify:${email}`, code, 'EX', this.verificationCodeTTL);
        await this.mailService.sendVerificationCode(email, code);
    }

    private async generateTokens(user: { id: string; email: string; firstName: string; lastName: string }): Promise<AuthResponseDto> {
        const accessToken = this.jwtService.sign({ sub: user.id, email: user.email });
        const refreshToken = crypto.randomBytes(32).toString('hex');

        await this.sessionService.storeRefreshToken(user.id, refreshToken);

        this.logger.debug(`Token generated for user: ${user.id}`);

        return {
            accessToken,
            refreshToken,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
            },
        };
    }
}
