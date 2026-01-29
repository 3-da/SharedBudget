import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
    @ApiProperty({ example: 'a1b2c3d4e5f6...', description: 'Password reset token from email' })
    @IsString()
    @IsNotEmpty()
    token: string;

    @ApiProperty({ example: 'NewSecurePass123!', description: 'New password (8-72 characters)', minLength: 8, maxLength: 72 })
    @IsString()
    @MinLength(8)
    @MaxLength(72)
    newPassword: string;
}
