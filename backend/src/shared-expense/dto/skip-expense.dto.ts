import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class SkipExpenseDto {
    @ApiPropertyOptional({ example: 7, description: 'Month (1-12). Defaults to current month.', minimum: 1, maximum: 12 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(12)
    month?: number;

    @ApiPropertyOptional({ example: 2026, description: 'Year. Defaults to current year.', minimum: 2000 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(2000)
    year?: number;
}
