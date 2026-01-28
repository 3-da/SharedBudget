import {ForbiddenException, Inject, Injectable, UnauthorizedException} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {JwtService} from '@nestjs/jwt';
import {PrismaService} from '../prisma/prisma.service';
import {RegisterDto} from './dto/register.dto';
import {LoginDto} from './dto/login.dto';
import {AuthResponseDto} from './dto/auth-response.dto';
import {MailService} from '../mail/mail.service';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import {REDIS_CLIENT} from '../redis/redis.module';
import Redis from 'ioredis';

export interface MessageResponse {
    message: string;
}

@Injectable()
export class AuthService {
    private readonly refreshTokenTTL: number;
    private readonly verificationCodeTTL: number;

    constructor(
        private prismaService: PrismaService,
        private jwtService: JwtService,
        private configService: ConfigService,
        private mailService: MailService,
        @Inject(REDIS_CLIENT) private redis: Redis,
    ) {
        this.verificationCodeTTL = this.configService.get<number>('AUTH_VERIFICATION_CODE_TTL', 600);
        this.refreshTokenTTL = this.configService.get<number>('AUTH_REFRESH_TOKEN_TTL', 604800);
    }

    async register(registerDto: RegisterDto): Promise<MessageResponse> {
        const existingUser = await this.prismaService.user.findUnique({where: {email: registerDto.email}});

        // Always return same message (don't reveal if email exists)
        if (existingUser) return {message: "We've sent a verification code to your email."};

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
        return {message: "We've sent a verification code to your email."};
    }

    async verifyCode(email: string, code: string): Promise<AuthResponseDto> {
        const storedCode = await this.redis.get(`verify:${email}`);
        if (!storedCode || storedCode !== code) throw new UnauthorizedException('Invalid or expired verification code.');

        const user = await this.prismaService.user.findUnique({where: {email}});
        if (!user) throw new UnauthorizedException('Invalid or expired verification code.');

        await this.prismaService.user.update({where: {id: user.id}, data: {emailVerified: true}});    // Mark as verified
        await this.redis.del(`verify:${email}`);    // Delete the code

        return this.generateTokens(user);   // Auto-login: return tokens
    }

    async resendCode(email: string): Promise<MessageResponse> {
        const user = await this.prismaService.user.findUnique({where: {email}});
        if (!user || user.emailVerified) return {message: "If an account exists, we've sent a new code."}; // Always return same message (don't reveal if account exists)

        await this.sendVerificationCode(email);

        return {message: "If an account exists, we've sent a new code."};
    }

    async login(loginDto: LoginDto): Promise<AuthResponseDto> {
        const user = await this.prismaService.user.findUnique({where: {email: loginDto.email}});
        if (!user) throw new UnauthorizedException('Incorrect email or password.');

        const isPasswordValid = await argon2.verify(user.password, loginDto.password);
        if (!isPasswordValid) throw new UnauthorizedException('Incorrect email or password.');

        if (!user.emailVerified) throw new ForbiddenException('Please verify your email first. Check your inbox for the verification code.'); // Check if email is verified

        return this.generateTokens(user);
    }

    async refresh(refreshToken: string): Promise<AuthResponseDto> {
        const userId = await this.redis.get(`refresh:${refreshToken}`);

        if (!userId) throw new UnauthorizedException('Invalid or expired session. Please sign in again.');

        const user = await this.prismaService.user.findUnique({where: {id: userId}});
        if (!user) throw new UnauthorizedException('Invalid or expired session. Please sign in again.');

        await this.redis.del(`refresh:${refreshToken}`);    // Delete old refresh token

        return this.generateTokens(user);   // Generate new tokens
    }

    async logout(refreshToken: string): Promise<void> {
        await this.redis.del(`refresh:${refreshToken}`);
    }

    private async sendVerificationCode(email: string): Promise<void> {
        const code = Math.floor(100000 + Math.random() * 900000).toString();

        await this.redis.set(`verify:${email}`, code, 'EX', this.verificationCodeTTL);

        await this.mailService.sendVerificationCode(email, code);
    }

    private async generateTokens(user: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
    }): Promise<AuthResponseDto> {
        const accessToken = this.jwtService.sign({sub: user.id, email: user.email});
        const refreshToken = crypto.randomBytes(32).toString('hex');

        // Store refresh token in Redis with user ID
        await this.redis.set(`refresh:${refreshToken}`, user.id, 'EX', this.refreshTokenTTL);

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
