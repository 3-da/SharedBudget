import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApprovalResponseDto {
    @ApiProperty({ type: 'string' })
    id: string;

    @ApiPropertyOptional({ type: 'string', nullable: true, description: 'Null for CREATE actions' })
    expenseId: string | null;

    @ApiProperty({ type: 'string' })
    householdId: string;

    @ApiProperty({ example: 'CREATE', description: 'CREATE, UPDATE, or DELETE' })
    action: string;

    @ApiProperty({ example: 'PENDING' })
    status: string;

    @ApiProperty({ type: 'string' })
    requestedById: string;

    @ApiPropertyOptional({ type: 'string', nullable: true, description: 'User who reviewed the approval' })
    reviewedById: string | null;

    @ApiPropertyOptional({ type: 'string', nullable: true, description: "Reviewer's comment", maxLength: 500 })
    message: string | null;

    @ApiPropertyOptional({ description: 'Proposed expense data (for CREATE/UPDATE)' })
    proposedData: object | null;

    @ApiProperty({ type: 'string', format: 'date-time' })
    createdAt: Date;

    @ApiPropertyOptional({ type: 'string', format: 'date-time', nullable: true, description: 'When the review happened' })
    reviewedAt: Date | null;
}
