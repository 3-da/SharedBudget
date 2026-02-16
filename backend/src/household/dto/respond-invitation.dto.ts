import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty } from 'class-validator';

export class RespondInvitationDto {
    @ApiProperty({ example: true, description: 'True to accept, false to decline' })
    @IsNotEmpty()
    @IsBoolean()
    accept!: boolean;
}
