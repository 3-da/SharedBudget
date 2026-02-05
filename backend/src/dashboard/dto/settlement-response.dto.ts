import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SettlementResponseDto {
    @ApiProperty({ example: 125.5, type: 'number', description: 'Net settlement amount (absolute value)' })
    amount: number;

    @ApiPropertyOptional({ type: 'string', nullable: true, description: 'User ID who owes money (null if settled or no shared expenses)' })
    owedByUserId: string | null;

    @ApiPropertyOptional({ example: 'Sam', nullable: true, description: 'First name of the person who owes' })
    owedByFirstName: string | null;

    @ApiPropertyOptional({ type: 'string', nullable: true, description: 'User ID who is owed money (null if settled or no shared expenses)' })
    owedToUserId: string | null;

    @ApiPropertyOptional({ example: 'Alex', nullable: true, description: 'First name of the person who is owed' })
    owedToFirstName: string | null;

    @ApiProperty({ example: 'You owe Alex €125.50', description: 'Human-readable settlement message' })
    message: string;

    @ApiProperty({ example: false, description: 'Whether this month has been marked as settled' })
    isSettled: boolean;

    @ApiProperty({ example: 2, minimum: 1, maximum: 12 })
    month: number;

    @ApiProperty({ example: 2026 })
    year: number;
}
