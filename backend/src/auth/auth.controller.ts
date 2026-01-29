import { Body, Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshDto } from './dto/refresh.dto';
import { VerifyCodeDto } from './dto/verify-code.dto';
import { ResendCodeDto } from './dto/resend-code.dto';
import { AuthResponseDto, MessageResponseDto } from './dto/auth-response.dto';
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
    async verifyCode(@Body() verifyCodeDto: VerifyCodeDto): Promise<AuthResponseDto> {
        return this.authService.verifyCode(verifyCodeDto.email, verifyCodeDto.code);
    }

    @ResendCodeEndpoint()
    async resendCode(@Body() resendCodeDto: ResendCodeDto): Promise<MessageResponseDto> {
        return this.authService.resendCode(resendCodeDto.email);
    }

    @LoginEndpoint()
    async login(@Body() loginDto: LoginDto): Promise<AuthResponseDto> {
        return this.authService.login(loginDto);
    }

    @RefreshEndpoint()
    async refresh(@Body() refreshDto: RefreshDto): Promise<AuthResponseDto> {
        return this.authService.refresh(refreshDto.refreshToken);
    }

    @LogoutEndpoint()
    async logout(@Body() refreshDto: RefreshDto): Promise<MessageResponseDto> {
        await this.authService.logout(refreshDto.refreshToken);
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
