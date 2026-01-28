import {Body, Controller, HttpCode, HttpStatus, Post} from '@nestjs/common';
import {AuthService, MessageResponse} from './auth.service';
import {LoginDto} from './dto/login.dto';
import {RegisterDto} from './dto/register.dto';
import {RefreshDto} from './dto/refresh.dto';
import {VerifyCodeDto} from './dto/verify-code.dto';
import {ResendCodeDto} from './dto/resend-code.dto';
import {AuthResponseDto} from './dto/auth-response.dto';
import {Throttle} from '@nestjs/throttler';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {
    }

    @Post('register')
    @Throttle({default: {limit: 3, ttl: 60000, blockDuration: 600000}})
    async register(@Body() registerDto: RegisterDto): Promise<MessageResponse> {
        return this.authService.register(registerDto);
    }

    @Post('verify-code')
    @Throttle({default: {limit: 5, ttl: 60000, blockDuration: 300000}})
    @HttpCode(HttpStatus.OK)
    async verifyCode(@Body() verifyCodeDto: VerifyCodeDto): Promise<AuthResponseDto> {
        return this.authService.verifyCode(verifyCodeDto.email, verifyCodeDto.code);
    }

    @Post('resend-code')
    @Throttle({default: {limit: 3, ttl: 600000}}) // 3 per 10 minutes
    @HttpCode(HttpStatus.OK)
    async resendCode(@Body() resendCodeDto: ResendCodeDto): Promise<MessageResponse> {
        return this.authService.resendCode(resendCodeDto.email);
    }

    @Post('login')
    @Throttle({default: {limit: 5, ttl: 60000, blockDuration: 300000}})
    @HttpCode(HttpStatus.OK)
    async login(@Body() loginDto: LoginDto): Promise<AuthResponseDto> {
        return this.authService.login(loginDto);
    }

    @Post('refresh')
    @Throttle({default: {limit: 10, ttl: 60000}})
    @HttpCode(HttpStatus.OK)
    async refresh(@Body() refreshDto: RefreshDto): Promise<AuthResponseDto> {
        return this.authService.refresh(refreshDto.refreshToken);
    }

    @Post('logout')
    @Throttle({default: {limit: 10, ttl: 60000}})
    @HttpCode(HttpStatus.OK)
    async logout(@Body() refreshDto: RefreshDto): Promise<MessageResponse> {
        await this.authService.logout(refreshDto.refreshToken);
        return {message: 'Logged out successfully.'};
    }
}
