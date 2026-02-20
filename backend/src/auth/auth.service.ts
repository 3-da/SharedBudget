import { ForbiddenException, HttpException, HttpStatus, Inject, Injectable, Logger, OnModuleInit, UnauthorizedException } from '@nestjs/common';
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
import { maskEmail } from '../common/utils/mask-email';
import { Response } from 'express';

@Injectable()
export class AuthService implements OnModuleInit {
    private readonly logger = new Logger(AuthService.name);

    private static readonly MAX_LOGIN_ATTEMPTS = 5;
    private static readonly LOGIN_LOCKOUT_TTL = 900; // 15 minutes

    private readonly verificationCodeTTL: number;
    private readonly resetTokenTTL: number;
    private readonly refreshTokenTTL: number;
    private readonly argon2Options: argon2.Options;
    private dummyArgon2Hash: string;

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
        this.refreshTokenTTL = this.configService.get<number>('JWT_REFRESH_EXPIRATION', 604800); // 7 days default
        this.argon2Options = {
            memoryCost: this.configService.get<number>('ARGON2_MEMORY_COST', 65536),
            timeCost: this.configService.get<number>('ARGON2_TIME_COST', 3),
            parallelism: this.configService.get<number>('ARGON2_PARALLELISM', 4),
        };
    }

    async onModuleInit(): Promise<void> {
        this.dummyArgon2Hash = await argon2.hash('dummy-startup-password', this.argon2Options);
    }

    async register(registerDto: RegisterDto): Promise<MessageResponseDto> {
        this.logger.log(`Registration attempt: ${maskEmail(registerDto.email)}`);

        const existingUser = await this.prismaService.user.findUnique({ where: { email: registerDto.email } });
        if (existingUser) {
            this.logger.warn(`Registration attempt for existing email: ${maskEmail(registerDto.email)}`);
            return { message: "We've sent a verification code to your email." };
        }

        const hashedPassword = await argon2.hash(registerDto.password, this.argon2Options);

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
        this.logger.log(`User registered successfully: ${maskEmail(registerDto.email)}`);
        return { message: "We've sent a verification code to your email." };
    }

    async login(loginDto: LoginDto, res: Response, userAgent?: string): Promise<AuthResponseDto> {
        this.logger.log(`Login attempt for email: ${maskEmail(loginDto.email)}`);

        // Check lockout before any work
        const lockoutKey = `login_attempts:${loginDto.email}`;
        const attempts = await this.redis.get(lockoutKey);
        if (attempts && parseInt(attempts, 10) >= AuthService.MAX_LOGIN_ATTEMPTS) {
            this.logger.warn(`Account locked out: ${maskEmail(loginDto.email)}`);
            throw new HttpException('Too many failed login attempts. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
        }

        const user = await this.prismaService.user.findUnique({ where: { email: loginDto.email } });
        if (!user) {
            // Perform dummy hash verification to equalize response time (timing attack prevention)
            await argon2.verify(this.dummyArgon2Hash, loginDto.password).catch(() => {});
            await this.incrementLoginAttempts(lockoutKey);
            this.logger.warn(`Failed login attempt for email: ${maskEmail(loginDto.email)}`);
            throw new UnauthorizedException('Incorrect email or password.');
        }

        const isPasswordValid = await argon2.verify(user.password, loginDto.password);
        if (!isPasswordValid) {
            await this.incrementLoginAttempts(lockoutKey);
            this.logger.warn(`Failed login attempt for email: ${maskEmail(loginDto.email)}`);
            throw new UnauthorizedException('Incorrect email or password.');
        }

        // Check if account has been deleted
        if (user.deletedAt) {
            this.logger.warn(`Login attempt on deleted account: ${user.id}`);
            throw new UnauthorizedException('Incorrect email or password.');
        }

        // Check if email is verified
        if (!user.emailVerified) {
            this.logger.warn(`Failed login attempt for email: ${maskEmail(loginDto.email)}`);
            throw new ForbiddenException('Please verify your email first. Check your inbox for the verification code.');
        }

        // Reset login attempts on success
        await this.redis.del(lockoutKey);

        this.logger.log(`User logged in successfully: ${user.id}`);
        return this.generateTokens(user, res, userAgent);
    }

    async verifyCode(email: string, code: string, res: Response, userAgent?: string): Promise<AuthResponseDto> {
        this.logger.log(`Email verification attempt: ${maskEmail(email)}`);

        const storedCode = await this.redis.get(`verify:${email}`);
        if (!storedCode || storedCode.length !== code.length || !crypto.timingSafeEqual(Buffer.from(storedCode), Buffer.from(code))) {
            this.logger.warn(`Invalid verification code for: ${maskEmail(email)}`);
            throw new UnauthorizedException('Invalid or expired verification code.');
        }

        const user = await this.prismaService.user.findUnique({ where: { email } });
        if (!user) {
            this.logger.warn(`Invalid verification code for: ${maskEmail(email)}`);
            throw new UnauthorizedException('Invalid or expired verification code.');
        }

        // Mark as verified
        await this.prismaService.user.update({ where: { id: user.id }, data: { emailVerified: true } });
        await this.redis.del(`verify:${email}`); // Delete the code

        this.logger.log(`Email verified successfully: ${maskEmail(email)}`);
        return this.generateTokens(user, res, userAgent); // Auto-login: return tokens
    }

    async resendCode(email: string): Promise<MessageResponseDto> {
        this.logger.log(`Resend verification code requested: ${maskEmail(email)}`);

        const user = await this.prismaService.user.findUnique({ where: { email } });
        if (!user || user.emailVerified) {
            this.logger.debug(`Resend code skipped (user not found or already verified): ${maskEmail(email)}`);
            return { message: "If an account exists, we've sent a new code." };
        }

        await this.sendVerificationCode(email);

        this.logger.log(`Verification code resent: ${maskEmail(email)}`);
        return { message: "If an account exists, we've sent a new code." };
    }

    async refresh(refreshToken: string, res: Response, userAgent?: string): Promise<AuthResponseDto> {
        const session = await this.sessionService.getSessionFromRefreshToken(refreshToken);

        if (!session) {
            this.logger.warn(`Invalid refresh token attempt`);
            throw new UnauthorizedException('Invalid or expired session. Please sign in again.');
        }

        // Device binding: verify user-agent fingerprint matches
        if (session.uaHash && userAgent) {
            const currentUaHash = this.sessionService.hashUserAgent(userAgent);
            if (session.uaHash !== currentUaHash) {
                this.logger.warn(`Device mismatch for user: ${session.userId}`);
                await this.sessionService.removeRefreshToken(refreshToken);
                throw new UnauthorizedException('Session expired due to device change. Please sign in again.');
            }
        }

        const user = await this.prismaService.user.findUnique({ where: { id: session.userId } });
        if (!user) {
            this.logger.warn(`Invalid refresh token attempt`);
            throw new UnauthorizedException('Invalid or expired session. Please sign in again.');
        }

        // Delete old refresh token and remove from session set
        await this.sessionService.removeRefreshToken(refreshToken);

        this.logger.debug(`Token refreshed for user: ${session.userId}`);
        return this.generateTokens(user, res, userAgent);
    }

    async logout(refreshToken: string, res: Response): Promise<void> {
        const userId = await this.sessionService.removeRefreshToken(refreshToken);

        res.clearCookie('refresh_token', { path: '/api/v1/auth' });
        res.clearCookie('XSRF-TOKEN', { path: '/' });

        if (userId) {
            this.logger.log(`User logged out: ${userId}`);
        }
    }

    async forgotPassword(email: string): Promise<MessageResponseDto> {
        this.logger.log(`Password reset requested for: ${maskEmail(email)}`);
        const user = await this.prismaService.user.findUnique({ where: { email } });

        // Always return same message (don't reveal if email exists)
        if (!user) {
            this.logger.debug(`Password reset for non-existent email: ${maskEmail(email)}`);
            return { message: "If an account exists, we've sent a password reset link." };
        }

        const token = crypto.randomBytes(32).toString('hex');

        // Store token in Redis: reset:{token} -> userId
        await this.redis.set(`reset:${token}`, user.id, 'EX', this.resetTokenTTL);

        await this.mailService.sendPasswordResetLink(email, token);
        this.logger.log(`Password reset email sent: ${maskEmail(email)}`);
        return { message: "If an account exists, we've sent a password reset link." };
    }

    async resetPassword(token: string, newPassword: string): Promise<MessageResponseDto> {
        if (!/^[a-f0-9]{64}$/.test(token)) {
            throw new UnauthorizedException('Invalid or expired reset token.');
        }

        const userId = await this.redis.get(`reset:${token}`);

        if (!userId) {
            this.logger.warn(`Invalid password reset attempt with token`);
            throw new UnauthorizedException('Invalid or expired reset token.');
        }

        const hashedPassword = await argon2.hash(newPassword, this.argon2Options);

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

    private setRefreshTokenCookie(res: Response, refreshToken: string): void {
        const isProduction = this.configService.get('NODE_ENV') === 'production';
        res.cookie('refresh_token', refreshToken, {
            httpOnly: true,
            secure: true,
            sameSite: isProduction ? 'none' : 'lax',
            path: '/api/v1/auth',
            maxAge: Number(this.refreshTokenTTL) * 1000,
        });
    }

    private setXsrfTokenCookie(res: Response): void {
        const isProduction = this.configService.get('NODE_ENV') === 'production';
        const xsrfToken = crypto.randomBytes(32).toString('hex');
        res.cookie('XSRF-TOKEN', xsrfToken, {
            httpOnly: false,
            secure: true,
            sameSite: isProduction ? 'none' : 'lax',
            path: '/',
            maxAge: Number(this.refreshTokenTTL) * 1000,
        });
    }

    private async sendVerificationCode(email: string): Promise<void> {
        const code = crypto.randomInt(100000, 1000000).toString();

        await this.redis.set(`verify:${email}`, code, 'EX', this.verificationCodeTTL);
        await this.mailService.sendVerificationCode(email, code);
    }

    private async incrementLoginAttempts(lockoutKey: string): Promise<void> {
        const pipeline = this.redis.pipeline();
        pipeline.incr(lockoutKey);
        pipeline.expire(lockoutKey, AuthService.LOGIN_LOCKOUT_TTL);
        await pipeline.exec();
    }

    private async generateTokens(
        user: { id: string; email: string; firstName: string; lastName: string },
        res: Response,
        userAgent?: string,
    ): Promise<AuthResponseDto> {
        const accessToken = this.jwtService.sign({ sub: user.id, email: user.email });
        const refreshToken = crypto.randomBytes(32).toString('hex');

        await this.sessionService.storeRefreshToken(user.id, refreshToken, userAgent);

        // Set refresh token as HttpOnly cookie
        this.setRefreshTokenCookie(res, refreshToken);
        this.setXsrfTokenCookie(res);

        this.logger.debug(`Token generated for user: ${user.id}`);

        return {
            accessToken,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
            },
        };
    }
}
