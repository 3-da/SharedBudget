import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min, Max } from 'class-validator';

export class MarkPaidDto {
    @ApiProperty({ example: 6, description: 'Month (1-12)', minimum: 1, maximum: 12 })
    @IsInt()
    @Min(1)
    @Max(12)
    month: number;

    @ApiProperty({ example: 2026, description: 'Year', minimum: 2020, maximum: 2099 })
    @IsInt()
    @Min(2020)
    @Max(2099)
    year: number;
}
