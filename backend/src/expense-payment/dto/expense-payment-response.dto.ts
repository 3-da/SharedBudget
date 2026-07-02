import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentStatus } from '../../generated/prisma/enums';

export class ExpensePaymentResponseDto {
    @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'Payment status record ID' })
    id!: string;

    @ApiProperty({ example: '660e8400-e29b-41d4-a716-446655440000', description: 'Associated expense ID' })
    expenseId!: string;

    @ApiProperty({ example: 6, description: 'Month (1-12)' })
    month!: number;

    @ApiProperty({ example: 2026, description: 'Year' })
    year!: number;

    @ApiProperty({ enum: ['PENDING', 'PAID', 'CANCELLED'], example: 'PAID', description: 'Current payment status' })
    status!: PaymentStatus;

    @ApiPropertyOptional({ example: '2026-06-15T10:30:00.000Z', description: 'When the expense was marked as paid' })
    paidAt!: Date | null;

    @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'User who last changed the status' })
    paidById!: string;

    @ApiPropertyOptional({ example: 45.5, nullable: true, description: 'Actual amount paid (for flexible expenses). Null for fixed expenses.' })
    paidAmount!: number | null;

    @ApiPropertyOptional({
        example: 4.5,
        nullable: true,
        description: "How much of this month's override-adjusted amount is still unpaid. Null unless the expense is currently PAID.",
    })
    remainingAmount!: number | null;

    @ApiProperty({ description: 'Record creation timestamp' })
    createdAt!: Date;

    @ApiProperty({ description: 'Record last update timestamp' })
    updatedAt!: Date;
}
