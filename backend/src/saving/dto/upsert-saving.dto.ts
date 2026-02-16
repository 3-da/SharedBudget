import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, Min, IsOptional, IsInt, Max } from 'class-validator';

export class UpsertSavingDto {
    @ApiProperty({ example: 200.0, description: 'Savings amount for the month', minimum: 0 })
    @IsNumber()
    @Min(0)
    amount!: number;

    @ApiPropertyOptional({ example: 6, description: 'Month (1-12). Defaults to current month.', minimum: 1, maximum: 12 })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(12)
    month?: number;

    @ApiPropertyOptional({ example: 2026, description: 'Year. Defaults to current year.', minimum: 2020, maximum: 2099 })
    @IsOptional()
    @IsInt()
    @Min(2020)
    @Max(2099)
    year?: number;
}
