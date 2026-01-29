import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshDto {
    @ApiProperty({ example: 'a1b2c3d4e5f6...', description: 'Refresh token from login response' })
    @IsString()
    @IsNotEmpty()
    refreshToken: string;
}
