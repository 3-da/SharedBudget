import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
    @ApiProperty({ example: 'user@example.com', description: 'User email address' })
    @IsEmail()
    email: string;

    @ApiProperty({
        example: 'SecurePass123!',
        description: 'Password (8-72 characters)',
        minLength: 8,
        maxLength: 72,
    })
    @IsString()
    @MinLength(8)
    @MaxLength(72)
    password: string;

    @ApiProperty({ example: 'John', description: 'First name', minLength: 1, maxLength: 50 })
    @IsString()
    @MinLength(1)
    @MaxLength(50)
    firstName: string;

    @ApiProperty({ example: 'Doe', description: 'Last name', minLength: 1, maxLength: 50 })
    @IsString()
    @MinLength(1)
    @MaxLength(50)
    lastName: string;
}
