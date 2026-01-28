import {Test, TestingModule} from '@nestjs/testing';
import {ForbiddenException, UnauthorizedException} from '@nestjs/common';
import {JwtService} from '@nestjs/jwt';
import {ConfigService} from '@nestjs/config';
import * as argon2 from 'argon2';
import {AuthService} from './auth.service';
import {PrismaService} from '../prisma/prisma.service';
import {MailService} from '../mail/mail.service';
import {RegisterDto} from './dto/register.dto';
import {LoginDto} from './dto/login.dto';
import {REDIS_CLIENT} from '../redis/redis.module';

jest.mock('argon2', () => ({
  hash: jest.fn(),
  verify: jest.fn(),
}));

describe('AuthService', () => {
  let authService: AuthService;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    password: 'hashed-password',
    firstName: 'John',
    lastName: 'Doe',
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockUnverifiedUser = {
    ...mockUser,
    emailVerified: false,
  };

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockRedis = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  const mockJwtService = { sign: jest.fn().mockReturnValue('mock-access-token') };
  const mockConfigService = { get: jest.fn().mockReturnValue('7d') };
  const mockMailService = { sendVerificationCode: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: REDIS_CLIENT, useValue: mockRedis },
        { provide: MailService, useValue: mockMailService },
      ],
    }).compile();

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

    it('should register a new user and send verification code', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue(mockUnverifiedUser);
      (argon2.hash as jest.Mock).mockResolvedValue('hashed-password');

      const result = await authService.register(registerDto);

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({ where: { email: registerDto.email } });
      expect(argon2.hash).toHaveBeenCalledWith(registerDto.password);
      expect(mockPrismaService.user.create).toHaveBeenCalled();
      expect(mockRedis.set).toHaveBeenCalled();
      expect(mockMailService.sendVerificationCode).toHaveBeenCalled();
      expect(result.message).toBe("We've sent a verification code to your email.");
    });

    it('should return same message if email already exists (security)', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await authService.register(registerDto);

      expect(result.message).toBe("We've sent a verification code to your email.");
      expect(mockPrismaService.user.create).not.toHaveBeenCalled();
    });
  });

  describe('verifyCode', () => {
    const email = 'test@example.com';
    const code = '123456';

    it('should verify code and return tokens (auto-login)', async () => {
      mockRedis.get.mockResolvedValue(code);
      mockPrismaService.user.findUnique.mockResolvedValue(mockUnverifiedUser);
      mockPrismaService.user.update.mockResolvedValue(mockUser);

      const result = await authService.verifyCode(email, code);

      expect(mockRedis.get).toHaveBeenCalledWith(`verify:${email}`);
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUnverifiedUser.id },
        data: { emailVerified: true },
      });
      expect(mockRedis.del).toHaveBeenCalledWith(`verify:${email}`);
      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toBeDefined();
    });

    it('should throw UnauthorizedException if code is invalid', async () => {
      mockRedis.get.mockResolvedValue('654321');

      await expect(authService.verifyCode(email, code)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if code is expired', async () => {
      mockRedis.get.mockResolvedValue(null);

      await expect(authService.verifyCode(email, code)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('resendCode', () => {
    const email = 'test@example.com';

    it('should send new code for unverified user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUnverifiedUser);

      const result = await authService.resendCode(email);

      expect(mockRedis.set).toHaveBeenCalled();
      expect(mockMailService.sendVerificationCode).toHaveBeenCalled();
      expect(result.message).toBe("If an account exists, we've sent a new code.");
    });

    it('should return same message for non-existent email (security)', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await authService.resendCode(email);

      expect(result.message).toBe("If an account exists, we've sent a new code.");
      expect(mockMailService.sendVerificationCode).not.toHaveBeenCalled();
    });

    it('should return same message for already verified user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await authService.resendCode(email);

      expect(result.message).toBe("If an account exists, we've sent a new code.");
      expect(mockMailService.sendVerificationCode).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    const loginDto: LoginDto = {
      email: 'test@example.com',
      password: 'password123',
    };

    it('should return tokens for valid credentials (verified user)', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      const result = await authService.login(loginDto);

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({ where: { email: loginDto.email } });
      expect(argon2.verify).toHaveBeenCalledWith(mockUser.password, loginDto.password);
      expect(mockRedis.set).toHaveBeenCalled();
      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toBeDefined();
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(authService.login(loginDto)).rejects.toThrow(UnauthorizedException);
      expect(argon2.verify).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if password is invalid', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (argon2.verify as jest.Mock).mockResolvedValue(false);

      await expect(authService.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw ForbiddenException if email not verified', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUnverifiedUser);
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      await expect(authService.login(loginDto)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('refresh', () => {
    const refreshToken = 'valid-refresh-token';

    it('should return new tokens for valid refresh token', async () => {
      mockRedis.get.mockResolvedValue(mockUser.id);
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await authService.refresh(refreshToken);

      expect(mockRedis.get).toHaveBeenCalledWith(`refresh:${refreshToken}`);
      expect(mockRedis.del).toHaveBeenCalledWith(`refresh:${refreshToken}`);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({ where: { id: mockUser.id } });
      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toBeDefined();
    });

    it('should throw UnauthorizedException if refresh token is invalid', async () => {
      mockRedis.get.mockResolvedValue(null);

      await expect(authService.refresh(refreshToken)).rejects.toThrow(UnauthorizedException);
      expect(mockPrismaService.user.findUnique).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockRedis.get.mockResolvedValue(mockUser.id);
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(authService.refresh(refreshToken)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    const refreshToken = 'valid-refresh-token';

    it('should delete refresh token from Redis', async () => {
      await authService.logout(refreshToken);

      expect(mockRedis.del).toHaveBeenCalledWith(`refresh:${refreshToken}`);
    });
  });
});
