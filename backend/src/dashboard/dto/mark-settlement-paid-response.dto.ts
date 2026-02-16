import { ApiProperty } from '@nestjs/swagger';

export class MarkSettlementPaidResponseDto {
    @ApiProperty({ type: 'string', description: 'Settlement record ID' })
    id!: string;

    @ApiProperty({ type: 'string' })
    householdId!: string;

    @ApiProperty({ example: 2, minimum: 1, maximum: 12 })
    month!: number;

    @ApiProperty({ example: 2026 })
    year!: number;

    @ApiProperty({ example: 125.5, type: 'number', description: 'Amount that was settled' })
    amount!: number;

    @ApiProperty({ type: 'string', description: 'User who paid' })
    paidByUserId!: string;

    @ApiProperty({ type: 'string', description: 'User who was paid' })
    paidToUserId!: string;

    @ApiProperty({ type: 'string', format: 'date-time', description: 'When the settlement was marked as paid' })
    paidAt!: Date;
}
