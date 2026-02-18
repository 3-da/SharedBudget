import { Body, Controller, Headers, Req, Res, UnauthorizedException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import express from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { VerifyCodeDto } from './dto/verify-code.dto';
import { ResendCodeDto } from './dto/resend-code.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { MessageResponseDto } from '../common/dto/message-response.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import {
    ForgotPasswordEndpoint,
    LoginEndpoint,
    LogoutEndpoint,
    RefreshEndpoint,
    RegisterEndpoint,
    ResendCodeEndpoint,
    ResetPasswordEndpoint,
    VerifyCodeEndpoint,
} from './decorators/api-auth.decorators';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @RegisterEndpoint()
    async register(@Body() registerDto: RegisterDto): Promise<MessageResponseDto> {
        return this.authService.register(registerDto);
    }

    @VerifyCodeEndpoint()
    async verifyCode(
        @Body() verifyCodeDto: VerifyCodeDto,
        @Res({ passthrough: true }) res: express.Response,
        @Headers('user-agent') userAgent?: string,
    ): Promise<AuthResponseDto> {
        return this.authService.verifyCode(verifyCodeDto.email, verifyCodeDto.code, res, userAgent);
    }

    @ResendCodeEndpoint()
    async resendCode(@Body() resendCodeDto: ResendCodeDto): Promise<MessageResponseDto> {
        return this.authService.resendCode(resendCodeDto.email);
    }

    @LoginEndpoint()
    async login(
        @Body() loginDto: LoginDto,
        @Res({ passthrough: true }) res: express.Response,
        @Headers('user-agent') userAgent?: string,
    ): Promise<AuthResponseDto> {
        return this.authService.login(loginDto, res, userAgent);
    }

    @RefreshEndpoint()
    async refresh(
        @Req() req: express.Request,
        @Res({ passthrough: true }) res: express.Response,
        @Headers('user-agent') userAgent?: string,
    ): Promise<AuthResponseDto> {
        const refreshToken = req.cookies?.['refresh_token'];
        if (!refreshToken) {
            throw new UnauthorizedException('No refresh token provided.');
        }
        return this.authService.refresh(refreshToken, res, userAgent);
    }

    @LogoutEndpoint()
    async logout(@Req() req: express.Request, @Res({ passthrough: true }) res: express.Response): Promise<MessageResponseDto> {
        const refreshToken = req.cookies?.['refresh_token'] || '';
        await this.authService.logout(refreshToken, res);
        return { message: 'Logged out successfully.' };
    }

    @ForgotPasswordEndpoint()
    async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto): Promise<MessageResponseDto> {
        return this.authService.forgotPassword(forgotPasswordDto.email);
    }

    @ResetPasswordEndpoint()
    async resetPassword(@Body() resetPasswordDto: ResetPasswordDto): Promise<MessageResponseDto> {
        return this.authService.resetPassword(resetPasswordDto.token, resetPasswordDto.newPassword);
    }
}
