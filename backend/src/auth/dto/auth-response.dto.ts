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

    @ApiProperty({ type: UserDto, description: 'User information' })
    user!: UserDto;
}
