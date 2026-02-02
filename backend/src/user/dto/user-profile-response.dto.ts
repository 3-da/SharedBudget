import { ApiProperty } from '@nestjs/swagger';

export class UserProfileResponseDto {
    @ApiProperty({ type: 'string' })
    id: string;

    @ApiProperty({ example: 'user@example.com' })
    email: string;

    @ApiProperty({ example: 'John' })
    firstName: string;

    @ApiProperty({ example: 'Doe' })
    lastName: string;

    @ApiProperty({ type: 'string', format: 'date-time' })
    createdAt: Date;

    @ApiProperty({ type: 'string', format: 'date-time' })
    updatedAt: Date;
}
