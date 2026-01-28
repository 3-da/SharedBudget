import {Body, Controller, HttpCode, HttpStatus, Post} from '@nestjs/common';
import {AuthService} from './auth.service';
import {LoginDto} from "./dto/login.dto";
import {RegisterDto} from "./dto/register.dto";
import {AuthResponseDto} from "./dto/auth-response.dto";
import {Throttle} from "@nestjs/throttler";

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {
    }

    @Post('register')
    @Throttle({default: {limit: 3, ttl: 60000}}) // 3 attempts per minute
    async register(@Body() registerDto: RegisterDto): Promise<AuthResponseDto> {
        return this.authService.register(registerDto)
    }

    @Post('login')
    @Throttle({default: {limit: 5, ttl: 60000}}) // 5 attempts per minute
    @HttpCode(HttpStatus.OK)
    async login(@Body() loginDto: LoginDto): Promise<AuthResponseDto> {
        return this.authService.login(loginDto)
    }

}
