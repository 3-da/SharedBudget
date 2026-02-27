import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class SkipExpenseDto {
    @ApiPropertyOptional({ example: 3, description: 'Month (1-12). Defaults to current month.', minimum: 1, maximum: 12 })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(12)
    month?: number;

    @ApiPropertyOptional({ example: 2026, description: 'Year. Defaults to current year.', minimum: 2020 })
    @IsOptional()
    @IsInt()
    @Min(2020)
    year?: number;
}
