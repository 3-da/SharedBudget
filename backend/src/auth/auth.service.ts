import {ConflictException, Injectable, UnauthorizedException} from '@nestjs/common';
import {PrismaService} from '../prisma/prisma.service';
import {JwtService} from '@nestjs/jwt';
import {RegisterDto} from './dto/register.dto';
import {AuthResponseDto} from './dto/auth-response.dto';
import * as argon2 from 'argon2';
import {LoginDto} from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prismaService: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    const existingUser = await this.prismaService.user.findUnique({
      where: { email: registerDto.email },
    });

    // TODO: When implementing email verification, change this to return
    // a generic message instead of throwing (don't reveal if email exists)
    if (existingUser) {
      throw new ConflictException('Email already registered.');
    }

    const hashedPassword = await argon2.hash(registerDto.password);

    const user = await this.prismaService.user.create({
      data: {
        email: registerDto.email,
        password: hashedPassword,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
      },
    });

    // TODO: Send verification email and return message instead of token
    return this.generateAuthResponse(user);
  }

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.prismaService.user.findUnique({
      where: { email: loginDto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Incorrect email or password.');
    }

    const isPasswordValid = await argon2.verify(user.password, loginDto.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Incorrect email or password.');
    }

    // TODO: Check if user.emailVerified === true before allowing login after adding email verification
    return this.generateAuthResponse(user);
  }

  private generateAuthResponse(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  }): AuthResponseDto {
    const accessToken = this.jwtService.sign({ sub: user.id, email: user.email });

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
