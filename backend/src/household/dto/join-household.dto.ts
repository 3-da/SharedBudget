import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class JoinHouseholdDto {
    @ApiProperty({ example: 'a1b2c3d4', description: 'Household invite code' })
    @IsNotEmpty()
    @IsString()
    inviteCode: string;
}
