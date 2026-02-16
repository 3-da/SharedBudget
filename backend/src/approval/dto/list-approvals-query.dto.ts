import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { ApprovalStatus } from '../../generated/prisma/enums';

export class ListApprovalsQueryDto {
    @ApiPropertyOptional({ enum: [ApprovalStatus.ACCEPTED, ApprovalStatus.REJECTED, ApprovalStatus.CANCELLED], description: 'Filter by approval status' })
    @IsOptional()
    @IsEnum(ApprovalStatus)
    status?: ApprovalStatus;
}
