import { ApiProperty } from '@nestjs/swagger';

export class SalaryResponseDto {
    @ApiProperty({ type: 'string' })
    id: string;

    @ApiProperty({ type: 'string' })
    userId: string;

    @ApiProperty({ example: 'John' })
    firstName: string;

    @ApiProperty({ example: 'Doe' })
    lastName: string;

    @ApiProperty({ example: 3500.0, type: 'number' })
    defaultAmount: number;

    @ApiProperty({ example: 3500.0, type: 'number' })
    currentAmount: number;

    @ApiProperty({ example: 6, minimum: 1, maximum: 12 })
    month: number;

    @ApiProperty({ example: 2026 })
    year: number;

    @ApiProperty({ type: 'string', format: 'date-time' })
    createdAt: Date;

    @ApiProperty({ type: 'string', format: 'date-time' })
    updatedAt: Date;
}
