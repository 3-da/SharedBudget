import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AcceptApprovalDto {
    @ApiPropertyOptional({ example: 'Looks good, approved!', description: 'Optional reviewer comment', maxLength: 500 })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    message?: string;
}
