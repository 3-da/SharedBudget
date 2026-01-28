import {Test, TestingModule} from '@nestjs/testing';
import {AuthController} from './auth.controller';
import {AuthService} from './auth.service';
import {AuthResponseDto} from "./dto/auth-response.dto";
import {RegisterDto} from "./dto/register.dto";
import {LoginDto} from "./dto/login.dto";

describe('AuthController', () => {
    let controller: AuthController;
    let authService: AuthService;

    const mockAuthResponse: AuthResponseDto = {
        accessToken: 'mock-jwt-token',
        user: {
            id: 'user-123',
            email: 'test@example.com',
            firstName: 'John',
            lastName: 'Doe',
        }
    };

    const mockAuthService = {
        register: jest.fn(),
        login: jest.fn(),
    }

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
        }

        it('should call authService.register and return result', async () => {
            mockAuthService.register.mockResolvedValue(mockAuthResponse);

            const result = await controller.register(registerDto);

            expect(authService.register).toHaveBeenCalledWith(registerDto);
            expect(mockAuthService.register).toHaveBeenCalledTimes(1);
            expect(result).toEqual(mockAuthResponse);
        });
    });

    describe('login', () => {
        const loginDto: LoginDto = {
            email: 'test@example.com',
            password: 'password123',
        };

        it('should call authService.login and return result', async () => {
            mockAuthService.login.mockResolvedValue(mockAuthResponse);

            const result = await controller.login(loginDto);

            expect(authService.login).toHaveBeenCalledWith(loginDto);
            expect(authService.login).toHaveBeenCalledTimes(1);
            expect(result).toEqual(mockAuthResponse);
        });
    })
});
