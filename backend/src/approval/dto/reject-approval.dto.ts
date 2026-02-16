import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RejectApprovalDto {
    @ApiProperty({ example: 'Amount is too high, please lower it.', description: 'Reason for rejection', maxLength: 500 })
    @IsString()
    @IsNotEmpty()
    @MaxLength(500)
    message!: string;
}
