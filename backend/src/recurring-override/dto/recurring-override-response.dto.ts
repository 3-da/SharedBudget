import { ApiProperty } from '@nestjs/swagger';

export class RecurringOverrideResponseDto {
    @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
    id: string;

    @ApiProperty({ example: '660e8400-e29b-41d4-a716-446655440000' })
    expenseId: string;

    @ApiProperty({ example: 6 })
    month: number;

    @ApiProperty({ example: 2026 })
    year: number;

    @ApiProperty({ example: 450.0 })
    amount: number;

    @ApiProperty({ example: false })
    skipped: boolean;

    @ApiProperty()
    createdAt: Date;

    @ApiProperty()
    updatedAt: Date;
}
