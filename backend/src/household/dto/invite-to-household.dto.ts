import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class InviteToHouseholdDto {
    @ApiProperty({ example: 'partner@example.com', description: 'Email of the user to invite' })
    @IsNotEmpty()
    @IsEmail()
    email: string;
}
