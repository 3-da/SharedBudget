import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
    @ApiProperty({ example: 'OldPass123!', description: 'Current password' })
    @IsString()
    @MinLength(8)
    @MaxLength(72)
    currentPassword: string;

    @ApiProperty({ example: 'NewSecure456!', description: 'New password (8-72 characters)', minLength: 8, maxLength: 72 })
    @IsString()
    @MinLength(8)
    @MaxLength(72)
    newPassword: string;
}
