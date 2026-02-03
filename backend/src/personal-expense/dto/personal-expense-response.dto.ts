import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PersonalExpenseResponseDto {
    @ApiProperty({ type: 'string' })
    id: string;

    @ApiProperty({ type: 'string' })
    householdId: string;

    @ApiProperty({ type: 'string' })
    createdById: string;

    @ApiProperty({ example: 'Gym membership' })
    name: string;

    @ApiProperty({ example: 49.99, type: 'number' })
    amount: number;

    @ApiProperty({ example: 'RECURRING' })
    category: string;

    @ApiProperty({ example: 'MONTHLY' })
    frequency: string;

    @ApiPropertyOptional({ example: 'FULL' })
    yearlyPaymentStrategy?: string | null;

    @ApiPropertyOptional({ example: 'QUARTERLY' })
    installmentFrequency?: string | null;

    @ApiPropertyOptional({ example: 6 })
    paymentMonth?: number | null;

    @ApiPropertyOptional({ example: 3 })
    month?: number | null;

    @ApiPropertyOptional({ example: 2026 })
    year?: number | null;

    @ApiProperty({ type: 'string', format: 'date-time' })
    createdAt: Date;

    @ApiProperty({ type: 'string', format: 'date-time' })
    updatedAt: Date;
}
