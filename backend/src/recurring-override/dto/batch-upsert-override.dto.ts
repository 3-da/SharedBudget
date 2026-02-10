import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsInt, IsNumber, IsOptional, Max, Min, ValidateNested } from 'class-validator';

export class BatchOverrideItemDto {
    @ApiProperty({ example: 2026, description: 'Year of the override' })
    @IsInt()
    @Min(2020)
    @Max(2100)
    year: number;

    @ApiProperty({ example: 6, description: 'Month of the override (1-12)' })
    @IsInt()
    @Min(1)
    @Max(12)
    month: number;

    @ApiProperty({ example: 450.0, description: 'Overridden amount for this month', minimum: 0 })
    @IsNumber()
    @Min(0)
    amount: number;

    @ApiPropertyOptional({ example: false, description: 'If true, expense is skipped this month' })
    @IsOptional()
    @IsBoolean()
    skipped?: boolean;
}

export class BatchUpsertOverrideDto {
    @ApiProperty({ type: [BatchOverrideItemDto], description: 'Array of overrides to create or update' })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => BatchOverrideItemDto)
    overrides: BatchOverrideItemDto[];
}
