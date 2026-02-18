import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ExpenseCategory, ExpenseFrequency } from '../../generated/prisma/enums';

export class ListPersonalExpensesQueryDto {
    @ApiPropertyOptional({ enum: ExpenseCategory, description: 'Filter by category' })
    @IsOptional()
    @IsEnum(ExpenseCategory)
    category?: ExpenseCategory;

    @ApiPropertyOptional({ enum: ExpenseFrequency, description: 'Filter by frequency' })
    @IsOptional()
    @IsEnum(ExpenseFrequency)
    frequency?: ExpenseFrequency;

    @ApiPropertyOptional({ example: 2, description: 'Month (1-12)', minimum: 1, maximum: 12 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(12)
    month?: number;

    @ApiPropertyOptional({ example: 2026, description: 'Year', minimum: 2000 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(2000)
    year?: number;
}
