import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class RespondDeleteAccountRequestDto {
    @ApiProperty({
        example: true,
        description: 'True to accept the deletion request (you become owner), false to reject (household is deleted)',
    })
    @IsBoolean()
    accept: boolean;
}
