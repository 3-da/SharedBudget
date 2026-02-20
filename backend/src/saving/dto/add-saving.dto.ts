import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, Min, IsOptional, IsInt, Max } from 'class-validator';

export class AddSavingDto {
    @ApiProperty({ example: 50.0, description: 'Amount to add to savings', minimum: 0.01 })
    @IsNumber()
    @Min(0.01)
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
