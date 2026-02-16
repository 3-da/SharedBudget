import { ApiProperty } from '@nestjs/swagger';

class UserDto {
    @ApiProperty({ example: 'uuid-1234-5678' })
    id!: string;

    @ApiProperty({ example: 'user@example.com' })
    email!: string;

    @ApiProperty({ example: 'John' })
    firstName!: string;

    @ApiProperty({ example: 'Doe' })
    lastName!: string;
}

export class AuthResponseDto {
    @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIs...', description: 'JWT access token' })
    accessToken!: string;

    @ApiProperty({
        example: 'a1b2c3d4e5f6...',
        description: 'Refresh token for obtaining new access tokens',
    })
    refreshToken!: string;

    @ApiProperty({ type: UserDto, description: 'User information' })
    user!: UserDto;
}
