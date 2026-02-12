import { ApiProperty } from '@nestjs/swagger';

export class SavingsHistoryItemDto {
    @ApiProperty({ example: 2, description: 'Month (1-12)' })
    month: number;

    @ApiProperty({ example: 2026, description: 'Year' })
    year: number;

    @ApiProperty({ example: 200.0, type: 'number', description: 'Total personal savings for the household in this month' })
    personalSavings: number;

    @ApiProperty({ example: 150.0, type: 'number', description: 'Total shared savings for the household in this month' })
    sharedSavings: number;
}
