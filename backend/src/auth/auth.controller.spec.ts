import {Test, TestingModule} from '@nestjs/testing';
import {AuthController} from './auth.controller';
import {AuthService} from './auth.service';
import {RegisterDto} from './dto/register.dto';
import {LoginDto} from './dto/login.dto';
import {RefreshDto} from './dto/refresh.dto';
import {VerifyCodeDto} from './dto/verify-code.dto';
import {ResendCodeDto} from './dto/resend-code.dto';
import {AuthResponseDto} from './dto/auth-response.dto';

describe('AuthController', () => {
    let controller: AuthController;
    let authService: AuthService;

    const mockAuthResponse: AuthResponseDto = {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        user: {
            id: 'user-123',
            email: 'test@example.com',
            firstName: 'John',
            lastName: 'Doe',
        },
    };

    const mockAuthService = {
        register: jest.fn(() => Promise.resolve({message: "We've sent a verification code to your email."})),
        verifyCode: jest.fn(() => Promise.resolve(mockAuthResponse)),
        resendCode: jest.fn(() => Promise.resolve({message: "If an account exists, we've sent a new code."})),
        login: jest.fn(() => Promise.resolve(mockAuthResponse)),
        refresh: jest.fn(() => Promise.resolve(mockAuthResponse)),
        logout: jest.fn(() => Promise.resolve()),
    };

    const refreshDto: RefreshDto = {refreshToken: 'mock-refresh-token'};

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [AuthController],
            providers: [{provide: AuthService, useValue: mockAuthService}],
        }).compile();

        controller = module.get<AuthController>(AuthController);
        authService = module.get<AuthService>(AuthService);

        jest.clearAllMocks();
    });

    describe('register', () => {
        const registerDto: RegisterDto = {
            email: 'test@example.com',
            password: 'password123',
            firstName: 'John',
            lastName: 'Doe',
        };

        it('should call authService.register and return message', async () => {
            const result = await controller.register(registerDto);

            expect(authService.register).toHaveBeenCalledWith(registerDto);
            expect(authService.register).toHaveBeenCalledTimes(1);
            expect(result.message).toBe("We've sent a verification code to your email.");
        });
    });

    describe('verifyCode', () => {
        const verifyCodeDto: VerifyCodeDto = {email: 'test@example.com', code: '123456'};

        it('should call authService.verifyCode and return tokens', async () => {
            const result = await controller.verifyCode(verifyCodeDto);

            expect(authService.verifyCode).toHaveBeenCalledWith(verifyCodeDto.email, verifyCodeDto.code);
            expect(authService.verifyCode).toHaveBeenCalledTimes(1);
            expect(result).toEqual(mockAuthResponse);
        });
    });

    describe('resendCode', () => {
        const resendCodeDto: ResendCodeDto = {email: 'test@example.com'};

        it('should call authService.resendCode and return message', async () => {
            const result = await controller.resendCode(resendCodeDto);

            expect(authService.resendCode).toHaveBeenCalledWith(resendCodeDto.email);
            expect(authService.resendCode).toHaveBeenCalledTimes(1);
            expect(result.message).toBe("If an account exists, we've sent a new code.");
        });
    });

    describe('login', () => {
        const loginDto: LoginDto = {email: 'test@example.com', password: 'password123'};

        it('should call authService.login and return tokens', async () => {
            const result = await controller.login(loginDto);

            expect(authService.login).toHaveBeenCalledWith(loginDto);
            expect(authService.login).toHaveBeenCalledTimes(1);
            expect(result).toEqual(mockAuthResponse);
        });
    });

    describe('refresh', () => {
        it('should call authService.refresh and return new tokens', async () => {
            const result = await controller.refresh(refreshDto);

            expect(authService.refresh).toHaveBeenCalledWith(refreshDto.refreshToken);
            expect(authService.refresh).toHaveBeenCalledTimes(1);
            expect(result).toEqual(mockAuthResponse);
        });
    });

    describe('logout', () => {
        it('should call authService.logout and return success message', async () => {
            const result = await controller.logout(refreshDto);

            expect(authService.logout).toHaveBeenCalledWith(refreshDto.refreshToken);
            expect(authService.logout).toHaveBeenCalledTimes(1);
            expect(result).toEqual({message: 'Logged out successfully.'});
        });
    });
});
